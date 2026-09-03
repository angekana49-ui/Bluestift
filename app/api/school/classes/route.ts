import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import {
  CLASS_OVERFLOW,
  classCapacity,
  deleteBlockReason,
  getAdminMembership,
  getAdminSchool,
  isArchivedClass,
} from "@/lib/school-admin";

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

type EditableClass = {
  id: string;
  school_id: string;
  school_year_id: string | null;
  name: string;
  level: string | null;
  expected_size: number | null;
  max_overflow: number | null;
};

/**
 * Resolve a class the caller may EDIT: their own school, and the current year.
 * Returns an error response instead of the row when either fails.
 *
 * The year check is the important one. A class list changes from one year to the
 * next — classes get renamed, split, dropped — but those edits belong to the
 * live year only. An archived class still carries the students, codes and
 * insights of a year that really happened; editing it would rewrite that record.
 */
async function resolveEditableClass(
  userId: string,
  classId: string,
): Promise<{ row: EditableClass; currentYearId: string | null } | NextResponse> {
  const membership = await getAdminMembership(userId);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can edit classes." }, { status: 403 });
  }
  const school = await getAdminSchool(userId);
  if (!school) return NextResponse.json({ error: "You don't administer a school." }, { status: 403 });

  const schools = createSchoolsAdminClient();
  const { data: cls } = await schools
    .from("classes")
    .select("id, school_id, school_year_id, name, level, expected_size, max_overflow")
    .eq("id", classId)
    .maybeSingle();
  const row = cls as EditableClass | null;
  if (!row || row.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (isArchivedClass(row.school_year_id, school.currentYearId)) {
    return NextResponse.json(
      { error: "This class belongs to an archived year. Past years are a record and can't be changed." },
      { status: 409 },
    );
  }
  return { row, currentYearId: school.currentYearId };
}

/**
 * Rename a class, change its level, or set its effectif (expected_size).
 * Admin-master only, current year only. Every field is optional — only the keys
 * present in the body are written, so the size editor and the rename control can
 * each send just their own.
 *
 * A rename touches ONLY this year's row. Last year's "3e B" keeps its name, its
 * students and its codes: the two are separate rows, which is exactly why the
 * archive survives a school reorganising its classes.
 *
 * effectif: `null` clears the limit. Cheap and non-cascading — expected_size is
 * only read at join (the n+5 cap) and for display, never denormalized. Lowering
 * it never evicts anyone: the cap is enforced on new joins only.
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

  let body: { classId?: string; name?: string; level?: string | null; expectedSize?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const classId = (body.classId ?? "").trim();
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });

  const resolved = await resolveEditableClass(user.id, classId);
  if (resolved instanceof NextResponse) return resolved;
  const { row, currentYearId } = resolved;

  const schools = createSchoolsAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("name" in body) {
    const name = (body.name ?? "").trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "A class name is required." }, { status: 400 });
    if (name.toLowerCase() !== row.name.toLowerCase()) {
      // Same rule as creation: no two classes share a name in one (school, year).
      // Scoped to this year, so reusing an archived year's name is fine.
      let clashQuery = schools
        .from("classes")
        .select("id")
        .eq("school_id", row.school_id)
        .ilike("name", name)
        .neq("id", classId);
      if (currentYearId) clashQuery = clashQuery.eq("school_year_id", currentYearId);
      const { data: clash } = await clashQuery.limit(1).maybeSingle();
      if (clash) {
        return NextResponse.json(
          { error: "A class with that name already exists this year." },
          { status: 409 },
        );
      }
    }
    patch.name = name;
  }

  if ("level" in body) {
    patch.level = (body.level ?? "").trim().slice(0, 40) || null;
  }

  let expectedSize = row.expected_size;
  if ("expectedSize" in body) {
    expectedSize =
      body.expectedSize == null || !Number.isFinite(Number(body.expectedSize))
        ? null
        : Math.min(Math.max(Math.round(Number(body.expectedSize)), 1), 1000);
    patch.expected_size = expectedSize;
  }

  const { error } = await schools.from("classes").update(patch).eq("id", classId);
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return NextResponse.json(
        { error: "A class with that name already exists this year." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: classId,
    name: (patch.name as string | undefined) ?? row.name,
    level: "level" in body ? (patch.level as string | null) : row.level,
    expectedSize,
    capacity: classCapacity(expectedSize, row.max_overflow),
  });
}

/**
 * Remove a class from the current year — a class list is not the same two years
 * running, and an admin must be able to drop one the school no longer has
 * (typically a class carried over by the year rollover that doesn't exist any
 * more) without waiting a year for it to age out.
 *
 * Refused when the class holds students, and never available on an archived
 * year: those are the school's record. What goes with the row is only what is
 * meaningless without it — its access codes, its teacher assignments, its Raya
 * class instructions and its LMS mapping. Anything else still referencing it
 * makes the delete fail loudly rather than cascade through real data.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { classId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const classId = (body.classId ?? "").trim();
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });

  const resolved = await resolveEditableClass(user.id, classId);
  if (resolved instanceof NextResponse) return resolved;

  const schools = createSchoolsAdminClient();
  const { count } = await schools
    .from("student_identities")
    .select("user_id", { count: "exact", head: true })
    .eq("class_id", classId);
  const blocked = deleteBlockReason(false, count ?? 0);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  // Structure that exists only to point at this class. Ordered before the class
  // itself so a foreign key can't refuse the delete for a row we own anyway.
  for (const table of ["class_access_codes", "assignments", "class_instructions"]) {
    await schools.from(table).delete().eq("class_id", classId);
  }
  // The LMS mapping survives as an unmapped external class rather than vanishing:
  // the connection still lists it, the admin re-points it at another class.
  await schools.from("lms_class_mappings").update({ class_id: null }).eq("class_id", classId);

  const { error } = await schools.from("classes").delete().eq("id", classId);
  if (error) {
    return NextResponse.json(
      { error: "This class is still referenced elsewhere and can't be removed." },
      { status: 409 },
    );
  }
  return NextResponse.json({ id: classId, deleted: true });
}
