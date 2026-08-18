import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentRecommendations } from "@/lib/school-admin";
import { buildRayaMessages } from "@/lib/raya/prompt";
import { rayaStream, type TokenUsage } from "@/lib/raya/llm";
import { routeTier } from "@/lib/raya/routing";
import { kernel, clampHistory } from "@/lib/kernel/client";
import { assertRoomOpen } from "@/lib/rooms";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability/report";
import { persistAndGather, linkAttachments, replayReply } from "@/lib/raya/chat-context";
import {
  getCognitiveContext,
  invalidateProfile,
  setLatestAnalysis,
} from "@/lib/kernel/profile-cache";
import type { KernelMessage } from "@/lib/kernel/types";

// Streaming LLM turn: give the function room to finish long replies on Vercel.
export const maxDuration = 60;

/**
 * Daily ABUSE ceiling per user — not a plan quota. The Free card promises
 * "Unlimited AI tutor chat", and this does not take that back: it sits where
 * the existing 30/minute limiter sits, one category up.
 *
 * The arithmetic: a student in an intense session sends a message every 30
 * seconds for three straight hours — 360 turns. 600 is comfortably past any
 * human day and still bounds the two things that have no ceiling at all
 * otherwise, a client stuck in a retry loop and one credential being shared
 * around a class. Without it the 30/minute limiter alone permits 43,200 paid
 * LLM calls per user per day.
 */
const CHAT_TURNS_PER_DAY = 600;

/**
 * Light EMT classification of a Raya reply (kernel-handoff §7). Heuristic, not a
 * model call: a reply whose final sentence is a question is throwing the ball
 * back to the student (PUMP); otherwise Raya is stating something (ASSERTION).
 * Nullable + soft — the kernel treats emt_level as a weak signal.
 */
function classifyEmt(reply: string): "pump" | "assertion" | null {
  const trimmed = reply.trim();
  if (!trimmed) return null;
  const lastSentence = trimmed.split(/(?<=[.!?])\s+/).pop() ?? trimmed;
  return lastSentence.trim().endsWith("?") ? "pump" : "assertion";
}

/** School + teacher recommendations for the student, as a bounded prompt block. */
async function teacherInstructionsFor(userId: string): Promise<string> {
  try {
    const recs = await getStudentRecommendations(userId);
    return recs
      .map((r) => `- (${r.source}) ${r.content}`)
      .join("\n")
      .slice(0, 1800);
  } catch {
    // Soft guidance only — a hiccup here must never cost the turn.
    return "";
  }
}

/**
 * One Raya turn, STREAMED for minimal perceived latency. The pre-LLM Supabase
 * work runs in two parallel waves (independent context first, then everything
 * keyed on the conversation) instead of the old six serial round trips — under
 * network latency this is the difference between first token at ~1s and ~3s+.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    conversationId?: string | null;
    content?: string;
    roomId?: string | null;
    responseTimeMs?: number | null;
    fileIds?: string[];
    clientMsgId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim().slice(0, 4000);
  if (!content) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  // Documents staged in the composer, to be attached to this message.
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string").slice(0, 10)
    : [];

  // Student "think time" between Raya's last reply and this message — a genuine
  // cognitive signal (very fast answers can indicate passive dependency).
  // Clamped: ignore negatives, cap at 1h to drop tab-left-open outliers.
  const responseTimeMs =
    typeof body.responseTimeMs === "number" && body.responseTimeMs >= 0
      ? Math.min(Math.round(body.responseTimeMs), 60 * 60 * 1000)
      : null;

  // When roomId is set, this is the private student<->Raya channel scoped to
  // that room — Raya draws on the room's shared documents.
  const roomId = typeof body.roomId === "string" && body.roomId ? body.roomId : null;

  // Idempotency key for retries (see lib/raya/chat-context.ts).
  const clientMsgId =
    typeof body.clientMsgId === "string" ? body.clientMsgId.slice(0, 128) : null;

  // ── Wave 1: everything independent of the conversation, in parallel ──
  // Anti-abuse rate-limit (user-keyed, fails open — see lib/rate-limit.ts),
  // room-open check, cognitive profile + alerts (bounded L1/L2 cache), and
  // the teacher guidance block (solo chat only — a room mixes classes).
  // Who the student is (age band + school level) rides in this wave rather than
  // as its own hop, so calibrating Raya to a 12-year-old costs no latency. RLS
  // scopes the row to its owner; both columns are read-only to the client.
  const [allowed, dayAllowed, roomMember, roomOpen, { profile, alerts, analysis }, instructions, learner] =
    await Promise.all([
      checkStrictUserRateLimit("raya_chat", user.id, 30, "1 minute"),
      checkStrictUserRateLimit("raya_chat_day", user.id, CHAT_TURNS_PER_DAY, "24 hours"),
      roomId
        ? supabase
            .schema("learning")
            .from("room_members")
            .select("id")
            .eq("room_id", roomId)
            .eq("user_id", user.id)
            .maybeSingle()
            .then((r) => r.data != null)
        : Promise.resolve(true),
      roomId ? assertRoomOpen(supabase, roomId).then((r) => r.open) : Promise.resolve(true),
      getCognitiveContext(user.id),
      roomId ? Promise.resolve("") : teacherInstructionsFor(user.id),
      supabase
        .from("users")
        .select("birth_year, school_level")
        .eq("id", user.id)
        .maybeSingle()
        .then((r) => r.data),
    ]);
  if (!allowed) {
    return NextResponse.json(
      { error: "You're sending messages very fast — give it a second." },
      { status: 429 },
    );
  }
  // Worded differently from the burst limit on purpose: "give it a second" is
  // wrong advice here, and support needs to tell the two apart.
  if (!dayAllowed) {
    return NextResponse.json(
      { error: "You've hit today's message ceiling. It resets over the next 24 hours." },
      { status: 429 },
    );
  }
  if (!roomMember) {
    return NextResponse.json({ error: "You are not a member of this room." }, { status: 403 });
  }
  // A timed room turns read-only once it ends — the private Raya channel too.
  if (!roomOpen) {
    return NextResponse.json({ error: "This room has ended — it's now read-only." }, { status: 403 });
  }

  // Ensure a conversation (only a brand-new chat pays this extra round trip).
  let convId = body.conversationId ?? null;
  if (convId) {
    // The room scope is immutable. Without this check, an owned solo
    // conversation could be paired with an arbitrary room id in a later turn.
    const { data: conversation } = await supabase
      .schema("learning")
      .from("conversations")
      .select("id, room_id, is_private_room_channel")
      .eq("id", convId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      !conversation ||
      (conversation.room_id ?? null) !== roomId ||
      Boolean(conversation.is_private_room_channel) !== (roomId != null)
    ) {
      return NextResponse.json({ error: "conversation not found" }, { status: 403 });
    }
  }
  if (!convId) {
    // Seed a human-readable title from the opening message so the history
    // list is meaningful without a separate LLM call.
    const title = content.length > 60 ? `${content.slice(0, 57)}…` : content;
    const { data, error } = await supabase
      .schema("learning")
      .from("conversations")
      .insert({
        user_id: user.id,
        context_type: "solo",
        room_id: roomId,
        is_private_room_channel: roomId != null,
        title: roomId != null ? null : title,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    convId = data.id;
  }

  // ── Wave 2: store the message + gather history/documents, in parallel ──
  const turn = await persistAndGather(supabase, {
    conversationId: convId,
    userId: user.id,
    content,
    fileIds,
    responseTimeMs,
    roomId,
    clientMsgId,
  });
  if (turn.error !== undefined) {
    return NextResponse.json({ error: turn.error }, { status: 500 });
  }
  const { userMsgId, hist, docs, existingReply } = turn;

  // This turn was already answered (a retry after a lost response): replay the
  // stored reply instead of generating — and paying for — a second one.
  if (existingReply != null) {
    return replayReply(existingReply, convId, userMsgId);
  }

  // Attach the staged documents to the message that carried them — overlapped
  // with the LLM start below, awaited before we respond.
  const linkPromise = linkAttachments(createAdminClient(), convId, userMsgId, fileIds);

  // Start the stream (provider chosen here so we can't set headers later).
  // The tier is decided from the SAME profile/alerts the prompt is built from,
  // so the model that answers is always matched to the state that shaped the
  // question — no second Kernel read, no extra latency.
  const routing = routeTier(profile, alerts);
  let model: string;
  let deltas: AsyncGenerator<string>;
  let usage: TokenUsage;
  try {
    const out = await rayaStream(
      buildRayaMessages(
        hist,
        profile,
        alerts,
        docs,
        instructions,
        {
          birthYear: learner?.birth_year ?? null,
          schoolLevel: learner?.school_level ?? null,
        },
        analysis,
      ),
      routing.tier,
    );
    model = out.model;
    deltas = out.stream;
    usage = out.usage;
  } catch (e) {
    await linkPromise;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "llm error" },
      { status: 502 },
    );
  }
  await linkPromise;

  const convIdFinal = convId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const delta of deltas) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch {
        // keep whatever streamed so far
      }
      // Persist Raya's full reply (best-effort).
      try {
        await supabase.schema("learning").from("messages").insert({
          conversation_id: convIdFinal,
          user_id: null,
          role: "assistant",
          content: full,
          model_used: model,
          // What the turn cost. Read AFTER the loop above, which is what filled
          // it in. null when the provider did not say — an unmeasured turn must
          // not be summed as a free one.
          tokens_used: usage.total,
          emt_level: classifyEmt(full),
        });
        // Touch the conversation so it sorts to the top of the history list.
        await supabase
          .schema("learning")
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convIdFinal);
      } catch (e) {
        // Non-fatal for this response — the student already read the reply as
        // it streamed. It is not nothing, though: the reply is now missing from
        // the thread, so the next turn's history has a hole in it.
        await reportError("chat.persist", e, {
          severity: "warning",
          tags: { conversationId: convIdFinal, model },
        });
      }
      controller.close();

      // Close the cognitive loop: every 3rd student turn, let the Kernel process
      // the exchange and update state. Fire-and-forget — never blocks the reply.
      const userTurns = hist.filter((m) => m.role === "user").length;
      if (full && userTurns > 0 && userTurns % 3 === 0) {
        const convo: KernelMessage[] = [
          ...hist.map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content ?? "",
          })),
          { role: "assistant", content: full },
        ];
        void kernel
          .analyze({
            user_id: user.id,
            conversation_history: clampHistory(convo),
            trigger: "post_conversation",
          })
          .then((res) => {
            setLatestAnalysis(user.id, res);
            invalidateProfile(user.id);
          })
          .catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-conversation-id": convIdFinal,
      "x-message-id": userMsgId,
      "x-raya-model": model,
    },
  });
}
