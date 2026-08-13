import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Platform-operator authorization — gates the founder's own manual-ops tools
 * (billing activation today, more later) that act on ANY user/school, not just
 * the caller's own self-service scope. Backed by the existing
 * `public.users.is_founder` flag (already provisioned in the schema, already
 * `true` on exactly the founder's own account) rather than a new role/table
 * or an env allowlist — one boolean, already set, nothing to configure.
 *
 * Always resolves from the DB via the service role, never from a
 * client-supplied claim — the caller passes a userId (from their own verified
 * session), not a trust-me flag. Fails closed (false) on any read error.
 */
export async function isPlatformOwner(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("is_founder").eq("id", userId).maybeSingle();
    return (data as { is_founder: boolean } | null)?.is_founder === true;
  } catch {
    return false;
  }
}
