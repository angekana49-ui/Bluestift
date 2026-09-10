import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
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
  // NO verifyTurnstile() here, and that is deliberate: a Turnstile token is
  // SINGLE-USE. Verifying it ourselves redeems it at Cloudflare, and the
  // signInAnonymously below hands the same token to Supabase, which redeems it
  // a second time — Cloudflare answers `timeout-or-duplicate` and the sign-in
  // fails. The bug was invisible for as long as TURNSTILE_SECRET_KEY was unset
  // in production (verifyTurnstile then returned false without ever calling
  // Cloudflare, so the token survived to Supabase and only OUR check failed);
  // setting the secret correctly is what surfaced it.
  //
  // So Supabase is the single redeemer on this path. The captcha still gates
  // the thing that matters — no account is created without it, because it is
  // signInAnonymously itself that validates the token.
  if (!body.captchaToken) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  // 0) Per-IP anti-burst (atomic in the DB). An unidentifiable IP ("") is not
  //    blocked here — captcha remains the gate in that case.
  //    This now runs BEFORE the captcha is validated (Supabase validates it one
  //    step below), so a request with a junk token can still tick this counter.
  //    Accepted: it is a cheap DB call and is itself the rate limiter, while the
  //    account creation behind it stays captcha-gated.
  const ip = clientIp(request);
  const admin = createAdminClient();
  const { data: allowed, error: ipErr } = await adminRpc<boolean>(admin, "check_signup_ip", {
    p_ip: ip,
    p_max: SIGNUP_MAX_PER_HOUR,
    p_window: "60 minutes",
  });
  if (ipErr || allowed !== true) {
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable. Please try again later." },
      { status: ipErr ? 503 : 429 },
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
        { error: clientError(e, "Could not finalize the session.") },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
