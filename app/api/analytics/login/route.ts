import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";

/**
 * `logged_in`, emitted on the server.
 *
 * A sign-in happens in several places — the password form in the browser, the
 * magic-link and OAuth callbacks, a recovery key — and none of them is a single
 * server request we could count. So the browser pings this route once a session
 * appears, and this route believes only the session token: its `amr` claim says
 * HOW the user authenticated and WHEN. The event goes out only if that moment
 * is a few minutes old, is dated to it, and carries a uuid derived from the
 * session and that moment — so a second ping, another tab, or a reload days
 * later is the same event, which PostHog keeps once.
 *
 * Anonymous sessions are not logins (they are how an account starts), and a
 * session minted within minutes of the account's creation is flagged
 * `new_account`, so "logins" can be read without the sign-ups in them.
 *
 * Always answers 204, like /api/analytics/onboarding: a caller must not be able
 * to probe consent or age through it.
 */

/** How long after authenticating the sign-in still counts as "just now". */
const FRESH_MS = 10 * 60 * 1000;

const done = () => new NextResponse(null, { status: 204 });

type Amr = { method?: unknown; timestamp?: unknown };

/** A uuid PostHog accepts, stable for one authentication of one session. */
function eventUuid(sessionId: string, at: number): string {
  const h = createHash("sha256").update(`logged_in:${sessionId}:${at}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims || claims.is_anonymous) return done();

    // The latest authentication on this session (a step-up adds an entry).
    const latest = ((claims.amr ?? []) as Amr[])
      .filter((a): a is { method: string; timestamp: number } =>
        typeof a === "object" && typeof a.method === "string" && typeof a.timestamp === "number",
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latest) return done();
    const at = latest.timestamp * 1000;
    if (Date.now() - at > FRESH_MS) return done();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== claims.sub) return done();
    const createdAt = Date.parse(user.created_at);

    await captureServer(
      user.id,
      "logged_in",
      {
        // An AMR method name (password, otp, oauth…), not anything the user typed.
        method: latest.method,
        new_account: Number.isFinite(createdAt) && at - createdAt < FRESH_MS,
      },
      { timestamp: new Date(at), uuid: eventUuid(String(claims.session_id ?? user.id), latest.timestamp) },
    );
  } catch {
    // analytics never fails a request
  }
  return done();
}
