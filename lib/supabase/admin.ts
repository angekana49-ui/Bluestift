import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * SERVER-ONLY admin client using the service_role key. Bypasses RLS.
 * Never import this into a client component. Use for privileged backend work
 * (cross-schema reads, trusted writes). The Kernel service uses its own
 * service_role key separately — see the kernel API client for calling it.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * SERVER-ONLY admin client scoped to the `schools` schema. That schema is NOT in
 * the generated Database types, so this client is intentionally untyped — callers
 * cast query results to local interfaces. Bypasses RLS (service_role); only use
 * for trusted B2B/school writes and reads.
 */
export function createSchoolsAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: "schools" } },
  );
}

/**
 * SERVER-ONLY admin client scoped to the `content` schema (public site:
 * research posts, survey, feedback, contact, newsletter). Untyped like the
 * schools client — that schema is not in the generated Database types.
 */
export function createContentAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: "content" } },
  );
}

/**
 * SERVER-ONLY admin client scoped to the `kernel` schema (read-only from the
 * app's side — the Kernel owns those tables). Untyped like the schools client.
 * Used to read cognitive state for the school dashboard.
 */
export function createKernelAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: "kernel" } },
  );
}
