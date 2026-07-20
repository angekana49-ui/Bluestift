import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureRecoverable } from "@/lib/auth";

/**
 * Anonymous sign-in, done server-side so we can make the account recoverable in
 * the same request without breaking the session.
 *
 * Attaching the synthetic recovery credential (`ensureRecoverable`) REVOKES the
 * freshly created anonymous session — that's why doing it lazily on /account
 * logged brand-new users straight back out. Here we re-mint a fresh session
 * afterwards via an admin magic-link + verifyOtp (no captcha needed), and the
 * SSR client writes the valid session cookies onto this response.
 */
export async function POST(request: Request) {
  let body: { captchaToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) Create the anonymous account + session (captcha verified by Supabase).
  const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously({
    options: { captchaToken: body.captchaToken },
  });
  if (anonErr || !anon.user) {
    return NextResponse.json(
      { error: anonErr?.message ?? "Could not start an anonymous session." },
      { status: 400 },
    );
  }
  const userId = anon.user.id;

  // 2) Make it recoverable by key. Attaching the synthetic credential revokes
  //    the session we just set — so re-mint below when it did.
  const { email, attached } = await ensureRecoverable(userId);

  // 3) Re-mint a fresh session for the (now non-anonymous) account.
  if (attached && email) {
    try {
      const admin = createAdminClient();
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = link?.properties?.hashed_token;
      if (linkErr || !tokenHash) throw new Error(linkErr?.message ?? "link failed");
      const { error: otpErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });
      if (otpErr) throw otpErr;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not finalize the session." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
