import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/raya/llm";
import { kernel, clampHistory } from "@/lib/kernel/client";
import { invalidateProfile } from "@/lib/kernel/profile-cache";
import type { KernelMessage } from "@/lib/kernel/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type OpenItem = { questionId: string; question: string; model: string; answer: string };

/** Batch-grade open answers against their model answers (mirror of the challenge grader). */
async function gradeOpen(items: OpenItem[]): Promise<Map<string, { score: number | null; feedback: string }>> {
  const out = new Map<string, { score: number | null; feedback: string }>();
  if (items.length === 0) return out;
  try {
    const payload = items
      .map((it, i) => `Q${i + 1}: ${it.question}\nModel answer: ${it.model || "(none provided)"}\nStudent answer: ${it.answer || "(blank)"}`)
      .join("\n\n");
    const raw = await generateJson(
      "You are a fair grader. For each item, grade the student answer against the model answer and the question. " +
        'Return JSON exactly as {"grades":[{"score":0.0,"feedback":"..."}]}, one entry per item IN THE SAME ORDER. ' +
        "score is 0..1 (partial credit allowed); feedback is one or two sentences in the student answer's language saying what was right and what was missing.",
      payload,
    );
    const parsed = JSON.parse(raw) as { grades?: { score?: number; feedback?: string }[] };
    const grades = Array.isArray(parsed?.grades) ? parsed.grades : [];
    items.forEach((it, i) => {
      const g = grades[i];
      out.set(it.questionId, { score: typeof g?.score === "number" ? clamp01(g.score) : null, feedback: g?.feedback ?? "" });
    });
  } catch {
    for (const it of items) out.set(it.questionId, { score: null, feedback: "Automatic grading was unavailable for this answer." });
  }
  return out;
}

type QResult = {
  questionId: string;
  type: "mcq" | "open";
  isCorrect: boolean;
  score: number | null;
  feedback: string;
  correctIndex: number | null;
};

/**
 * Submit a teacher assignment. Unlike a solo/room challenge this is a one-shot,
 * class-gated exam: the caller must be in the assigned class, the deadline must not
 * have passed, and a completed attempt blocks a re-submit. Grading itself reuses the
 * same MCQ-by-index + LLM-open approach and feeds the Kernel.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { challengeId?: string; answers?: { questionId: string; choiceIndex?: number; text?: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const challengeId = body.challengeId;
  const answers = body.answers ?? [];
  if (!challengeId || answers.length === 0) {
    return NextResponse.json({ error: "challengeId and answers required" }, { status: 400 });
  }

  // Gate: the caller must be in the class this challenge is assigned to, before the deadline.
  const schools = createSchoolsAdminClient();
  const [{ data: asgData }, { data: idData }] = await Promise.all([
    schools.from("resource_assignments").select("class_id, due_at").eq("challenge_id", challengeId).eq("is_active", true).maybeSingle(),
    schools.from("student_identities").select("class_id").eq("user_id", user.id),
  ]);
  const asg = asgData as { class_id: string; due_at: string | null } | null;
  const myClasses = new Set(((idData as { class_id: string | null }[] | null) ?? []).map((r) => r.class_id).filter(Boolean) as string[]);
  if (!asg || !myClasses.has(asg.class_id)) {
    return NextResponse.json({ error: "This assignment isn't for you." }, { status: 403 });
  }
  if (asg.due_at && new Date(asg.due_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "The deadline for this assignment has passed." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("learning")
    .from("challenge_attempts")
    .select("status")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if ((existing as { status: string } | null)?.status === "completed") {
    return NextResponse.json({ error: "You've already submitted this assignment." }, { status: 409 });
  }

  // Authoritative questions (server-only — the client never receives the answers).
  const { data: questions, error: qErr } = await admin
    .schema("learning")
    .from("challenge_questions")
    .select("id, content, type, correct_answer")
    .eq("challenge_id", challengeId);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "assignment has no questions" }, { status: 400 });
  }

  const answerById = new Map(answers.map((a) => [a.questionId, a]));
  const openItems: OpenItem[] = questions
    .filter((q) => q.type === "open")
    .map((q) => ({ questionId: q.id, question: q.content ?? "", model: q.correct_answer ?? "", answer: (answerById.get(q.id)?.text ?? "").toString() }));
  const openGrades = await gradeOpen(openItems);

  const results: QResult[] = questions.map((q) => {
    const a = answerById.get(q.id);
    if (q.type === "open") {
      const g = openGrades.get(q.id) ?? { score: null, feedback: "" };
      return { questionId: q.id, type: "open", isCorrect: (g.score ?? 0) >= 0.5, score: g.score, feedback: g.feedback, correctIndex: null };
    }
    const correctIndex = Number(q.correct_answer);
    const isCorrect = a?.choiceIndex != null && String(a.choiceIndex) === q.correct_answer;
    return { questionId: q.id, type: "mcq", isCorrect, score: isCorrect ? 1 : 0, feedback: "", correctIndex: Number.isFinite(correctIndex) ? correctIndex : null };
  });

  const total = questions.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const scored = results.map((r) => r.score).filter((s): s is number => s != null);
  const score = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;

  const { data: attempt, error: aErr } = await admin
    .schema("learning")
    .from("challenge_attempts")
    .upsert(
      { challenge_id: challengeId, user_id: user.id, score, status: "completed", completed_at: new Date().toISOString() },
      { onConflict: "challenge_id,user_id" },
    )
    .select("id")
    .single();
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  await admin.schema("learning").from("challenge_answers").delete().eq("attempt_id", attempt.id);
  const answerRows = results.map((r) => {
    const a = answerById.get(r.questionId);
    return {
      attempt_id: attempt.id,
      question_id: r.questionId,
      answer_text: r.type === "open" ? (a?.text ?? "") : a?.choiceIndex != null ? String(a.choiceIndex) : "",
      is_correct: r.isCorrect,
      raya_feedback: r.feedback || null,
    };
  });
  const { error: ansErr } = await admin.schema("learning").from("challenge_answers").insert(answerRows);
  if (ansErr) return NextResponse.json({ error: ansErr.message }, { status: 500 });

  // Feed the Kernel (fire-and-forget) — assignment performance is a strong signal.
  const contentById = new Map(questions.map((q) => [q.id, q.content ?? ""]));
  const convo: KernelMessage[] = [
    {
      role: "user",
      content:
        "Assignment results:\n" +
        results.map((r) => `Q: ${contentById.get(r.questionId)} — ${r.isCorrect ? "correct" : "wrong"}`).join("\n") +
        `\nScore: ${correct}/${total}.`,
    },
  ];
  void kernel
    .analyze({ user_id: user.id, conversation_history: clampHistory(convo), trigger: "post_challenge" })
    .then(() => invalidateProfile(user.id))
    .catch(() => {});

  return NextResponse.json({ score, correct, total, results });
}
