import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The shared persist-and-gather wave of a chat turn (Raya solo + Raya for
 * Schools). Before this existed each route ran 4-6 SEQUENTIAL Supabase round
 * trips between auth and the LLM call — on a 200ms-RTT link that alone ate
 * over a second of the 3s first-token budget. Everything here runs in ONE
 * parallel wave.
 *
 * History window: the LATEST `HISTORY_LIMIT` messages (chronological), always
 * ending with the message just stored. The old serial code took the OLDEST 20
 * ascending, so past 20 messages the prompt lost recent context — including
 * the student's current question. That was a latent bug, deliberately fixed
 * here.
 */

const HISTORY_LIMIT = 20;

export type HistMsg = { role: string; content: string | null };

export type TurnInput = {
  conversationId: string;
  userId: string;
  content: string;
  fileIds: string[];
  /** Student think-time (solo chat only) — omitted for school analytics. */
  responseTimeMs?: number | null;
  /** Private-room channel: also pull the room's shared documents. */
  roomId?: string | null;
};

export type TurnData =
  | {
      userMsgId: string;
      /** Chronological, capped, INCLUDING the just-stored user message. */
      hist: HistMsg[];
      /** Bounded document context ("# name\ncontent" blocks). */
      docs: string;
      error?: undefined;
    }
  | { error: string };

export async function persistAndGather(
  supabase: SupabaseClient<Database>,
  input: TurnInput,
): Promise<TurnData> {
  const { conversationId, userId, content, fileIds, responseTimeMs, roomId } = input;

  const [insertRes, histRes, ownFilesRes, roomFilesRes] = await Promise.all([
    supabase
      .schema("learning")
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content,
        has_media: fileIds.length > 0,
        ...(responseTimeMs !== undefined ? { response_time_ms: responseTimeMs } : {}),
      })
      .select("id")
      .single(),
    // Newest first, +1 so the window stays full even though the parallel
    // insert may or may not appear in this read (filtered by id below).
    supabase
      .schema("learning")
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT + 1),
    supabase
      .schema("learning")
      .from("conversation_files")
      .select("file_name, content")
      .eq("conversation_id", conversationId)
      .not("content", "is", null)
      .limit(10),
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

  if (insertRes.error || !insertRes.data) {
    return { error: insertRes.error?.message ?? "message insert failed" };
  }
  const userMsgId = insertRes.data.id as string;

  const prior = ((histRes.data ?? []) as { id: string; role: string; content: string | null }[])
    .filter((m) => m.id !== userMsgId)
    .slice(0, HISTORY_LIMIT - 1)
    .reverse();
  const hist: HistMsg[] = [
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];

  const docs = [...(roomFilesRes.data ?? []), ...(ownFilesRes.data ?? [])]
    .map((f) => `# ${f.file_name}\n${f.content}`)
    .join("\n\n")
    .slice(0, 8000);

  return { userMsgId, hist, docs };
}

/**
 * Attach staged composer documents to the message that carried them. Scoped to
 * this conversation and to not-yet-sent files so a stolen id can't graft a
 * foreign document onto the thread. Non-fatal by design (the doc still feeds
 * Raya's context; it just floats free of the bubble) — callers overlap this
 * with the LLM start instead of paying it as a serial hop.
 */
export async function linkAttachments(
  admin: SupabaseClient<Database>,
  conversationId: string,
  messageId: string,
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;
  try {
    const { error } = await admin
      .schema("learning")
      .from("conversation_files")
      .update({ message_id: messageId })
      .in("id", fileIds)
      .eq("conversation_id", conversationId)
      .is("message_id", null);
    if (error) console.error("attachment link failed", error.message);
  } catch (e) {
    console.error("attachment link failed", e);
  }
}
