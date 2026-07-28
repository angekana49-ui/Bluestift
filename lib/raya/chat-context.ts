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
  /**
   * Client-generated id for this send. Makes a retry idempotent: the unique
   * index on (conversation_id, client_msg_id) rejects the second insert, and
   * we recover the original message instead of duplicating the student's turn.
   */
  clientMsgId?: string | null;
};

export type TurnData =
  | {
      userMsgId: string;
      /** Chronological, capped, INCLUDING the just-stored user message. */
      hist: HistMsg[];
      /** Bounded document context ("# name\ncontent" blocks). */
      docs: string;
      /**
       * Set only when this send was a RETRY of a turn the server had already
       * answered (the first reply just never reached the client). Replay it
       * verbatim — never bill a second LLM call or write a second reply.
       */
      existingReply?: string | null;
      error?: undefined;
    }
  | { error: string };

/** Postgres unique-violation — our retry landing on the dedupe index. */
function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * `messages.client_msg_id` is newer than the generated Database types (same
 * situation as adminRpc in lib/supabase/admin.ts). Two cast points — the write
 * row and the read row — both of which narrow back on the next
 * `npm run gen:types`.
 */
type HistoryRow = {
  id: string;
  role: string;
  content: string | null;
  client_msg_id: string | null;
};

export async function persistAndGather(
  supabase: SupabaseClient<Database>,
  input: TurnInput,
): Promise<TurnData> {
  const { conversationId, userId, content, fileIds, responseTimeMs, roomId, clientMsgId } = input;

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
        ...(clientMsgId ? { client_msg_id: clientMsgId } : {}),
      } as never)
      .select("id")
      .single(),
    // Newest first, +1 so the window stays full even though the parallel
    // insert may or may not appear in this read (filtered by id below).
    supabase
      .schema("learning")
      .from("messages")
      .select("id, role, content, client_msg_id")
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

  // Newest-first history. Also the lookup table for the duplicate case below,
  // which is why it carries id + client_msg_id.
  const rows = (histRes.data ?? []) as unknown as HistoryRow[];

  let userMsgId: string;
  let existingReply: string | null = null;

  if (insertRes.error || !insertRes.data) {
    // A retry of a turn the server already stored. Recover the original message
    // rather than duplicating it, and — if a reply already followed it — hand
    // that reply back so the retry costs nothing and says the same thing.
    if (!isDuplicate(insertRes.error) || !clientMsgId) {
      return { error: insertRes.error?.message ?? "message insert failed" };
    }
    const at = rows.findIndex((m) => m.client_msg_id === clientMsgId);
    if (at < 0) {
      // Stored, but pushed out of the recent window — nothing safe to recover.
      return { error: "duplicate message" };
    }
    userMsgId = rows[at].id;
    // rows are newest-first, so the message immediately AFTER this turn sits
    // at at-1.
    const next = at > 0 ? rows[at - 1] : null;
    if (next?.role === "assistant") existingReply = next.content ?? "";
  } else {
    userMsgId = insertRes.data.id as string;
  }

  const prior = rows
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

  return { userMsgId, hist, docs, existingReply };
}

/**
 * Hand back an already-generated reply in the exact wire shape of a live turn
 * (plain text body + the x-* headers the chat engine reads), so a retry whose
 * first response was lost resolves identically on the client — no second LLM
 * call, no second stored reply.
 */
export function replayReply(
  reply: string,
  conversationId: string,
  userMsgId: string,
): Response {
  return new Response(reply, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-conversation-id": conversationId,
      "x-message-id": userMsgId,
      "x-raya-model": "replay",
    },
  });
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
