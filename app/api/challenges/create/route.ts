import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/raya/llm";
import { extractFileText } from "@/lib/extract";
import { assertRoomOpen } from "@/lib/rooms";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenQ = {
  type?: string;
  question?: string;
  options?: string[];
  correct_index?: number;
  model_answer?: string;
};
type StoredQ = { type: "mcq" | "open"; content: string; options: string[]; correct_answer: string };

const JSON_SHAPE =
  'Return a JSON object exactly as {"questions":[{"type":"mcq","question":"...","options":["a","b","c","d"],"correct_index":0},{"type":"open","question":"...","model_answer":"..."}]}. ' +
  'For "mcq" give options + correct_index; for "open" give a concise ideal model_answer. Write everything in the material\'s language.';

/** System prompt per test kind (quiz = MCQ, exam = mixed, skills = open competency). */
function testSystem(kind: string, count: number): string {
  if (kind === "exam")
    return `You are an exam writer. Produce a complete, structured exam of ${count} questions that mixes multiple-choice ("mcq", roughly 60%) and open-response ("open", roughly 40%) and genuinely assesses understanding of the objective. ${JSON_SHAPE}`;
  if (kind === "skills")
    return `You are a competency assessor. Produce ${count} open-response ("open") questions that test the learner's ability to apply and reason about the material, each with a concise model_answer. ${JSON_SHAPE}`;
  return `You are a quiz generator. Produce ${count} multiple-choice ("mcq") questions serving the objective. ${JSON_SHAPE}`;
}

/** Validate + normalise the model output into storable rows. */
function normaliseQuestions(raw: GenQ[]): StoredQ[] {
  return raw
    .map((q): StoredQ | null => {
      const type = q.type === "open" ? "open" : "mcq";
      if (!q.question) return null;
      if (type === "mcq") {
        if (!Array.isArray(q.options) || q.options.length < 2) return null;
        const ci = typeof q.correct_index === "number" ? q.correct_index : 0;
        return { type, content: q.question, options: q.options, correct_answer: String(Math.max(0, Math.min(ci, q.options.length - 1))) };
      }
      return { type, content: q.question, options: [], correct_answer: (q.model_answer ?? "").toString() };
    })
    .filter((q): q is StoredQ => q !== null);
}

/**
 * Create a room challenge from a goal/topic and/or an uploaded source file.
 * Member-gated; questions (with the correct answer) are written service-trusted.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const roomIdRaw = form.get("roomId");
  const roomId =
    typeof roomIdRaw === "string" && roomIdRaw.length > 0 ? roomIdRaw : null;
  const name = ((form.get("name") as string | null) ?? "").trim().slice(0, 80);
  const topic = ((form.get("topic") as string | null) ?? "").trim().slice(0, 500);
  const goal = ((form.get("goal") as string | null) ?? "").trim().slice(0, 1000);
  const file = form.get("file");
  // Test kind — chosen at creation in both rooms and solo: a quick MCQ quiz, a
  // full mixed exam (MCQ + open), or an open competency test. The leaderboard
  // scores on the attempt's fraction, so open-graded kinds rank fine too.
  const kindRaw = ((form.get("kind") as string | null) ?? "quiz").trim();
  const kind = ["quiz", "exam", "skills"].includes(kindRaw) ? kindRaw : "quiz";
  const defaultCount = kind === "exam" ? 10 : kind === "skills" ? 5 : 6;
  const count = Math.min(Math.max(Number(form.get("count")) || defaultCount, 3), 14);

  // Optional source material from a file.
  let source = "";
  if (file instanceof File) {
    try {
      source = (await extractFileText(file)).text.slice(0, 8000);
    } catch {
      // ignore unreadable file — fall back to topic/goal
    }
  }
  if (!goal && !topic && !source) {
    return NextResponse.json(
      { error: "Provide a goal, a topic, or a source file." },
      { status: 400 },
    );
  }

  // Authorize: for a room challenge the caller must be a member. Solo
  // challenges (no roomId) need no room membership.
  if (roomId) {
    const { data: membership } = await supabase
      .schema("learning")
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "You must be a room member." }, { status: 403 });
    }
    // A timed room that has ended is read-only — no new challenges.
    const { open } = await assertRoomOpen(supabase, roomId);
    if (!open) {
      return NextResponse.json({ error: "This room has ended — it's now read-only." }, { status: 403 });
    }
  }

  const userContent = [
    goal && `Objective: ${goal}`,
    topic && `Topic: ${topic}`,
    source && `Source material:\n${source}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let questions: StoredQ[];
  try {
    const raw = await generateJson(testSystem(kind, count), userContent);
    const parsed = JSON.parse(raw) as { questions?: GenQ[] };
    questions = normaliseQuestions(Array.isArray(parsed?.questions) ? parsed.questions : []);
    if (questions.length === 0) throw new Error("no questions generated");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }

  const format = kind === "skills" ? "open" : kind === "exam" ? "exam" : "mcq";
  const admin = createAdminClient();
  const { data: challenge, error: cErr } = await admin
    .schema("learning")
    .from("challenges")
    .insert({
      room_id: roomId,
      created_by: user.id,
      title: (name || topic || goal || "Challenge").slice(0, 80),
      description: goal || null,
      format,
      scope: roomId ? "room" : "solo",
      question_count: questions.length,
      status: "active",
    })
    .select("id")
    .single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const rows = questions.map((q, i) => ({
    challenge_id: challenge.id,
    content: q.content,
    type: q.type,
    options: q.options,
    correct_answer: q.correct_answer,
    order: i,
  }));
  const { error: qErr } = await admin
    .schema("learning")
    .from("challenge_questions")
    .insert(rows);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json({ id: challenge.id, questionCount: questions.length });
}
