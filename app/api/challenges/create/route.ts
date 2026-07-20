import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/raya/llm";
import { extractFileText } from "@/lib/extract";
import { assertRoomOpen } from "@/lib/rooms";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenQuestion = { question: string; options: string[]; correct_index: number };

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
  const count = Math.min(Math.max(Number(form.get("count")) || 6, 3), 10);

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

  let questions: GenQuestion[];
  try {
    const raw = await generateJson(
      `You are a quiz generator. Produce ${count} multiple-choice questions that serve the stated objective, in the material's language. Return JSON exactly as: ` +
        '{"questions":[{"question":"...","options":["a","b","c","d"],"correct_index":0}]}',
      userContent,
    );
    const parsed = JSON.parse(raw) as { questions?: GenQuestion[] };
    questions = (Array.isArray(parsed?.questions) ? parsed.questions : []).filter(
      (q) => q?.question && Array.isArray(q.options) && q.options.length >= 2,
    );
    if (questions.length === 0) throw new Error("no questions generated");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }

  const admin = createAdminClient();
  const { data: challenge, error: cErr } = await admin
    .schema("learning")
    .from("challenges")
    .insert({
      room_id: roomId,
      created_by: user.id,
      title: (name || topic || goal || "Challenge").slice(0, 80),
      description: goal || null,
      format: "mcq",
      scope: roomId ? "room" : "solo",
      question_count: questions.length,
      status: "active",
    })
    .select("id")
    .single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const rows = questions.map((q, i) => ({
    challenge_id: challenge.id,
    content: q.question,
    type: "mcq",
    options: q.options,
    correct_answer: String(q.correct_index),
    order: i,
  }));
  const { error: qErr } = await admin
    .schema("learning")
    .from("challenge_questions")
    .insert(rows);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json({ id: challenge.id, questionCount: questions.length });
}
