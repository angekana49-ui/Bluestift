import { NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureRecoverable,
  findUserIdByRecoveryKey,
  hasRealEmail,
  mintSessionFor,
} from "@/lib/auth";
import { isValidRecoveryKey, normalizeRecoveryKey } from "@/lib/recovery-key";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkStrictRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/**
 * Reconnect via recovery key. Two paths, chosen by the account's identity:
 * - Real linked email  -> email a fresh magic link (Supabase verifies captcha).
 * - Email-less anonymous account -> mint a session server-side against the
 *   synthetic address. No inbox needed, which is the whole point of a key for
 *   anonymous users. The session cookies are set on this response.
 *
 * The key is matched by SHA-256 against `users.recovery_code_hash`; it is not
 * stored anywhere in the clear, and it is no longer the account's password
 * either — it identifies the account, and the session is issued admin-side. That
 * split is why a read of the users table is no longer a working credential.
 *
 * Responses (200): { status: "recovered" | "sent" | "invalid" }.
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  let body: { code?: string; captchaToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  // Normalise before matching: the key is shown grouped (7KFM-9QRT-2XBH-4DWP),
  // so the dashes and spaces a user copies back MUST NOT be read as a bad key.
  const code = normalizeRecoveryKey(body.code ?? "");
  if (!isValidRecoveryKey(code)) {
    return NextResponse.json({ status: "invalid" });
  }
  if (!(await verifyTurnstile(body.captchaToken))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }
  if (!(await checkStrictRateLimit("auth_recovery", clientIp(request), 10, "15 minutes"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Look up the account by the key's hash (service role). The cleartext key is
  // never compared against anything stored, because nothing stored is cleartext.
  const admin = createAdminClient();
  const foundId = await findUserIdByRecoveryKey(code);
  if (!foundId) return NextResponse.json({ status: "invalid" });
  const found = { id: foundId };

  // Make sure the account actually carries a login identity (backfills any
  // pre-existing anonymous account that never got a synthetic email).
  await ensureRecoverable(found.id);

  // Reactivate a dormant account: the lifecycle cron bans + marks 'dormant' after
  // 60d of inactivity, but the owner just came back with a valid key — un-ban so
  // the sign-in below can succeed, and lift the state out of 'dormant'. Idempotent.
  try {
    await admin.auth.admin.updateUserById(found.id, { ban_duration: "none" });
    await admin
      .from("users")
      .update({ account_state: "active_unverified" })
      .eq("id", found.id)
      .eq("account_state", "dormant");
  } catch {
    // best-effort — never block recovery on this
  }

  const { data: authData } = await admin.auth.admin.getUserById(found.id);
  const email = authData?.user?.email ?? null;
  if (!email) return NextResponse.json({ status: "invalid" });

  // Real email on file -> magic link (Supabase checks the captcha token itself).
  if (hasRealEmail(email)) {
    const anon = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/callback?next=/account`,
        captchaToken: body.captchaToken,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ status: "sent" });
  }

  // Synthetic (email-less) account -> mint the session admin-side. We have
  // already proven possession of the key by matching its hash; asking Supabase to
  // re-verify a password would only work because the key USED to be that
  // password, which is precisely the coupling this design removes. Session
  // cookies land on this response via the SSR client.
  const supabase = await createClient();
  const minted = await mintSessionFor(supabase, email);
  if (!minted) return NextResponse.json({ status: "invalid" });

  return NextResponse.json({ status: "recovered" });
}
