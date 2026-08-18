import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Browser (client component) Supabase client.
 * Uses the publishable/anon key — RLS enforces access.
 *
 * The return is asserted to the canonical `SupabaseClient<Database>` because
 * @supabase/ssr@0.6.1 ships a `SupabaseClient` generic with fewer type params
 * than @supabase/supabase-js@2.110 (arity mismatch), which otherwise collapses
 * write types to `never`. Drop the assertion once @supabase/ssr is upgraded.
 *
 * `cookieOptions.domain` MUST stay identical to the server client's
 * (lib/supabase/server.ts) — see the reasoning there. Two scopes for one cookie
 * name is the failure mode worth avoiding, so both read the same env var.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN } },
  ) as unknown as SupabaseClient<Database>;
}
