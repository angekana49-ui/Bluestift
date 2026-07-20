import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/school-admin";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The single source of truth for the post-auth flow ORDER:
 *   sign up / login  →  onboarding  →  home (RAYA or Schools)
 * gated on the user's account_state (verification progress). Use it at every
 * entry point (login page, auth callbacks) so the sequence is always enforced.
 */

/**
 * Where an *onboarded* user lands. "RAYA or Schools, depending": if they belong
 * to a school (admin or teacher) their home is the Schools dashboard, otherwise
 * the RAYA tutor. A school-intent user who hasn't created/joined one yet has no
 * membership, so RAYA is their home until they do (they can create from there).
 */
export async function resolveHome(userId: string): Promise<string> {
  const memberships = await getMemberships(userId);
  return memberships.length > 0 ? "/school" : "/chat";
}

/**
 * The destination for a user who just authenticated (or is already signed in).
 * onboarding_pending → /onboarding; otherwise their home. This is the same gate
 * the individual app pages enforce (they each bounce onboarding_pending → /onboarding),
 * expressed once so redirects land on the RIGHT place in one hop.
 */
export async function resolvePostAuth(supabase: ServerClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("users")
    .select("account_state")
    .eq("id", userId)
    .single();
  if (!profile || profile.account_state === "onboarding_pending") return "/onboarding";
  return resolveHome(userId);
}
