import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type AssignmentRow = {
  id: string;
  challenge_id: string;
  class_id: string;
  title: string;
  kind: string;
  due_at: string | null;
};

/**
 * Student view of teacher-assigned exams/exercises. Resolves the student's classes
 * (service role — a student has no RLS on the schools schema), lists the active
 * assignments for those classes, and merges the student's own attempt. With
 * ?challengeId= it returns the questions to take (answers stripped), gated so the
 * student is in the assigned class, the deadline hasn't passed, and they haven't
 * already submitted (assignments are one-shot).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const classIds = await studentClassIds(user.id);
  const challengeId = new URL(request.url).searchParams.get("challengeId");

  if (challengeId) return questionsForTaking(user.id, challengeId, classIds);

  if (classIds.size === 0) return NextResponse.json({ assignments: [] });

  const schools = createSchoolsAdminClient();
  const [{ data: asgData }, { data: classData }] = await Promise.all([
    schools
      .from("resource_assignments")
      .select("id, challenge_id, class_id, title, kind, due_at")
      .in("class_id", [...classIds])
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    schools.from("classes").select("id, name").in("id", [...classIds]),
  ]);
  const rows = (asgData as AssignmentRow[] | null) ?? [];
  if (rows.length === 0) return NextResponse.json({ assignments: [] });

  const classNameById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));

  // Challenge meta + the student's own attempts, in one round-trip each.
  const admin = createAdminClient();
  const challengeIds = rows.map((r) => r.challenge_id);
  const [{ data: chData }, { data: atData }] = await Promise.all([
    admin.schema("learning").from("challenges").select("id, question_count").in("id", challengeIds),
    admin
      .schema("learning")
      .from("challenge_attempts")
      .select("challenge_id, score, status, completed_at")
      .eq("user_id", user.id)
      .in("challenge_id", challengeIds),
  ]);
  const qCountById = new Map(((chData as { id: string; question_count: number | null }[] | null) ?? []).map((c) => [c.id, c.question_count]));
  const attemptByChallenge = new Map(
    ((atData as { challenge_id: string; score: number | null; status: string; completed_at: string | null }[] | null) ?? []).map((a) => [a.challenge_id, a]),
  );

  const now = Date.now();
  const assignments = rows.map((r) => {
    const at = attemptByChallenge.get(r.challenge_id);
    const done = at?.status === "completed";
    const pastDue = r.due_at != null && new Date(r.due_at).getTime() < now;
    return {
      assignmentId: r.id,
      challengeId: r.challenge_id,
      title: r.title,
      kind: r.kind,
      className: classNameById.get(r.class_id) ?? "Class",
      dueAt: r.due_at,
      questionCount: qCountById.get(r.challenge_id) ?? null,
      pastDue,
      done,
      score: done ? at?.score ?? null : null,
      completedAt: done ? at?.completed_at ?? null : null,
    };
  });

  return NextResponse.json({ assignments });
}

/** Questions for taking, with correct answers stripped and one-shot/deadline gates. */
async function questionsForTaking(userId: string, challengeId: string, classIds: Set<string>) {
  const schools = createSchoolsAdminClient();
  const { data: asgData } = await schools
    .from("resource_assignments")
    .select("id, class_id, due_at")
    .eq("challenge_id", challengeId)
    .eq("is_active", true)
    .maybeSingle();
  const asg = asgData as { class_id: string; due_at: string | null } | null;
  if (!asg || !classIds.has(asg.class_id)) {
    return NextResponse.json({ error: "This assignment isn't for you." }, { status: 403 });
  }
  if (asg.due_at && new Date(asg.due_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "The deadline for this assignment has passed." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: at } = await admin
    .schema("learning")
    .from("challenge_attempts")
    .select("status")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if ((at as { status: string } | null)?.status === "completed") {
    return NextResponse.json({ error: "You've already submitted this assignment." }, { status: 409 });
  }

  const { data: qData } = await admin
    .schema("learning")
    .from("challenge_questions")
    .select("id, content, type, options, order")
    .eq("challenge_id", challengeId)
    .order("order", { ascending: true });
  const questions = ((qData as { id: string; content: string | null; type: string; options: string[] | null }[] | null) ?? []).map((q) => ({
    id: q.id,
    type: q.type === "open" ? "open" : "mcq",
    question: q.content ?? "",
    options: q.options ?? [],
  }));
  return NextResponse.json({ questions });
}

/** The class ids a student belongs to (service role — no student RLS on schools). */
async function studentClassIds(userId: string): Promise<Set<string>> {
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools.from("student_identities").select("class_id").eq("user_id", userId);
    return new Set(((data as { class_id: string | null }[] | null) ?? []).map((r) => r.class_id).filter(Boolean) as string[]);
  } catch {
    return new Set();
  }
}
