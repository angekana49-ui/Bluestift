import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, getAdminMembership } from "@/lib/school-admin";
import { resolveSchoolEntitlements, gateQuota, startOfMonthIso } from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/server";

export const runtime = "nodejs";

type GenQuestion = { prompt?: string; choices?: string[]; answer?: string; concept?: string };
type StoredQ = { type: "mcq" | "open"; content: string; options: string[]; correct_answer: string };

/**
 * Assign a prepared resource to a class: materialize its structured questions into
 * a learning.challenges row (scope='assignment') so the class's students take it
 * through the SAME challenge engine (one-per-user attempts, MCQ + LLM open grading,
 * Kernel loop), and record the assignment (with an optional due date) in
 * schools.resource_assignments. Gated by assertClassAccess.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  let body: { resourceId?: string; classId?: string; dueAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const resourceId = (body.resourceId ?? "").trim();
  const classId = (body.classId ?? "").trim();
  if (!resourceId || !classId) {
    return NextResponse.json({ error: "A resource and a class are required." }, { status: 400 });
  }
  if (!(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  // due_at is optional; reject an unparseable / past date.
  let dueAt: string | null = null;
  if (body.dueAt) {
    const d = new Date(body.dueAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    if (d.getTime() < Date.now()) return NextResponse.json({ error: "The due date is in the past." }, { status: 400 });
    dueAt = d.toISOString();
  }

  const schools = createSchoolsAdminClient();
  const { data: resData } = await schools
    .from("teacher_resources")
    .select("id, school_id, class_id, kind, title, questions")
    .eq("id", resourceId)
    .maybeSingle();
  const resource = resData as {
    school_id: string;
    class_id: string | null;
    kind: string;
    title: string;
    questions: unknown;
  } | null;
  if (!resource || resource.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const stored = toStoredQuestions(Array.isArray(resource.questions) ? (resource.questions as GenQuestion[]) : []);
  if (stored.length === 0) {
    return NextResponse.json({ error: "This resource has no usable questions to assign." }, { status: 400 });
  }
  const format = stored.every((q) => q.type === "mcq")
    ? "mcq"
    : stored.every((q) => q.type === "open")
      ? "open"
      : "exam";

  // AI-grading quota (Standard 5 / Plus 75 / Custom ∞ per prof per month). Metered
  // HERE, once per assignment, not per student submission — an mcq-only assignment
  // needs no AI grading so it's free; an open/exam assignment will trigger LLM
  // grading for every student, so it consumes one AI-grading credit for the prof
  // who assigns it. Students are never blocked by this (see assignments/submit).
  const admin = createAdminClient();
  if (format !== "mcq") {
    const { ent, tier } = await resolveSchoolEntitlements(membership.schoolId);
    const { count: gradedUsed } = await admin
      .schema("learning")
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .eq("scope", "assignment")
      .in("format", ["open", "exam"])
      .gte("created_at", startOfMonthIso());
    const overGrading = gateQuota(gradedUsed ?? 0, ent.aiGradingPerMonthPerProf, {
      metric: "AI-graded assignments",
      period: "month",
      upgradeTo: "Plus",
      scope: "school",
      userId: membership.adminId,
      tier,
    });
    if (overGrading) return overGrading;
  }

  // Create the challenge + its questions (service-trusted; answers stay server-side).
  const { data: challenge, error: cErr } = await admin
    .schema("learning")
    .from("challenges")
    .insert({
      room_id: null,
      created_by: user.id,
      title: resource.title.slice(0, 80),
      description: null,
      format,
      scope: "assignment",
      question_count: stored.length,
      status: "active",
    })
    .select("id")
    .single();
  if (cErr || !challenge) return NextResponse.json({ error: cErr?.message ?? "Could not create the assignment." }, { status: 500 });

  const qRows = stored.map((q, i) => ({
    challenge_id: challenge.id,
    content: q.content,
    type: q.type,
    options: q.options,
    correct_answer: q.correct_answer,
    order: i,
  }));
  const { error: qErr } = await admin.schema("learning").from("challenge_questions").insert(qRows);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const { data: asg, error: aErr } = await schools
    .from("resource_assignments")
    .insert({
      school_id: membership.schoolId,
      resource_id: resourceId,
      challenge_id: challenge.id,
      class_id: classId,
      assigned_by: membership.adminId,
      title: resource.title.slice(0, 200),
      kind: resource.kind,
      due_at: dueAt,
      is_active: true,
    })
    .select("id")
    .single();
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  void captureServer(membership.adminId, "assignment_created", {
    format,
    kind: resource.kind,
    ai_graded: format !== "mcq",
    question_count: stored.length,
  });
  return NextResponse.json({ assignmentId: (asg as { id: string }).id, challengeId: challenge.id, questionCount: stored.length });
}

/** Map a resource's structured questions to storable challenge rows (derives MCQ index). */
function toStoredQuestions(raw: GenQuestion[]): StoredQ[] {
  const letters = ["a", "b", "c", "d", "e", "f"];
  return raw
    .map((q): StoredQ | null => {
      const content = typeof q.prompt === "string" ? q.prompt.trim() : "";
      if (!content) return null;
      const choices = Array.isArray(q.choices)
        ? q.choices.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
        : [];
      const answer = (q.answer ?? "").toString().trim();
      if (choices.length >= 2) {
        let idx = choices.findIndex((c) => c.toLowerCase() === answer.toLowerCase());
        if (idx < 0) {
          // Answer given as a letter ("B") or "B. text" → map the leading letter.
          const letter = answer.slice(0, 1).toLowerCase();
          const li = letters.indexOf(letter);
          if (li >= 0 && li < choices.length) idx = li;
        }
        if (idx < 0) idx = 0;
        return { type: "mcq", content, options: choices, correct_answer: String(idx) };
      }
      return { type: "open", content, options: [], correct_answer: answer };
    })
    .filter((q): q is StoredQ => q !== null);
}
