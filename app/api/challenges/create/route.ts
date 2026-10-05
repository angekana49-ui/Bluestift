import { limitExpensive } from "@/lib/abuse-limits";
import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/raya/llm";
import { extractFileText } from "@/lib/extract";
import { assertRoomOpen } from "@/lib/rooms";
import { resolveRayaEntitlements, gateQuota } from "@/lib/entitlements";
import { apiT } from "@/lib/i18n/server";

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

/**
 * What every non-quickcalc test must account for: the learner has a graphing
 * calculator beside them (the Maths panel) that evaluates, differentiates and
 * SOLVES equations. A question whose answer is one line typed into it measures
 * nothing — so the questions ask for what the tool cannot do for them, and the
 * bar sits a notch above the material's own level.
 */
const WITH_TOOLS =
  "The learner may use a graphing calculator that evaluates expressions, differentiates and solves equations. " +
  "So never ask for a bare computation or for solving an equation that is already written out — the tool would answer it. " +
  "Ask instead for what the tool cannot do: choosing or justifying a method, setting up the equation from a situation, " +
  "interpreting a result or a graph, spotting the error in a worked solution, comparing two approaches, multi-step problems, " +
  "and conceptual traps. Pitch the difficulty one notch above the material's own level: demanding but fair. " +
  "For multiple-choice, make every wrong option a plausible mistake a real student would make.";

/** System prompt per test kind (quiz = MCQ, exam = mixed, skills = open competency, quickcalc = mental arithmetic). */
function testSystem(kind: string, count: number): string {
  if (kind === "quickcalc")
    // Taken with the Maths panel locked (components/raya/maths-dock.tsx), so
    // here the computation IS the point.
    return `You are writing a quick mental-arithmetic test ("calcul rapide"). Produce ${count} multiple-choice ("mcq") questions, each a calculation a student should do in their head in under 30 seconds at the level of the material: arithmetic, fractions, percentages, powers, simple equations, orders of magnitude. Wrong options must be the results of typical slips (sign, priority of operations, a misplaced decimal). No calculator needed and no long statements. ${JSON_SHAPE}`;
  if (kind === "exam")
    return `You are an exam writer. Produce a complete, structured exam of ${count} questions that mixes multiple-choice ("mcq", roughly 60%) and open-response ("open", roughly 40%) and genuinely assesses understanding of the objective. ${WITH_TOOLS} ${JSON_SHAPE}`;
  if (kind === "skills")
    return `You are a competency assessor. Produce ${count} open-response ("open") questions that test the learner's ability to apply and reason about the material, each with a concise model_answer. ${WITH_TOOLS} ${JSON_SHAPE}`;
  return `You are a quiz generator. Produce ${count} multiple-choice ("mcq") questions serving the objective. ${WITH_TOOLS} ${JSON_SHAPE}`;
}

/** The stored `format` for a test kind (learning.challenges CHECK). */
function challengeFormat(kind: string): "open" | "exam" | "quickcalc" | "mcq" {
  return kind === "skills" ? "open" : kind === "exam" ? "exam" : kind === "quickcalc" ? "quickcalc" : "mcq";
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
  const limited = await limitExpensive("challengeCreate", user.id);
  if (limited) return limited;

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
  // Room only: ground the questions in the room's recent shared chat instead
  // of (or alongside) a static topic/goal — for when the discussion has
  // drifted onto something the room's fixed subject no longer names.
  const useRoomChat = (form.get("useRoomChat") as string | null) === "true";
  const file = form.get("file");
  // Test kind — chosen at creation in both rooms and solo: a quick MCQ quiz, a
  // full mixed exam (MCQ + open), or an open competency test. The leaderboard
  // scores on the attempt's fraction, so open-graded kinds rank fine too.
  const kindRaw = ((form.get("kind") as string | null) ?? "quiz").trim();
  const kind = ["quiz", "exam", "skills", "quickcalc"].includes(kindRaw) ? kindRaw : "quiz";
  const defaultCount = kind === "exam" || kind === "quickcalc" ? 10 : kind === "skills" ? 5 : 6;
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
  // A name alone is a real, specific signal ("Quiz on quantum physics") and
  // used to be silently dropped — nothing below ever read `name` again once
  // it was used for the title, so a learner who only typed a name (leaving
  // topic/goal blank) got a set of questions grounded in nothing at all. It
  // now counts here and is passed to the model below. useRoomChat is the one
  // case where there's legitimately no name/topic/goal/source YET — the room's
  // chat is the content, fetched after the membership check below — so it
  // alone is enough to pass this gate; if that chat turns out to be empty too,
  // the check right before generation catches it.
  if (!name && !goal && !topic && !source && !(roomId && useRoomChat)) {
    return NextResponse.json(
      { error: await apiT("api.provideANameAGoalA") },
      { status: 400 },
    );
  }

  // Authorize: for a room challenge the caller must be a member. Solo
  // challenges (no roomId) need no room membership.
  let roomChatContext = "";
  if (roomId) {
    const { data: membership } = await supabase
      .schema("learning")
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: await apiT("api.roomMemberOnly") }, { status: 403 });
    }
    // A timed room that has ended is read-only — no new challenges.
    const { open } = await assertRoomOpen(supabase, roomId);
    if (!open) {
      return NextResponse.json({ error: await apiT("api.roomEnded") }, { status: 403 });
    }

    // Opt-in: ground the questions in what the room has actually been
    // discussing, not just its fixed subject field, which a live conversation
    // can easily drift away from. room_messages is the room's SHARED group
    // chat (as opposed to each member's private Raya channel), so it's read
    // with the caller's own token — RLS already scopes it to members, same as
    // the room page's own read of this table.
    if (useRoomChat) {
      const { data: roomMsgs } = await supabase
        .schema("learning")
        .from("room_messages")
        .select("role, content")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(40);
      const transcript = (roomMsgs ?? [])
        .slice()
        .reverse()
        .map((m) => `${m.role === "assistant" ? "Raya" : "Student"}: ${(m.content ?? "").slice(0, 500)}`)
        .join("\n")
        .slice(0, 4000);
      if (transcript) roomChatContext = transcript;
    }
    // Free rooms allow a single challenge per room; the cap is set by the room
    // owner's plan, not the member creating the challenge. Solo self-tests
    // (no roomId) have no creation quota — only their AI analysis is gated.
    const { data: roomRow } = await supabase
      .schema("learning")
      .from("rooms")
      .select("created_by")
      .eq("id", roomId)
      .maybeSingle();
    const ownerId = (roomRow as { created_by: string | null } | null)?.created_by ?? null;
    if (ownerId) {
      const { ent, tier } = await resolveRayaEntitlements(ownerId);
      const { count: chUsed } = await supabase
        .schema("learning")
        .from("challenges")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId);
      const overCh = await gateQuota(chUsed ?? 0, ent.roomChallengesPerRoom, {
        metric: "room challenges",
        upgradeTo: "Plus",
        scope: "rooms",
        userId: user.id,
        tier,
      });
      if (overCh) return overCh;
    }
  }

  const userContent = [
    name && `Title: ${name}`,
    goal && `Objective: ${goal}`,
    topic && `Topic: ${topic}`,
    roomChatContext && `Recent room discussion (use this to tell what the group is actually working on):\n${roomChatContext}`,
    source && `Source material:\n${source}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!userContent) {
    // Only reachable when useRoomChat was the sole signal and the room chat
    // turned out empty — everything else was already rejected by the gate above.
    return NextResponse.json(
      { error: await apiT("api.theRoomHasNoRecentDiscussion") },
      { status: 400 },
    );
  }

  let questions: StoredQ[];
  try {
    const raw = await generateJson(testSystem(kind, count), userContent);
    const parsed = JSON.parse(raw) as { questions?: GenQ[] };
    questions = normaliseQuestions(Array.isArray(parsed?.questions) ? parsed.questions : []);
    if (questions.length === 0) throw new Error("no questions generated");
  } catch (e) {
    return NextResponse.json(
      { error: clientError(e, await apiT("api.generationFailed")) },
      { status: 502 },
    );
  }

  const format = challengeFormat(kind);
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
  if (cErr) return NextResponse.json({ error: clientError(cErr) }, { status: 500 });

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
  if (qErr) return NextResponse.json({ error: clientError(qErr) }, { status: 500 });

  return NextResponse.json({ id: challenge.id, questionCount: questions.length });
}
