import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmAccountUpgrade } from "@/lib/account-upgrade";
import { resolvePostAuth } from "@/lib/routing";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

/**
 * Use an upgrade link: the address replaces the account's synthetic one, and
 * the device that opened the link is signed in (cookies on this response).
 *
 * POST only, pressed from /upgrade/confirm. The link itself is a GET to that
 * page, which changes nothing, so a mail scanner opening it uses nothing up.
 * No session is required: the token is the proof, and the person may well be
 * on their phone while the account was opened on a school computer.
 */
export async function POST(request: Request) {
  // A token is 256 random bits, so this is not what keeps it from being
  // guessed; it keeps the endpoint from being hammered.
  if (!(await checkRateLimit("account_upgrade_confirm", clientIp(request), 30, "15 minutes"))) {
    return NextResponse.json({ code: "rate_limited" }, { status: 429 });
  }

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = await createClient();
  const result = await confirmAccountUpgrade({
    supabase,
    token: typeof body.token === "string" ? body.token : "",
  });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: result.status });

  // Onboarding if it isn't finished, their home otherwise. Without a session on
  // this device there is nowhere to send them but the sign-in page.
  const dest = result.signedIn ? await resolvePostAuth(supabase, result.userId) : "/login";
  return NextResponse.json({ ok: true, email: result.email, signedIn: result.signedIn, dest });
}
