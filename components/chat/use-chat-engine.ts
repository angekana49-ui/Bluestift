"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { splitByMessage, type Attachment } from "@/components/attachment";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { enqueueOutbox, removeFromOutbox, registerOutboxFlusher } from "@/lib/net/outbox";
import { type ChatConfig, type Msg, type Conversation, type ConversationFile, titleFrom } from "./types";

/**
 * The full conversation engine shared by the Raya chat and the Raya-for-Schools
 * chat: message/conversation/attachment/voice state and every handler
 * (send [streamed], upload, history switch/delete, new session). Endpoint URLs
 * come from `config`.
 *
 * Degraded-network contract:
 *  - a send that fails at the network level KEEPS the student's message (marked
 *    `failed`, with its attachments) and queues it in the outbox, so nothing
 *    typed is ever lost — `retrySend` and the outbox flush replay it;
 *  - every send carries a `clientMsgId`, so a replay is deduplicated server
 *    side (and an already-answered turn replays its stored reply);
 *  - history switches render from cache first and revalidate in the background.
 */

/** How long we wait for response headers before calling a send failed. */
const SEND_TIMEOUT_MS = 20_000;

export function useChatEngine({
  config,
  initialId,
  initialMessages,
  initialFiles,
  initialConversations,
}: {
  config: ChatConfig;
  initialId: string | null;
  initialMessages: Msg[];
  initialFiles: ConversationFile[];
  initialConversations: Conversation[];
}) {
  const initial = splitByMessage(initialFiles);
  const [conversationId, setConversationId] = useState(initialId);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  // Files waiting in the composer vs. files already sent, keyed by their message.
  const [pending, setPending] = useState<Attachment[]>(initial.staged);
  const [filesByMessage, setFilesByMessage] = useState<Record<string, Attachment[]>>(
    initial.byMessage,
  );
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice input: record → transcribe → send as a message.
  const voice = useVoiceRecorder((text) => onSend(text));

  // When the last reply finished rendering — used to measure user think-time.
  const lastReplyRef = useRef<number | null>(initialMessages.length ? Date.now() : null);
  // Everything a failed send needs to be replayed, keyed by client message id.
  const failedRef = useRef<Map<string, { text: string; files: Attachment[]; conversationId: string | null }>>(
    new Map(),
  );

  function newChat() {
    if (busy) return;
    setConversationId(null);
    setMessages([]);
    setPending([]);
    setFilesByMessage({});
    setError(null);
    lastReplyRef.current = null;
  }

  /**
   * Upload as soon as the file is picked — text extraction (PDF, audio) runs
   * while the user types. The file only joins the thread on send.
   */
  async function uploadDoc(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      if (conversationId) fd.append("conversationId", conversationId);
      for (const [k, v] of Object.entries(config.extraBody ?? {})) fd.append(k, v);
      fd.append("file", file);
      const res = await netFetch(
        config.endpoints.files,
        { method: "POST", body: fd },
        { timeoutMs: 60_000 }, // uploads are slow on a weak link — be patient
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? `Upload: ${data.error}` : "Upload failed.");
        return;
      }
      // A doc can open a fresh chat — adopt the conversation it created.
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        setConversations((list) =>
          list.some((c) => c.id === data.conversationId)
            ? list
            : [
                { id: data.conversationId, title: file.name, updated_at: new Date().toISOString() },
                ...list,
              ],
        );
      }
      if (data.file) setPending((a) => [...a, data.file as Attachment]);
    } catch {
      // The picked File is still in the caller's input element; tell the user
      // plainly rather than pretending the document is attached.
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removePending(id: string) {
    setPending((a) => a.filter((f) => f.id !== id));
    try {
      await netFetch(`${config.endpoints.files}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // The chip is already gone; a stale row costs nothing but storage.
    }
  }

  async function selectConversation(id: string) {
    if (busy || id === conversationId) return;
    setBusy(true);
    setError(null);
    try {
      const url = `${config.endpoints.conversations}?id=${encodeURIComponent(id)}`;
      const apply = (data: { messages?: Msg[]; files?: ConversationFile[] }) => {
        setMessages((data.messages ?? []) as Msg[]);
        const split = splitByMessage((data.files ?? []) as ConversationFile[]);
        setFilesByMessage(split.byMessage);
        setPending(split.staged);
      };
      // Cached first: switching threads on a weak link renders instantly from
      // the last known state, then reconciles when the refresh lands.
      const { data } = await getJsonCached<{ messages?: Msg[]; files?: ConversationFile[] }>(url, {
        cacheKey: `conv:${id}`,
        cacheTtlMs: 15_000,
        onUpdate: apply,
      });
      if (!data) {
        setError("Could not load conversation.");
        return;
      }
      setConversationId(id);
      apply(data);
      lastReplyRef.current = Date.now();
    } catch {
      setError("Could not load conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConversation(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await netFetch(`${config.endpoints.conversations}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      invalidateCached(`conv:${id}`);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (id === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
    } catch {
      setError("Could not delete conversation.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Auto-name the conversation once, around the 2nd exchange: Raya distils the
   * thread into a one-sentence title. Best-effort and fire-and-forget — a failure
   * just leaves the first-message seed title. Off when no `summarize` endpoint is
   * configured (e.g. room channels, which keep the room's name).
   */
  async function maybeAutoRename(turnNow: number, cid: string | null) {
    if (turnNow !== 2 || !cid || !config.endpoints.summarize) return;
    try {
      const res = await netFetch(config.endpoints.summarize, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...config.extraBody, conversationId: cid }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const title = typeof data?.title === "string" ? data.title : null;
      if (title) {
        setConversations((list) => list.map((c) => (c.id === cid ? { ...c, title } : c)));
      }
    } catch {
      // best-effort
    }
  }

  /**
   * One send. `clientMsgId` identifies the turn across retries: the optimistic
   * bubble carries it as its id until the server hands back the real one, and
   * the server uses it to deduplicate a replay.
   */
  async function send(
    text: string,
    clientMsgId: string,
    sentFiles: Attachment[],
    opts: { fromRetry?: boolean } = {},
  ): Promise<boolean> {
    const wasNew = conversationId == null;
    const turnNow = messages.filter((m) => m.role === "user").length + 1;
    const responseTimeMs =
      lastReplyRef.current != null ? Date.now() - lastReplyRef.current : null;

    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(
        config.endpoints.chat,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...config.extraBody,
            conversationId,
            content: text,
            responseTimeMs,
            fileIds: sentFiles.map((f) => f.id),
            clientMsgId,
          }),
        },
        { timeoutMs: SEND_TIMEOUT_MS },
      );
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        // A 4xx is the server refusing this turn (rate limit, closed room,
        // empty message): the send will never succeed as-is, so roll it back
        // and say why. A 5xx is treated like a network failure below.
        if (res.status >= 400 && res.status < 500) {
          setError(data?.error ? `Raya error: ${data.error}` : `Request failed (${res.status}).`);
          rollback(clientMsgId, sentFiles);
          return true; // handled — not a retryable delivery failure
        }
        markFailed(clientMsgId, text, sentFiles);
        setError(data?.error ? `Raya error: ${data.error}` : `Request failed (${res.status}).`);
        return false;
      }
      const convId = res.headers.get("x-conversation-id");
      if (convId) {
        setConversationId(convId);
        if (wasNew) {
          // Surface the freshly created conversation in the history list.
          setConversations((list) => [
            { id: convId, title: titleFrom(text), updated_at: new Date().toISOString() },
            ...list.filter((c) => c.id !== convId),
          ]);
        }
        invalidateCached(`conv:${convId}`);
      }
      // Swap the optimistic id for the real one so the bubble keeps its files
      // when the conversation is reloaded from the server, and clear any
      // failed marker from a previous attempt.
      const msgId = res.headers.get("x-message-id");
      if (msgId) {
        setMessages((m) =>
          m.map((x) => (x.id === clientMsgId ? { ...x, id: msgId, status: undefined } : x)),
        );
        if (sentFiles.length) {
          setFilesByMessage(({ [clientMsgId]: moved, ...rest }) =>
            moved ? { ...rest, [msgId]: moved } : rest,
          );
        }
      } else {
        setMessages((m) => m.map((x) => (x.id === clientMsgId ? { ...x, status: undefined } : x)));
      }
      failedRef.current.delete(clientMsgId);
      removeFromOutbox(clientMsgId);

      const rayaId = `raya-${Date.now()}`;
      setMessages((m) => [...m, { id: rayaId, role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((x) => (x.id === rayaId ? { ...x, content: (x.content ?? "") + chunk } : x)),
        );
      }
      // The reply finished — start the think-time clock for the next turn.
      lastReplyRef.current = Date.now();
      if (!opts.fromRetry) {
        // Around the 2nd exchange, let Raya name the conversation.
        void maybeAutoRename(turnNow, convId ?? conversationId);
      }
      return true;
    } catch {
      // Network throw or our timeout: the turn may or may not have reached the
      // server. Keep the message (with its files) and let the retry — which
      // carries the same clientMsgId — resolve it either way.
      markFailed(clientMsgId, text, sentFiles);
      setError("Could not reach Raya — your message is saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Undo the optimistic bubble and hand the files back to the composer. */
  function rollback(clientMsgId: string, sentFiles: Attachment[]) {
    if (sentFiles.length) {
      setFilesByMessage((map) => {
        const next = { ...map };
        delete next[clientMsgId];
        return next;
      });
      setPending(sentFiles);
    }
    setMessages((m) => m.filter((x) => x.id !== clientMsgId));
    failedRef.current.delete(clientMsgId);
    removeFromOutbox(clientMsgId);
  }

  /** Keep the message visible, marked failed, and queued for a later flush. */
  function markFailed(clientMsgId: string, text: string, sentFiles: Attachment[]) {
    setMessages((m) => m.map((x) => (x.id === clientMsgId ? { ...x, status: "failed" } : x)));
    failedRef.current.set(clientMsgId, { text, files: sentFiles, conversationId });
    enqueueOutbox({
      id: clientMsgId,
      kind: `chat:${config.endpoints.chat}`,
      body: { text, conversationId, fileIds: sentFiles.map((f) => f.id) },
    });
  }

  async function onSend(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy || uploading) return;
    const clientMsgId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // The staged files leave the composer with this message.
    const sentFiles = pending;
    setMessages((m) => [...m, { id: clientMsgId, role: "user", content: text, status: "sending" }]);
    if (sentFiles.length) {
      setFilesByMessage((map) => ({ ...map, [clientMsgId]: sentFiles }));
      setPending([]);
    }
    setInput("");
    await send(text, clientMsgId, sentFiles);
  }

  /** Replay a failed message (user-invoked, or by the outbox flush). */
  const retrySend = useCallback(
    async (clientMsgId: string) => {
      const entry = failedRef.current.get(clientMsgId);
      if (!entry || busy) return false;
      setMessages((m) => m.map((x) => (x.id === clientMsgId ? { ...x, status: "sending" } : x)));
      return send(entry.text, clientMsgId, entry.files, { fromRetry: true });
    },
    // `send` closes over current state; re-created each render like the other
    // handlers here. The callback identity only matters to the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, messages, conversationId, pending],
  );

  /** Let the outbox replay this surface's failed sends when the link returns. */
  useEffect(() => {
    registerOutboxFlusher(`chat:${config.endpoints.chat}`, async (entry) => {
      // Only replay what this mounted surface still holds — a message queued in
      // a different conversation is replayed when that thread is open.
      if (!failedRef.current.has(entry.id)) return false;
      return retrySend(entry.id);
    });
  }, [config.endpoints.chat, retrySend]);

  // ── derived view data ──────────────────────────────────────
  const activeTitle =
    conversations.find((c) => c.id === conversationId)?.title ?? "New session";
  const sessionFiles = [...Object.values(filesByMessage).flat(), ...pending];

  return {
    // state
    conversationId,
    conversations,
    messages,
    pending,
    filesByMessage,
    preview,
    input,
    busy,
    uploading,
    error,
    voice,
    // derived
    activeTitle,
    sessionFiles,
    // setters/actions
    setInput,
    setPreview,
    setError,
    setBusy,
    setConversations,
    newChat,
    uploadDoc,
    removePending,
    selectConversation,
    deleteConversation,
    onSend,
    retrySend,
  };
}

export type ChatEngine = ReturnType<typeof useChatEngine>;
