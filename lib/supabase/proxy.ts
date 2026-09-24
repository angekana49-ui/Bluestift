import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/net/timeout";
import { conflictingSessionCookies, cookieDomainFor } from "@/lib/supabase/cookie-domain";
import type { Database } from "@/types/database.types";

/**
 * Bound on the per-request session refresh. This runs on EVERY page and API
 * request (see root proxy.ts), so a hung Supabase must not stall the app
 * forever — but abandoning a refresh is NOT free, and the bound is set by that.
 *
 * With a valid access token `getClaims()` below is local (a signature check
 * against cached keys) and returns in a few ms; this bound never comes into
 * play. It only matters when the access token has EXPIRED and a refresh is on
 * the wire. Supabase refresh tokens are single-use: the exchange rotates them
 * server-side the moment it lands. This used to be 800 ms, and giving up on an
 * exchange that took longer did not cancel it — it completed, consumed the
 * browser's refresh token, and its new cookies went nowhere because the
 * response had already been sent. The next request presented a token that was
 * already used, and the session was gone.
 *
 * That was the installed app sending people back to /login long before the
 * session timeout configured in Supabase: an icon on a home screen is opened
 * cold, hours after the last visit, so every open starts with an expired token
 * and a refresh — on a phone's connection, exactly the exchange most likely to
 * take longer than 800 ms. A browser tab rarely hit it, because the browser
 * client refreshes the token in the background while the tab is open.
 *
 * So the bound is now long enough for a slow refresh to finish and deliver its
 * cookies, and short enough that a truly hung Supabase still lets the page
 * through. A slow first paint once an hour beats a sign-out.
 */
const AUTH_REFRESH_TIMEOUT_MS = 8000;

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth session on each request and forwards the updated
 * cookies. Called from the root proxy.ts (Next.js 16 file convention). Keep
 * this logic minimal per Supabase SSR guidance.
 *
 * `requestHeaders` is a FACTORY, not a value, and that is load-bearing. The
 * caller uses it to add the per-request CSP nonce to the headers Next sees when
 * it renders — but a snapshot taken once would be stale by the time the cookie
 * handler below runs, because refreshing a session mutates `request.cookies`,
 * which is backed by the request's own `cookie` header. Calling it again after
 * that mutation is what keeps both the nonce AND the fresh session on the same
 * outgoing request.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: () => Headers,
) {
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders() } });

  // The same scope the browser and server clients write. This client used to
  // pass none, so every refresh it performed wrote a host-only duplicate of the
  // parent-domain session cookie — see cookieDomainFor.
  const domain = cookieDomainFor(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders() } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /**
   * `getClaims()`, not `getUser()`, and the difference is a network round trip
   * on every single request this proxy sees.
   *
   * `getUser()` asks the Auth server to validate the token. From here that is
   * ~370 ms, measured, and it was being paid before any page began rendering —
   * on every navigation, every API call, for every signed-in user. On the
   * connections this product is built for it is worse.
   *
   * `getClaims()` verifies the token's signature locally against the project's
   * published key. That is possible because this project signs with ES256, and
   * the key set is cached process-wide by auth-js (`GLOBAL_JWKS`), so it is
   * fetched once per server instance rather than once per request. It still
   * calls `getSession()` underneath, which is what refreshes an expiring token
   * and writes the new cookies — so the one job this block exists to do is
   * unchanged.
   *
   * It is not a weaker check. A signature verified against the issuer's public
   * key is proof the token is ours; asking the server is a second opinion about
   * the same fact. What it cannot see is a token REVOKED before it expires, and
   * that costs nothing here: this result is thrown away. Every page and route
   * runs its own `getUser()` for authorisation — this call has never been an
   * authorisation check, only a refresh.
   *
   * If the project ever moves back to a symmetric secret, `getClaims()` falls
   * back to `getUser()` internally. Correctness survives that; only the speed
   * would be lost.
   *
   * IMPORTANT: do not run code between createServerClient and this call.
   * Bounded AND fail-soft: a transient Supabase failure or a hung connection
   * must never stall or 500 the request — the session just isn't refreshed
   * this cycle; per-page auth checks still run.
   */
  const refresh = supabase.auth.getClaims().then(
    () => true,
    (err) => {
      console.error("Supabase session refresh failed in proxy:", err);
      return false;
    },
  );
  const refreshed = await withTimeout(refresh, AUTH_REFRESH_TIMEOUT_MS, false);
  if (!refreshed) {
    // Distinguish "slow" from "failed" in the logs so the timeout can be tuned.
    void refresh.then((late) => {
      if (late) console.warn(`Supabase session refresh exceeded ${AUTH_REFRESH_TIMEOUT_MS}ms in proxy`);
    });
  }

  /**
   * Browsers that met the old proxy still hold host-only copies next to the
   * parent-domain session, and nothing else will ever remove them — signOut
   * clears its own scope only, and the cookies live for 400 days. Expire the
   * host-only copies wherever both are present.
   *
   * Raw `Set-Cookie` headers, appended last, rather than `cookies.set`: the
   * cookie API holds one entry per name, so a deletion of the host-only copy
   * would overwrite a parent-domain write of the same name in this response.
   * A `Set-Cookie` without `Domain` only ever matches the host-only cookie.
   */
  if (domain) {
    for (const name of conflictingSessionCookies(request.headers.get("cookie"))) {
      supabaseResponse.headers.append(
        "set-cookie",
        `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      );
    }
  }

  return supabaseResponse;
}
