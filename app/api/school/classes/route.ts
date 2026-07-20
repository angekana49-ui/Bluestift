import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { CLASS_OVERFLOW, classCapacity, getAdminMembership, getAdminSchool } from "@/lib/school-admin";

/** Create a class under the admin's school, tied to its current school year. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can add classes." }, { status: 403 });
  }
  const school = await getAdminSchool(user.id);
  if (!school) return NextResponse.json({ error: "You don't administer a school." }, { status: 403 });

  let body: { name?: string; level?: string; expectedSize?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "A class name is required." }, { status: 400 });
  const level = (body.level ?? "").trim().slice(0, 40) || null;

  // Effectif (n): the school-set class size. The hard cap is n + CLASS_OVERFLOW.
  // Left null when unset → no cap enforced on join.
  const expectedSize =
    body.expectedSize == null || !Number.isFinite(Number(body.expectedSize))
      ? null
      : Math.min(Math.max(Math.round(Number(body.expectedSize)), 1), 1000);

  const schools = createSchoolsAdminClient();

  // No two classes with the same name in the same school + year. (A DB unique
  // index enforces this too; this check gives a friendly message.)
  const { data: clash } = await schools
    .from("classes")
    .select("id")
    .eq("school_id", school.id)
    .eq("school_year_id", school.currentYearId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: "A class with that name already exists this year." },
      { status: 409 },
    );
  }

  const { data, error } = await schools
    .from("classes")
    .insert({
      school_id: school.id,
      school_year_id: school.currentYearId,
      name,
      level,
      expected_size: expectedSize,
      max_overflow: CLASS_OVERFLOW,
    })
    .select("id, name, level, school_year_id, expected_size, max_overflow")
    .single();
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return NextResponse.json(
        { error: "A class with that name already exists this year." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as {
    id: string;
    name: string;
    level: string | null;
    school_year_id: string | null;
    expected_size: number | null;
    max_overflow: number | null;
  };
  return NextResponse.json({
    id: row.id,
    name: row.name,
    level: row.level,
    schoolYearId: row.school_year_id,
    studentCount: 0,
    expectedSize: row.expected_size,
    capacity: classCapacity(row.expected_size, row.max_overflow),
    codes: [],
  });
}

/**
 * Update a class's effectif (expected_size). Admin-master only. `null` clears the
 * limit. Cheap and non-cascading — expected_size is only read at join (the n+5
 * cap) and for display, never denormalized. Lowering it never evicts anyone:
 * the cap is enforced on new joins only, so existing students stay.
 *
 * NOTE (billing): the per-class n+5 is a pedagogical guardrail, NOT a seat/revenue
 * control — 5 extra seats × many classes would leak paid capacity. Billing must
 * gate the school-wide total against the plan's seats; wire that with the billing
 * epic (schools.subscription_tier / class_enrollments).
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can edit classes." }, { status: 403 });
  }

  let body: { classId?: string; expectedSize?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const classId = (body.classId ?? "").trim();
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });

  const expectedSize =
    body.expectedSize == null || !Number.isFinite(Number(body.expectedSize))
      ? null
      : Math.min(Math.max(Math.round(Number(body.expectedSize)), 1), 1000);

  const schools = createSchoolsAdminClient();
  // The class must belong to the admin's own school.
  const { data: cls } = await schools
    .from("classes")
    .select("id, school_id, max_overflow")
    .eq("id", classId)
    .maybeSingle();
  const clsRow = cls as { id: string; school_id: string; max_overflow: number | null } | null;
  if (!clsRow || clsRow.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { error } = await schools
    .from("classes")
    .update({ expected_size: expectedSize, updated_at: new Date().toISOString() })
    .eq("id", classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: classId,
    expectedSize,
    capacity: classCapacity(expectedSize, clsRow.max_overflow),
  });
}
