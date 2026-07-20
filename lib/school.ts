import "server-only";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";

export type SchoolLinkInfo = {
  schoolName: string | null;
  className: string | null;
  firstName: string;
  lastName: string;
};

type IdentityRow = {
  first_name: string;
  last_name: string;
  school_id: string;
  class_id: string;
};

/**
 * The signed-in student's school link (school-private identity + resolved
 * school/class names), or null if not linked. Returns null on any error so the
 * profile page still renders before the `student_identities` migration is
 * applied.
 */
export async function getStudentSchoolLink(userId: string): Promise<SchoolLinkInfo | null> {
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("student_identities")
      .select("first_name, last_name, school_id, class_id")
      .eq("user_id", userId)
      .maybeSingle();
    const row = (data ?? null) as IdentityRow | null;
    if (!row) return null;

    const [{ data: s }, { data: c }] = await Promise.all([
      schools.from("schools").select("name").eq("id", row.school_id).maybeSingle(),
      schools.from("classes").select("name").eq("id", row.class_id).maybeSingle(),
    ]);
    return {
      schoolName: ((s ?? null) as { name: string } | null)?.name ?? null,
      className: ((c ?? null) as { name: string } | null)?.name ?? null,
      firstName: row.first_name,
      lastName: row.last_name,
    };
  } catch {
    return null;
  }
}
