import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kernel, clampHistory } from "@/lib/kernel/client";
import { invalidateProfile } from "@/lib/kernel/profile-cache";
import type { KernelMessage } from "@/lib/kernel/types";

/**
 * Grade a challenge attempt server-side (the client never sees correct answers),
 * upsert the attempt with a score, and store per-question answers.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    challengeId?: string;
    answers?: { questionId: string; choiceIndex: number }[];
  };
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

  // Authoritative correct answers (server-only).
  const { data: questions, error: qErr } = await supabase
    .schema("learning")
    .from("challenge_questions")
    .select("id, content, correct_answer")
    .eq("challenge_id", challengeId);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "challenge has no questions" }, { status: 400 });
  }

  const correctById = new Map(questions.map((q) => [q.id, q.correct_answer]));
  const total = questions.length;
  let correct = 0;
  const graded = answers
    .filter((a) => correctById.has(a.questionId))
    .map((a) => {
      const isCorrect = String(a.choiceIndex) === correctById.get(a.questionId);
      if (isCorrect) correct += 1;
      return { question_id: a.questionId, answer_text: String(a.choiceIndex), is_correct: isCorrect };
    });
  const score = total > 0 ? correct / total : 0;

  // Upsert the attempt (one per challenge+user).
  const { data: attempt, error: aErr } = await supabase
    .schema("learning")
    .from("challenge_attempts")
    .upsert(
      {
        challenge_id: challengeId,
        user_id: user.id,
        score,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "challenge_id,user_id" },
    )
    .select("id")
    .single();
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // Replace prior answers for this attempt.
  await supabase.schema("learning").from("challenge_answers").delete().eq("attempt_id", attempt.id);
  const { error: ansErr } = await supabase
    .schema("learning")
    .from("challenge_answers")
    .insert(graded.map((g) => ({ attempt_id: attempt.id, ...g })));
  if (ansErr) return NextResponse.json({ error: ansErr.message }, { status: 500 });

  // Loop Kernel: feed the challenge performance to the Kernel as a strong signal
  // (fire-and-forget — never blocks the response).
  const contentById = new Map(questions.map((q) => [q.id, q.content]));
  const convo: KernelMessage[] = [
    {
      role: "user",
      content:
        "Challenge results:\n" +
        graded
          .map(
            (g) =>
              `Q: ${contentById.get(g.question_id) ?? ""} — my answer #${g.answer_text} (${g.is_correct ? "correct" : "wrong"})`,
          )
          .join("\n") +
        `\nScore: ${correct}/${total}.`,
    },
  ];
  void kernel
    .analyze({
      user_id: user.id,
      conversation_history: clampHistory(convo),
      trigger: "post_challenge",
    })
    .then(() => invalidateProfile(user.id))
    .catch(() => {});

  return NextResponse.json({ score, correct, total });
}
