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
 * Refreshes the Supabase auth session on each request and forwards updated
 * cookies. Called from the root proxy.ts (Next.js 16 file convention).
 * Keep this logic minimal per Supabase SSR guidance.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  // Bounded AND fail-soft: a transient Supabase failure or a hung connection
  // must never stall or 500 the request — the session just isn't refreshed
  // this cycle; per-page auth checks still run.
  const refresh = supabase.auth.getUser().then(
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
