import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = (n = 8) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/** Assign a prof to a class + subject (admin_master only). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { profAdminId?: string; classId?: string; subjectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { profAdminId, classId, subjectId } = body;
  if (!profAdminId || !classId || !subjectId) {
    return NextResponse.json({ error: "profAdminId, classId and subjectId are required." }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();

  // All three must belong to this admin's school.
  const [{ data: prof }, { data: cls }, { data: subj }] = await Promise.all([
    schools.from("school_admins").select("id").eq("id", profAdminId).eq("school_id", membership.schoolId).eq("role", "prof").maybeSingle(),
    schools.from("classes").select("id").eq("id", classId).eq("school_id", membership.schoolId).maybeSingle(),
    schools.from("subjects").select("id, is_global, school_id").eq("id", subjectId).maybeSingle(),
  ]);
  const subjRow = subj as { id: string; is_global: boolean; school_id: string | null } | null;
  if (!prof) return NextResponse.json({ error: "Unknown prof." }, { status: 404 });
  if (!cls) return NextResponse.json({ error: "Unknown class." }, { status: 404 });
  if (!subjRow || (!subjRow.is_global && subjRow.school_id !== membership.schoolId)) {
    return NextResponse.json({ error: "Unknown subject." }, { status: 404 });
  }

  const { data: created, error } = await schools
    .from("assignments")
    .insert({ prof_id: profAdminId, class_id: classId, subject_id: subjectId, created_by: membership.adminId })
    .select("id")
    .single();
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return NextResponse.json({ error: "That prof is already assigned to this class + subject." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const assignmentId = (created as { id: string }).id;

  // A per-assignment access code (best-effort — the assignment itself is the point).
  try {
    await schools.from("prof_subject_codes").insert({ assignment_id: assignmentId, code: makeCode() });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ id: assignmentId, profAdminId, classId, subjectId });
}
