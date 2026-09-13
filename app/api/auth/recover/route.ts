import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureRecoverable, findUserIdByRecoveryKey, mintSessionFor } from "@/lib/auth";
import { isValidRecoveryKey, normalizeRecoveryKey } from "@/lib/recovery-key";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkStrictRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/**
 * Reconnect via recovery key: the key signs the account in, directly, whatever
 * the account is — anonymous or upgraded to a verified email.
 *
 * It used to email a magic link instead whenever the account had a real
 * address. Owner decision (2026-09-13): the people this key exists for are
 * teenagers who rarely open a mailbox, and an account upgraded to pay must not
 * become harder to get back into than the anonymous one it was. The key is 16
 * characters from a 32-letter alphabet (80 random bits), behind a captcha and
 * a strict per-IP limit, so it is a credential at least as strong as a
 * password — which is what it now is, for every account.
 *
 * The key is matched by SHA-256 against `users.recovery_code_hash`; it is not
 * stored anywhere in the clear, and it is not the account's password either —
 * it identifies the account, and the session is issued admin-side against the
 * account's current address, synthetic or real.
 *
 * Responses (200): { status: "recovered" | "invalid" }.
 */
export async function POST(request: Request) {
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
  // Absence is refused up front — that costs no redemption.
  if (!body.captchaToken) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }
  if (!(await checkStrictRateLimit("auth_recovery", clientIp(request), 10, "15 minutes"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  // Verified here, once, and before the key is looked up: nothing downstream
  // (the admin link, verifyOtp) ever sees the token, so this route is the only
  // place that can spend it, and no account is touched for a request without
  // a valid one.
  if (!(await verifyTurnstile(body.captchaToken))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
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

  // Mint the session admin-side against the account's address — synthetic for
  // an anonymous account, real for an upgraded one. Possession of the key was
  // proven by matching its hash. Session cookies land on this response via the
  // SSR client.
  const supabase = await createClient();
  const minted = await mintSessionFor(supabase, email);
  if (!minted) return NextResponse.json({ status: "invalid" });

  return NextResponse.json({ status: "recovered" });
}
