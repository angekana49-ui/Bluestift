import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server (Server Component / Route Handler / Server Action) Supabase client,
 * bound to the request cookies so the user session is respected under RLS.
 *
 * `cookieOptions.domain` is what lets ONE sign-in cover all three origins once
 * the products split (docs/domains.md) — without it the session cookie is
 * host-only and a visitor moving from the site to Raya arrives signed out. It
 * must match the browser client (lib/supabase/client.ts) exactly: two different
 * scopes write two different cookies of the same name, and the browser sends
 * both, which is a genuinely confusing way to be logged in and out at once.
 *
 * Unset — today, and in every preview deployment, none of which have a shared
 * parent domain — no attribute is written and the cookie stays host-only,
 * exactly as before.
 *
 * The flip side is that EVERY subdomain can then read the session. That is
 * acceptable while every subdomain is ours, and it is the reason none of them
 * may ever be pointed at a third party.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN },
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
