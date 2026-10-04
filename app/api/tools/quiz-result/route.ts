import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ageGateResponse } from "@/lib/compliance/api-gate";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { reportGradedSubmission } from "@/lib/kernel/graded";

/**
 * A finished Tools quiz, reported to the Kernel.
 *
 * Challenges and assignments already told the Kernel how a student did; a quiz
 * generated in Tools did not — it was scored in the browser and forgotten, so
 * the one place a student practises on their OWN material taught the Kernel
 * nothing. This closes that gap.
 *
 * The score is recomputed here from the stored quiz (the row's correct_index),
 * never taken from the browser: the client sends only which option was picked.
 * Answers count once each — the player locks a pick before showing the answer.
 *
 * Always 204 for a well-formed request: the student's result screen never waits
 * on, or fails because of, the Kernel.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gated = await ageGateResponse(user.id);
  if (gated) return gated;

  let body: { outputId?: unknown; picks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const outputId = typeof body.outputId === "string" ? body.outputId : "";
  const picks = Array.isArray(body.picks) ? body.picks.map((p) => (typeof p === "number" && Number.isInteger(p) ? p : -1)) : null;
  if (!outputId || !picks) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  // Re-taking the same quiz over and over is practice, but past a point it is
  // the same evidence counted again. A few reports an hour is plenty.
  if (!(await checkStrictUserRateLimit("tool_quiz_result", user.id, 10, "1 hour"))) {
    return new NextResponse(null, { status: 204 });
  }

  // RLS scopes the row to its owner; the user_id filter says so explicitly.
  const { data: output } = await supabase
    .schema("learning")
    .from("tool_outputs")
    .select("tool_type, output_content")
    .eq("id", outputId)
    .eq("user_id", user.id)
    .maybeSingle();
  const questions = (output?.output_content as { questions?: { question?: unknown; correct_index?: unknown }[] } | null)?.questions;
  if (!output || output.tool_type !== "quiz" || !Array.isArray(questions) || questions.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const graded = questions.map((q, i) => ({
    question: typeof q.question === "string" ? q.question : "",
    // An unanswered question is not evidence either way.
    score: picks[i] == null || picks[i] < 0 ? null : picks[i] === q.correct_index ? 1 : 0,
  }));
  const answered = graded.filter((g) => g.score != null && g.question);
  if (answered.length === 0) return new NextResponse(null, { status: 204 });
  const correct = answered.filter((g) => g.score === 1).length;

  after(() =>
    reportGradedSubmission({
      userId: user.id,
      questions: answered,
      resultSummary:
        "Practice quiz (generated from the student's own material in Tools):\n" +
        answered.map((g) => `Q: ${g.question} — ${g.score === 1 ? "correct" : "wrong"}`).join("\n") +
        `\nScore: ${correct}/${answered.length}.`,
      trigger: "post_challenge",
    }),
  );
  return new NextResponse(null, { status: 204 });
}
