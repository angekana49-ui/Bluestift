"use client";

import { useRef, useState } from "react";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { splitByMessage, type Attachment } from "@/components/attachment";
import { type ChatConfig, type Msg, type Conversation, type ConversationFile, titleFrom } from "./types";

/**
 * The full conversation engine shared by the Raya chat and the Raya-for-Schools
 * chat: message/conversation/attachment/voice state and every handler
 * (send [streamed], upload, history switch/delete, new session). Endpoint URLs
 * come from `config` — the logic is lifted verbatim from the original Raya
 * `Chat` so behaviour is byte-for-byte identical on both surfaces.
 */
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
      const res = await fetch(config.endpoints.files, { method: "POST", body: fd });
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
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePending(id: string) {
    setPending((a) => a.filter((f) => f.id !== id));
    try {
      await fetch(`${config.endpoints.files}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // The chip is already gone; a stale row costs nothing but storage.
    }
  }

  async function selectConversation(id: string) {
    if (busy || id === conversationId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${config.endpoints.conversations}?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ? `Could not load: ${data.error}` : "Could not load conversation.");
        return;
      }
      setConversationId(id);
      setMessages((data.messages ?? []) as Msg[]);
      const split = splitByMessage((data.files ?? []) as ConversationFile[]);
      setFilesByMessage(split.byMessage);
      setPending(split.staged);
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
      await fetch(`${config.endpoints.conversations}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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

  async function onSend(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy || uploading) return;
    const wasNew = conversationId == null;
    const responseTimeMs =
      lastReplyRef.current != null ? Date.now() - lastReplyRef.current : null;
    // The staged files leave the composer with this message.
    const sentFiles = pending;
    const tmpId = `tmp-${Date.now()}`;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { id: tmpId, role: "user", content: text }]);
    if (sentFiles.length) {
      setFilesByMessage((map) => ({ ...map, [tmpId]: sentFiles }));
      setPending([]);
    }
    setInput("");
    try {
      const res = await fetch(config.endpoints.chat, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...config.extraBody,
          conversationId,
          content: text,
          responseTimeMs,
          fileIds: sentFiles.map((f) => f.id),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? `Raya error: ${data.error}` : `Request failed (${res.status}).`);
        // Hand the files back to the composer — the turn never happened.
        if (sentFiles.length) {
          setFilesByMessage((map) => {
            const next = { ...map };
            delete next[tmpId];
            return next;
          });
          setPending(sentFiles);
        }
        setMessages((m) => m.filter((x) => x.id !== tmpId));
        return;
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
      }
      // Swap the optimistic id for the real one so the bubble keeps its files
      // when the conversation is reloaded from the server.
      const msgId = res.headers.get("x-message-id");
      if (msgId) {
        setMessages((m) => m.map((x) => (x.id === tmpId ? { ...x, id: msgId } : x)));
        if (sentFiles.length) {
          setFilesByMessage(({ [tmpId]: moved, ...rest }) =>
            moved ? { ...rest, [msgId]: moved } : rest,
          );
        }
      }

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
    } catch {
      setError("Could not reach Raya.");
    } finally {
      setBusy(false);
    }
  }

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
  };
}

export type ChatEngine = ReturnType<typeof useChatEngine>;
