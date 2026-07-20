import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { SCHOOL_TYPES } from "@/lib/school-admin";
import { setActiveSchoolCookie } from "@/lib/school-active";
import { currentAcademicYear } from "@/lib/school-constants";

/**
 * Self-serve school creation: the signed-in user becomes the owner-admin of a new
 * school, with an active current school year. Any signed-in user can create a
 * school — including students and teachers who already belong to others
 * (multi-school). The new school becomes the caller's active school.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; countryCode?: string; schoolType?: string; city?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "A school name is required." }, { status: 400 });
  const countryCode = (body.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null;
  const rawType = (body.schoolType ?? "").trim().toLowerCase();
  const schoolType = (SCHOOL_TYPES as readonly string[]).includes(rawType) ? rawType : null;
  const city = (body.city ?? "").trim().slice(0, 80) || null;

  const schools = createSchoolsAdminClient();

  const { data: schoolIns, error: sErr } = await schools
    .from("schools")
    .insert({ name, country_code: countryCode, school_type: schoolType, city })
    .select("id")
    .single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  const schoolId = (schoolIns as { id: string }).id;

  const year = currentAcademicYear();
  const { data: yearIns, error: yErr } = await schools
    .from("school_years")
    .insert({ school_id: schoolId, ...year, is_active: true })
    .select("id")
    .single();
  if (yErr) return NextResponse.json({ error: yErr.message }, { status: 500 });
  const yearId = (yearIns as { id: string }).id;

  // The school creator is the admin_master (director/IT). Profs are added later
  // by the admin_master and scoped to their assignments.
  const { error: aErr } = await schools
    .from("school_admins")
    .insert({ user_id: user.id, school_id: schoolId, role: "admin_master" });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  await schools.from("schools").update({ current_school_year_id: yearId }).eq("id", schoolId);

  // Land the creator in the school they just made (multi-school active pointer).
  await setActiveSchoolCookie(schoolId);

  return NextResponse.json({
    schoolId,
    name,
    currentYearId: yearId,
    currentYearLabel: year.label,
    city,
    countryCode,
    schoolType,
  });
}
