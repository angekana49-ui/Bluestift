import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, getAdminMembership } from "@/lib/school-admin";

type InstrRow = {
  id: string;
  content: string;
  is_active: boolean;
  subject_id: string | null;
};

/**
 * Teacher instructions steering RAYA for a class. Access is gated by
 * assertClassAccess (admin_master of the school, or a prof assigned to the class).
 * These feed the student RAYA prompt as bounded, guardrail-subordinate guidance.
 */

/** GET ?classId= → the class's instructions + the caller's assignable subjects. */
export async function GET(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });
  if (!(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  const schools = createSchoolsAdminClient();
  const { data: instrData } = await schools
    .from("class_instructions")
    .select("id, content, is_active, subject_id")
    .eq("class_id", classId)
    .order("updated_at", { ascending: false });
  const rows = (instrData as InstrRow[] | null) ?? [];

  // Subjects the caller may target for this class: an admin gets all school
  // subjects; a prof gets only the subjects they're assigned to on this class.
  let subjectIds: string[] | null = null; // null = all school subjects (admin)
  if (membership.role !== "admin_master") {
    const { data: asg } = await schools
      .from("assignments")
      .select("subject_id")
      .eq("prof_id", membership.adminId)
      .eq("class_id", classId);
    subjectIds = [...new Set(((asg as { subject_id: string }[] | null) ?? []).map((a) => a.subject_id))];
  }

  let subjQuery = schools
    .from("subjects")
    .select("id, name")
    .or(`school_id.eq.${membership.schoolId},is_global.eq.true`);
  if (subjectIds) subjQuery = subjQuery.in("id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: subjData } = await subjQuery;
  const subjects = ((subjData as { id: string; name: string }[] | null) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));
  const subjName = new Map(subjects.map((s) => [s.id, s.name]));

  const instructions = rows.map((r) => ({
    id: r.id,
    content: r.content,
    isActive: r.is_active,
    subjectId: r.subject_id,
    subjectName: r.subject_id ? subjName.get(r.subject_id) ?? "Subject" : null,
  }));

  return NextResponse.json({ instructions, subjects });
}

/** POST { classId, subjectId?, content } → create an instruction. */
export async function POST(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  let body: { classId?: string; subjectId?: string | null; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const classId = (body.classId ?? "").trim();
  const content = (body.content ?? "").trim().slice(0, 500);
  const subjectId = body.subjectId ? String(body.subjectId) : null;
  if (!classId || !content) {
    return NextResponse.json({ error: "A class and instruction text are required." }, { status: 400 });
  }
  if (!(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  const schools = createSchoolsAdminClient();
  // Validate the subject belongs to this school (or is global) if provided.
  if (subjectId) {
    const { data: subj } = await schools
      .from("subjects")
      .select("id, is_global, school_id")
      .eq("id", subjectId)
      .maybeSingle();
    const s = subj as { is_global: boolean; school_id: string | null } | null;
    if (!s || (!s.is_global && s.school_id !== membership.schoolId)) {
      return NextResponse.json({ error: "Unknown subject." }, { status: 404 });
    }
  }

  const { data, error: insErr } = await schools
    .from("class_instructions")
    .insert({
      school_id: membership.schoolId,
      class_id: classId,
      subject_id: subjectId,
      created_by: membership.adminId,
      content,
      is_active: true,
    })
    .select("id, content, is_active, subject_id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const row = data as InstrRow;
  return NextResponse.json({
    id: row.id,
    content: row.content,
    isActive: row.is_active,
    subjectId: row.subject_id,
  });
}

/** PATCH { id, isActive?, content? } → edit / toggle an instruction. */
export async function PATCH(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  let body: { id?: string; isActive?: boolean; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: existing } = await schools
    .from("class_instructions")
    .select("id, class_id, school_id")
    .eq("id", id)
    .maybeSingle();
  const row = existing as { class_id: string; school_id: string } | null;
  if (!row || row.school_id !== membership.schoolId || !(await assertClassAccess(user.id, row.class_id))) {
    return NextResponse.json({ error: "Instruction not found." }, { status: 404 });
  }

  const patch: { is_active?: boolean; content?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.content === "string") patch.content = body.content.trim().slice(0, 500);

  const { error: updErr } = await schools.from("class_instructions").update(patch).eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

/** DELETE ?id= → remove an instruction. */
export async function DELETE(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: existing } = await schools
    .from("class_instructions")
    .select("id, class_id, school_id")
    .eq("id", id)
    .maybeSingle();
  const row = existing as { class_id: string; school_id: string } | null;
  if (!row || row.school_id !== membership.schoolId || !(await assertClassAccess(user.id, row.class_id))) {
    return NextResponse.json({ error: "Instruction not found." }, { status: 404 });
  }

  const { error: delErr } = await schools.from("class_instructions").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

/** Resolve the caller as school staff (admin_master or prof) once. */
async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }
  const membership = await getAdminMembership(user.id);
  if (!membership) {
    return { error: NextResponse.json({ error: "School staff only." }, { status: 403 }) } as const;
  }
  return { user, membership, error: null } as const;
}
