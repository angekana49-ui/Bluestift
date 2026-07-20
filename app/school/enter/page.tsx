import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/school-admin";

/**
 * Smart Schools entry — resolves one of three paths from the user's school link:
 *  1. admin of a school  → the Schools admin dashboard  (/school renders it)
 *  2. teacher of a school → the teacher dashboard        (/school renders it)
 *     (a user can be linked to one OR MORE schools via school_admins; the /school
 *      page picks the active one + shows the switcher.)
 *  3. classic user (no link) → RAYA → create-a-school flow. The pricing shown right
 *     after school onboarding is the deterrent against casual school creation.
 */
export default async function SchoolEnterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await getMemberships(user.id);
  if (memberships.length > 0) redirect("/school");
  redirect("/profile?intent=create");
}
