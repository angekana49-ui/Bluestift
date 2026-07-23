import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, getAdminMembership, getStudentFollowups } from "@/lib/school-admin";

/**
 * Personalized follow-up notes on a student, shared across the class team
 * (assigned prof + admin). Access is gated by assertClassAccess. The author is
 * always the caller's active school_admins row.
 */

/** GET ?classId=&studentId= → the student's follow-up notes (team-shared). */
export async function GET(request: Request) {
  const { user, error } = await authStaff();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const studentId = url.searchParams.get("studentId");
  if (!classId || !studentId) {
    return NextResponse.json({ error: "classId and studentId are required." }, { status: 400 });
  }

  const followups = await getStudentFollowups(user.id, classId, studentId);
  if (followups === null) return NextResponse.json({ error: "Not your class." }, { status: 403 });
  return NextResponse.json({ followups });
}

/** POST { classId, studentUserId, content } → add a note. */
export async function POST(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  let body: { classId?: string; studentUserId?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const classId = (body.classId ?? "").trim();
  const studentUserId = (body.studentUserId ?? "").trim();
  const content = (body.content ?? "").trim().slice(0, 2000);
  if (!classId || !studentUserId || !content) {
    return NextResponse.json({ error: "A student and note text are required." }, { status: 400 });
  }
  if (!(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  const schools = createSchoolsAdminClient();
  // The student must actually belong to this class (guards against a foreign id).
  const { data: idRow } = await schools
    .from("student_identities")
    .select("user_id")
    .eq("class_id", classId)
    .eq("user_id", studentUserId)
    .maybeSingle();
  if (!idRow) return NextResponse.json({ error: "Unknown student for this class." }, { status: 404 });

  const { data, error: insErr } = await schools
    .from("student_followups")
    .insert({
      school_id: membership.schoolId,
      class_id: classId,
      student_user_id: studentUserId,
      author_admin_id: membership.adminId,
      content,
    })
    .select("id, created_at, updated_at")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const row = data as { id: string; created_at: string; updated_at: string };
  return NextResponse.json({ id: row.id, content, createdAt: row.created_at, updatedAt: row.updated_at });
}

/** PATCH { id, content } → edit a note (any class-team member may edit). */
export async function PATCH(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  let body: { id?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  const content = (body.content ?? "").trim().slice(0, 2000);
  if (!id || !content) return NextResponse.json({ error: "id and content are required." }, { status: 400 });

  const row = await loadNote(id, membership.schoolId);
  if (!row || !(await assertClassAccess(user.id, row.class_id))) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const schools = createSchoolsAdminClient();
  const { error: updErr } = await schools
    .from("student_followups")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

/** DELETE ?id= → remove a note. */
export async function DELETE(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const row = await loadNote(id, membership.schoolId);
  if (!row || !(await assertClassAccess(user.id, row.class_id))) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const schools = createSchoolsAdminClient();
  const { error: delErr } = await schools.from("student_followups").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

/** Load a note scoped to the caller's school (so a foreign id can't be touched). */
async function loadNote(id: string, schoolId: string) {
  const schools = createSchoolsAdminClient();
  const { data } = await schools
    .from("student_followups")
    .select("id, class_id, school_id")
    .eq("id", id)
    .maybeSingle();
  const row = data as { class_id: string; school_id: string } | null;
  return row && row.school_id === schoolId ? row : null;
}

/** Resolve the caller as school staff (admin_master or prof). */
async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const membership = await getAdminMembership(user.id);
  if (!membership) return { error: NextResponse.json({ error: "School staff only." }, { status: 403 }) } as const;
  return { user, membership, error: null } as const;
}
