import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, getAdminMembership } from "@/lib/school-admin";

export const runtime = "nodejs";

/**
 * Results of one assignment: the class roster merged with each student's attempt
 * (done? score?). Gated by assertClassAccess on the assignment's class.
 * GET ?assignmentId=
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!assignmentId) return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: asgData } = await schools
    .from("resource_assignments")
    .select("id, school_id, class_id, challenge_id, title, kind, due_at")
    .eq("id", assignmentId)
    .maybeSingle();
  const asg = asgData as {
    school_id: string;
    class_id: string;
    challenge_id: string;
    title: string;
    kind: string;
    due_at: string | null;
  } | null;
  if (!asg || asg.school_id !== membership.schoolId || !(await assertClassAccess(user.id, asg.class_id))) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const [{ data: idData }, { data: classData }] = await Promise.all([
    schools.from("student_identities").select("user_id, first_name, last_name").eq("class_id", asg.class_id),
    schools.from("classes").select("name").eq("id", asg.class_id).maybeSingle(),
  ]);
  const identities = (idData as { user_id: string; first_name: string; last_name: string }[] | null) ?? [];

  const admin = createAdminClient();
  const { data: atData } = identities.length
    ? await admin
        .schema("learning")
        .from("challenge_attempts")
        .select("user_id, score, status, completed_at")
        .eq("challenge_id", asg.challenge_id)
        .in("user_id", identities.map((i) => i.user_id))
    : { data: [] as unknown };
  const attemptByUser = new Map(
    ((atData as { user_id: string; score: number | null; status: string; completed_at: string | null }[] | null) ?? []).map((a) => [a.user_id, a]),
  );

  const students = identities.map((i) => {
    const a = attemptByUser.get(i.user_id);
    const done = a?.status === "completed";
    return {
      name: `${i.first_name} ${i.last_name}`.trim(),
      done,
      score: done ? a?.score ?? null : null,
      completedAt: done ? a?.completed_at ?? null : null,
    };
  });
  const doneScores = students.filter((s) => s.done && s.score != null).map((s) => s.score as number);
  const summary = {
    assigned: students.length,
    done: students.filter((s) => s.done).length,
    avgScore: doneScores.length ? doneScores.reduce((a, b) => a + b, 0) / doneScores.length : null,
  };

  return NextResponse.json({
    title: asg.title,
    kind: asg.kind,
    className: (classData as { name: string } | null)?.name ?? "Class",
    dueAt: asg.due_at,
    students,
    summary,
  });
}
