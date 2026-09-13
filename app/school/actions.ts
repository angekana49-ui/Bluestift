"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { setActiveSchoolCookie } from "@/lib/school-active";
import { apiT } from "@/lib/i18n/server";

/**
 * Switch the active school (multi-school users). Validates that the caller is
 * actually a member of the target school before pointing the cookie at it, then
 * revalidates /school so the server re-renders in the new school's context.
 */
export async function setActiveSchool(schoolId: string): Promise<void> {
  if (!schoolId) throw new Error(await apiT("api.aSchoolIsRequired"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(await apiT("api.notSignedIn"));

  const schools = createSchoolsAdminClient();
  const { data } = await schools
    .from("school_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(await apiT("api.youreNotAMemberOfThat"));

  await setActiveSchoolCookie(schoolId);
  revalidatePath("/school");
}
