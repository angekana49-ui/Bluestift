import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/net/timeout";
import type { Database } from "@/types/database.types";

/**
 * Hard bound on the per-request session refresh. This runs on EVERY page and
 * API request (see root proxy.ts), so a slow Supabase must never stall the
 * whole app: past the deadline we stop waiting and let the request through —
 * pages/routes run their own getUser(), the only cost is a cookie refresh
 * skipped this cycle. Start generous; tighten after watching Vercel logs.
 */
const AUTH_REFRESH_TIMEOUT_MS = 800;

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

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  return supabaseResponse;
}
