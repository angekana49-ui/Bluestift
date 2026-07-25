import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentRecommendations } from "@/lib/school-admin";
import { buildRayaMessages } from "@/lib/raya/prompt";
import { rayaStream } from "@/lib/raya/llm";
import { kernel, clampHistory } from "@/lib/kernel/client";
import { assertRoomOpen } from "@/lib/rooms";
import { checkUserRateLimit } from "@/lib/rate-limit";
import {
  getCachedProfile,
  getLatestAlerts,
  invalidateProfile,
  setLatestAlerts,
} from "@/lib/kernel/profile-cache";
import type { KernelMessage } from "@/lib/kernel/types";

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
  const recs = await getStudentRecommendations(userId);
  return recs
    .map((r) => `- (${r.source}) ${r.content}`)
    .join("\n")
    .slice(0, 1800);
}

/**
 * One Raya turn, STREAMED for minimal perceived latency:
 * store student message -> read cached cognitive profile (non-blocking) ->
 * stream the guarded reply -> persist the full reply when the stream ends.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Anti-abuse rate-limit. The chat itself is never quota-metered (core learning
  // loop), but a scripted flood would burn LLM budget — so cap the raw rate.
  // Keyed by user id, NOT IP, so a whole school behind one shared NAT is never
  // punished for one abuser. Fails open on any limiter hiccup.
  if (!(await checkUserRateLimit("raya_chat", user.id, 30, "1 minute"))) {
    return NextResponse.json(
      { error: "You're sending messages very fast — give it a second." },
      { status: 429 },
    );
  }

  let body: {
    conversationId?: string | null;
    content?: string;
    roomId?: string | null;
    responseTimeMs?: number | null;
    fileIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
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
  const roomId = body.roomId ?? null;

  // A timed room turns read-only once it ends — the private Raya channel too.
  if (roomId) {
    const { open } = await assertRoomOpen(supabase, roomId);
    if (!open) {
      return NextResponse.json({ error: "This room has ended — it's now read-only." }, { status: 403 });
    }
  }

  // Ensure a conversation.
  let convId = body.conversationId ?? null;
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

  // Store the student message.
  const { data: userMsg, error: umErr } = await supabase
    .schema("learning")
    .from("messages")
    .insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content,
      response_time_ms: responseTimeMs,
      has_media: fileIds.length > 0,
    })
    .select("id")
    .single();
  if (umErr) return NextResponse.json({ error: umErr.message }, { status: 500 });

  // Attach the staged documents to the message that carried them, so the client
  // renders them in its bubble. Scoped to this conversation and to files not yet
  // sent, so a stolen id can't graft a foreign document onto the thread. Written
  // with the service role: these tables have no RLS UPDATE policy by design.
  if (fileIds.length > 0) {
    const { error: linkErr } = await createAdminClient()
      .schema("learning")
      .from("conversation_files")
      .update({ message_id: userMsg.id })
      .in("id", fileIds)
      .eq("conversation_id", convId)
      .is("message_id", null);
    if (linkErr) {
      // Non-fatal: the document still feeds Raya's context, it just floats free
      // of the bubble. Losing the turn over a cosmetic link would be worse.
      console.error("attachment link failed", linkErr.message);
    }
  }

  // Recent history (chronological), capped.
  const { data: hist } = await supabase
    .schema("learning")
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Cognitive profile + latest safety alerts from the cache — never blocks.
  const profile = getCachedProfile(user.id);
  const alerts = getLatestAlerts(user.id);

  // Teacher guidance for the student's class (solo chat only — a room mixes
  // students from different classes). Kicked off here to run in parallel.
  const instructionsPromise = roomId ? Promise.resolve("") : teacherInstructionsFor(user.id);

  // Document context. In the private-room channel Raya draws on BOTH the room's
  // shared files and the docs the student attached privately to this channel —
  // otherwise a doc dropped in the private composer would render in the thread
  // but stay invisible to Raya.
  const convFiles = supabase
    .schema("learning")
    .from("conversation_files")
    .select("file_name, content")
    .eq("conversation_id", convId)
    .not("content", "is", null)
    .limit(10);
  const [{ data: ownFiles }, { data: roomDocFiles }] = await Promise.all([
    convFiles,
    roomId
      ? supabase
          .schema("learning")
          .from("room_files")
          .select("file_name, content")
          .eq("room_id", roomId)
          .not("content", "is", null)
          .limit(10)
      : Promise.resolve({ data: [] as { file_name: string | null; content: string | null }[] }),
  ]);
  const docs = [...(roomDocFiles ?? []), ...(ownFiles ?? [])]
    .map((f) => `# ${f.file_name}\n${f.content}`)
    .join("\n\n")
    .slice(0, 8000);

  const instructions = await instructionsPromise;

  // Start the stream (provider chosen here so we can't set headers later).
  let model: string;
  let deltas: AsyncGenerator<string>;
  try {
    const out = await rayaStream(buildRayaMessages(hist ?? [], profile, alerts, docs, instructions));
    model = out.model;
    deltas = out.stream;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "llm error" },
      { status: 502 },
    );
  }

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
          emt_level: classifyEmt(full),
        });
        // Touch the conversation so it sorts to the top of the history list.
        await supabase
          .schema("learning")
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convIdFinal);
      } catch {
        // non-fatal
      }
      controller.close();

      // Close the cognitive loop: every 3rd student turn, let the Kernel process
      // the exchange and update state. Fire-and-forget — never blocks the reply.
      const userTurns = (hist ?? []).filter((m) => m.role === "user").length;
      if (full && userTurns > 0 && userTurns % 3 === 0) {
        const convo: KernelMessage[] = [
          ...(hist ?? []).map((m) => ({
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
            setLatestAlerts(user.id, res.alerts ?? []);
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
      "x-message-id": userMsg.id,
      "x-raya-model": model,
    },
  });
}
