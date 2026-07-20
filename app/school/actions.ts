"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { setActiveSchoolCookie } from "@/lib/school-active";

/**
 * Switch the active school (multi-school users). Validates that the caller is
 * actually a member of the target school before pointing the cookie at it, then
 * revalidates /school so the server re-renders in the new school's context.
 */
export async function setActiveSchool(schoolId: string): Promise<void> {
  if (!schoolId) throw new Error("A school is required.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const schools = createSchoolsAdminClient();
  const { data } = await schools
    .from("school_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You're not a member of that school.");

  await setActiveSchoolCookie(schoolId);
  revalidatePath("/school");
}
