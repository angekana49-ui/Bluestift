import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertAdminMaster } from "@/lib/school-admin";

type ClassRow = { id: string; school_id: string; school_year_id: string | null };

/**
 * Generate the class's access code. A class has at most ONE current code:
 * generating retires any existing (non-retired) code permanently — students who
 * already joined keep their access (it lives on student_identities, not the code).
 */
export async function POST(request: Request) {
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
  const classId = body.classId;
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: classData } = await schools
    .from("classes")
    .select("id, school_id, school_year_id")
    .eq("id", classId)
    .maybeSingle();
  const classRow = classData as ClassRow | null;
  if (!classRow) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (!(await assertAdminMaster(user.id, classRow.school_id))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  // Retire the current code + mint the new one atomically (single transaction),
  // so a double-click can never leave the class with two live codes.
  const { data, error } = await schools.rpc("regenerate_class_code", {
    p_class_id: classRow.id,
    p_school_year_id: classRow.school_year_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = ((data as { out_id: string; out_code: string; out_is_active: boolean }[] | null) ?? [])[0];
  if (!row) return NextResponse.json({ error: "Could not allocate a code." }, { status: 500 });
  return NextResponse.json({ id: row.out_id, code: row.out_code, isActive: row.out_is_active });
}

/** Activate / deactivate a code (owner only). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { codeId?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { codeId, isActive } = body;
  if (!codeId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "codeId and isActive are required." }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();
  // Resolve the code → class → school, then check admin membership.
  const { data: codeData } = await schools
    .from("class_access_codes")
    .select("id, class_id, retired_at")
    .eq("id", codeId)
    .maybeSingle();
  const codeRow = codeData as { id: string; class_id: string; retired_at: string | null } | null;
  if (!codeRow) return NextResponse.json({ error: "Code not found." }, { status: 404 });

  // A retired code was replaced by a newer one — it can never come back.
  if (isActive && codeRow.retired_at) {
    return NextResponse.json(
      { error: "This code was replaced and can no longer be reactivated." },
      { status: 409 },
    );
  }

  const { data: classData } = await schools
    .from("classes")
    .select("school_id")
    .eq("id", codeRow.class_id)
    .maybeSingle();
  const schoolId = (classData as { school_id?: string } | null)?.school_id;
  if (!schoolId || !(await assertAdminMaster(user.id, schoolId))) {
    return NextResponse.json({ error: "Not your code." }, { status: 403 });
  }

  const { error } = await schools
    .from("class_access_codes")
    .update({ is_active: isActive })
    .eq("id", codeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: codeId, isActive });
}
