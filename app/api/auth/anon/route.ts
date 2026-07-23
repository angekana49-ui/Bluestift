import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminRpc } from "@/lib/supabase/admin";
import { ensureRecoverable } from "@/lib/auth";
import { clientIp } from "@/lib/request-ip";

/**
 * Per-IP anti-burst on account creation. NOT a lifetime cap — a rolling window,
 * deliberately generous so a classroom behind one NAT'd IP isn't locked out,
 * while runaway scripting (thousands of accounts) is stopped. Captcha still
 * gates every call; abandoned accounts are reaped by the anon lifecycle cron.
 * Tune with ANON_SIGNUP_MAX_PER_HOUR (default 20).
 */
const SIGNUP_MAX_PER_HOUR = Number(process.env.ANON_SIGNUP_MAX_PER_HOUR ?? "20");

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

  // 0) Per-IP anti-burst (atomic in the DB). An unidentifiable IP ("") is not
  //    blocked here — captcha remains the gate in that case.
  const ip = clientIp(request);
  const admin = createAdminClient();
  const { data: allowed, error: ipErr } = await adminRpc<boolean>(admin, "check_signup_ip", {
    p_ip: ip,
    p_max: SIGNUP_MAX_PER_HOUR,
    p_window: "60 minutes",
  });
  if (!ipErr && allowed === false) {
    return NextResponse.json(
      { error: "Too many accounts created from this network. Please try again later." },
      { status: 429 },
    );
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
