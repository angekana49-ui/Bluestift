import { NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureRecoverable, hasRealEmail } from "@/lib/auth";

/**
 * Reconnect via recovery key. Two paths, chosen by the account's identity:
 * - Real linked email  -> email a fresh magic link (Supabase verifies captcha).
 * - Email-less anonymous account -> sign it straight back in with the synthetic
 *   credential attached by `ensureRecoverable` (recovery key == password). No
 *   inbox needed, which is the whole point of a key for anonymous users. The
 *   session cookies are set on this response.
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
  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "A recovery key is required." }, { status: 400 });

  // Look up the account by recovery key (service role).
  const admin = createAdminClient();
  const { data: found } = await admin
    .from("users")
    .select("id")
    .eq("recovery_code", code)
    .maybeSingle();
  if (!found) return NextResponse.json({ status: "invalid" });

  // Make sure the account actually carries a login credential (backfills any
  // pre-existing anonymous account that never got a synthetic email/password).
  await ensureRecoverable(found.id);

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

  // Synthetic (email-less) account -> sign in directly with the recovery key as
  // the password. Supabase verifies the captcha token (project has captcha
  // protection on). Session cookies land on this response.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: code,
    options: { captchaToken: body.captchaToken },
  });
  if (error) return NextResponse.json({ status: "invalid" });

  return NextResponse.json({ status: "recovered" });
}
