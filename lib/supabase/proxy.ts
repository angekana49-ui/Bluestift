import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

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
  try {
    await supabase.auth.getUser();
  } catch (err) {
    // Transient network failure reaching Supabase (e.g. connect timeout).
    // Don't fail the whole request — the session just isn't refreshed this
    // cycle; per-page auth checks still run.
    console.error("Supabase session refresh failed in proxy:", err);
  }

  return supabaseResponse;
}
