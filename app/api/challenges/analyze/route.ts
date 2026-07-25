import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rayaComplete } from "@/lib/raya/llm";
import { resolveRayaEntitlements, gateFeature } from "@/lib/entitlements";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are a study coach analysing a test attempt. Using ONLY the data below,
write a concise, encouraging analysis in the student's language, as Markdown with this structure:
# Analysis
## Overview  (the score and a one-line read on it)
## What went well
## Gaps & mistakes  (reference specific questions and why the answer fell short)
## Recommendations  (2-4 concrete next steps)
Never invent questions or answers that aren't in the data.`;

/**
 * On-demand analysis of the signed-in user's latest attempt at a challenge:
 * gathers the graded answers (right/wrong + per-question feedback) and asks the
 * LLM for a narrative synthesis. Returned as Markdown for the branded reader.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // AI analysis of a self-test attempt is a Plus+ feature (Free gets the raw score).
  const { ent, tier } = await resolveRayaEntitlements(user.id);
  const denied = gateFeature(ent.selfTestAiAnalysis, {
    feature: "self_test_ai_analysis",
    upgradeTo: "Plus",
    scope: "challenges",
    userId: user.id,
    tier,
  });
  if (denied) return denied;

  let body: { challengeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const challengeId = body.challengeId;
  if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });

  const [{ data: challenge }, { data: attempt }, { data: questions }] = await Promise.all([
    supabase.schema("learning").from("challenges").select("title").eq("id", challengeId).maybeSingle(),
    supabase
      .schema("learning")
      .from("challenge_attempts")
      .select("id, score")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .schema("learning")
      .from("challenge_questions")
      .select("id, content, type, options, correct_answer, order")
      .eq("challenge_id", challengeId)
      .order("order", { ascending: true }),
  ]);
  if (!attempt) return NextResponse.json({ error: "No attempt to analyse yet." }, { status: 404 });

  const { data: ans } = await supabase
    .schema("learning")
    .from("challenge_answers")
    .select("question_id, answer_text, is_correct, raya_feedback")
    .eq("attempt_id", attempt.id);
  const ansById = new Map((ans ?? []).map((a) => [a.question_id, a]));

  const lines = (questions ?? []).map((q, i) => {
    const a = ansById.get(q.id);
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    let mine = a?.answer_text ?? "(blank)";
    let expected = q.correct_answer ?? "";
    if (q.type === "mcq") {
      const mi = Number(a?.answer_text);
      const ci = Number(q.correct_answer);
      mine = Number.isFinite(mi) ? opts[mi] ?? `#${mi}` : "(blank)";
      expected = Number.isFinite(ci) ? opts[ci] ?? `#${ci}` : "";
    }
    return (
      `Q${i + 1} [${q.type}] ${q.content}\n` +
      `- Student answer: ${mine} (${a?.is_correct ? "correct" : "wrong"})\n` +
      (q.type === "mcq" ? `- Correct answer: ${expected}\n` : `- Model answer: ${expected}\n`) +
      (a?.raya_feedback ? `- Feedback: ${a.raya_feedback}\n` : "")
    );
  });

  const scorePct = attempt.score != null ? Math.round(attempt.score * 100) : 0;
  const data = `Test: ${challenge?.title ?? "Self-test"}\nScore: ${scorePct}%\n\n${lines.join("\n")}`;

  let analysis: string;
  try {
    const out = await rayaComplete([
      { role: "system", content: SYSTEM },
      { role: "user", content: data },
    ]);
    analysis = out.text.trim();
    if (!analysis) throw new Error("empty analysis");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 502 });
  }

  return NextResponse.json({ title: `${challenge?.title ?? "Self-test"} — analysis`, analysis });
}
