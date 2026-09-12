import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/database.types";
import { cookieDomainFor } from "@/lib/supabase/cookie-domain";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server (Server Component / Route Handler / Server Action) Supabase client,
 * bound to the request cookies so the user session is respected under RLS.
 *
 * `cookieOptions.domain` is what lets ONE sign-in cover all three origins
 * (docs/domains.md) — without it the session cookie is host-only and a visitor
 * moving from the site to Raya arrives signed out. It must resolve exactly as
 * in the browser client and the proxy: two different scopes write two different
 * cookies of the same name, and the browser sends both, which is a genuinely
 * confusing way to be logged in and out at once. See cookieDomainFor.
 *
 * On a host outside the configured parent (localhost, previews) no attribute is
 * written and the cookie stays host-only.
 *
 * The flip side is that EVERY subdomain can then read the session. That is
 * acceptable while every subdomain is ours, and it is the reason none of them
 * may ever be pointed at a third party.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const domain = cookieDomainFor(headerStore.get("x-forwarded-host") ?? headerStore.get("host"));

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing sessions.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
