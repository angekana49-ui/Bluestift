/**
 * SERVER-ONLY Cloudflare Turnstile verification for our own public endpoints
 * (survey, wall posts, newsletter, contact, feedback, contributions).
 * Supabase Auth verifies its own captcha tokens; this is for routes we own.
 *
 * Local development may omit TURNSTILE_SECRET_KEY. Production never does: a
 * missing verifier must close public write endpoints rather than silently
 * turning a deployment misconfiguration into an anti-spam bypass.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
