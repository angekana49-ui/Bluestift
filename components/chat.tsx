"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/lib/kernel/types";
import { downloadText, downloadPdf } from "@/lib/export";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import {
  AttachmentCard,
  AttachmentChip,
  FilePreview,
  splitByMessage,
  type Attachment,
} from "@/components/attachment";
import { useDarkMode } from "@/components/ui/theme";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel, IconButton } from "@/components/ui/shell";
import { Avatar, Bird } from "@/components/ui/widgets";
import {
  IconFile,
  IconImage,
  IconPanel,
  IconMic,
  IconAttach,
  IconAiMode,
} from "@/components/ui/icons";
import { status, hand, type AppTheme } from "@/components/ui/tokens";
import { initialsOf } from "@/lib/name";

function analysisToText(a: AnalyzeResponse): string {
  return [
    `Root gap: ${a.root_gap ?? "-"}`,
    `Summary: ${a.summary || "-"}`,
    a.recommended_path?.length
      ? `Recommended path: ${a.recommended_path.join(" -> ")}`
      : "",
    a.detection_path?.length
      ? `Detection path: ${a.detection_path.join(" -> ")}`
      : "",
    `Confidence: ${a.confidence}`,
    `Knowledge components: ${Object.keys(a.mastery_map).length}`,
    `Model: ${a.llm_used}`,
  ]
    .filter(Boolean)
    .join("\n");
}

type Msg = { id: string; role: string; content: string | null };
type Conversation = { id: string; title: string | null; updated_at: string };
type Recommendation = { content: string; source: string };
/** A conversation_files row: attached to a message, or still staged (null). */
export type ConversationFile = Attachment & { message_id: string | null };

function titleFrom(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function Chat({
  conversationId: initialId,
  initialMessages,
  initialFiles,
  conversations: initialConversations,
  recommendations = [],
  studentName = "Emma M.",
  studentAvatarUrl,
}: {
  conversationId: string | null;
  initialMessages: Msg[];
  initialFiles: ConversationFile[];
  conversations: Conversation[];
  recommendations?: Recommendation[];
  studentName?: string;
  studentAvatarUrl?: string | null;
}) {
  const initial = splitByMessage(initialFiles);
  const router = useRouter();
  const { theme: t } = useDarkMode();
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
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shell UI state (design shell): right panel + session-files dropdown.
  const [rightOpen, setRightOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);

  // Voice input: record → transcribe → send as a message.
  const voice = useVoiceRecorder((text) => onSend(text));

  // When RAYA's last reply finished rendering — used to measure student think-time.
  const lastReplyRef = useRef<number | null>(initialMessages.length ? Date.now() : null);

  function newChat() {
    if (busy) return;
    setConversationId(null);
    setMessages([]);
    setPending([]);
    setFilesByMessage({});
    setAnalysis(null);
    setError(null);
    lastReplyRef.current = null;
  }

  /**
   * Upload as soon as the file is picked — text extraction (PDF, audio) runs
   * while the student types. The file only joins the thread on send.
   */
  async function uploadDoc(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      if (conversationId) fd.append("conversationId", conversationId);
      fd.append("file", file);
      const res = await fetch("/api/raya/files", { method: "POST", body: fd });
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
      await fetch(`/api/raya/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // The chip is already gone; a stale row costs nothing but storage.
    }
  }

  async function selectConversation(id: string) {
    if (busy || id === conversationId) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/raya/conversations?id=${encodeURIComponent(id)}`);
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
      await fetch(`/api/raya/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setConversations((list) => list.filter((c) => c.id !== id));
      if (id === conversationId) {
        setConversationId(null);
        setMessages([]);
        setAnalysis(null);
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
      const res = await fetch("/api/raya/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: text,
          responseTimeMs,
          fileIds: sentFiles.map((f) => f.id),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? `RAYA error: ${data.error}` : `Request failed (${res.status}).`);
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
      // RAYA finished replying — start the think-time clock for the next turn.
      lastReplyRef.current = Date.now();
    } catch {
      setError("Could not reach RAYA.");
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyze() {
    if (messages.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/kernel/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_history: messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content ?? "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.detail
            ? `Kernel error: ${JSON.stringify(data.detail)}`
            : `Request failed (${res.status}). Is the Kernel running?`,
        );
        return;
      }
      setAnalysis(data as AnalyzeResponse);
    } catch {
      setError("Could not reach the Kernel API.");
    } finally {
      setBusy(false);
    }
  }

  // ── derived view data ──────────────────────────────────────
  const activeTitle =
    conversations.find((c) => c.id === conversationId)?.title ?? "New session";
  const sessionFiles = [...Object.values(filesByMessage).flat(), ...pending];
  const greetingName = studentName.trim().split(/\s+/)[0] || "";

  // ── sidebar: conversation history ─────────────────────────
  const chatHistory = (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          newChat();
        }}
        style={{
          cursor: "pointer",
          background: t.sidebarActiveBg,
          color: t.sidebarText,
          borderRadius: 9,
          padding: "8px 10px",
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 2,
          opacity: busy ? 0.5 : 1,
        }}
      >
        + New session
      </div>
      {conversations.length === 0 && (
        <div style={{ fontSize: 10.5, color: t.sidebarMuted, padding: "6px 10px" }}>
          No conversations yet.
        </div>
      )}
      {conversations.map((c) => {
        const active = c.id === conversationId;
        return (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: active ? t.rowActiveBg : undefined,
              borderRadius: 9,
              padding: "8px 10px",
            }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                selectConversation(c.id);
              }}
              title={c.title ?? "New conversation"}
              style={{
                flex: 1,
                minWidth: 0,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? t.sidebarText : t.sidebarMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.title ?? "New conversation"}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(c.id);
              }}
              title="Delete"
              style={{ cursor: "pointer", color: t.mutedLight, fontSize: 11, flex: "none" }}
            >
              ✕
            </span>
          </div>
        );
      })}
    </>
  );

  // ── main card: chat view ──────────────────────────────────
  const main = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* header */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 24px",
          borderBottom: `1px solid ${t.cardBorder}`,
        }}
      >
        <Avatar initials="AI" size={32} bg={status.aiIndigo} style={{ fontSize: 11.5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={ell(13.5, 700, t.text)}>RAYA · {activeTitle}</div>
          <div style={{ fontSize: 10.5, color: busy ? t.mutedLight : status.positive }}>
            {busy ? "RAYA is thinking…" : "● in session"}
          </div>
        </div>
        <span
          onClick={() => router.push("/profile")}
          style={{
            flex: "none",
            whiteSpace: "nowrap",
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: 11,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 99,
            padding: "6px 13px",
            color: t.mutedLight,
            cursor: "pointer",
          }}
        >
          View kernel profile
        </span>
        <span
          onClick={() => !busy && messages.length > 0 && onAnalyze()}
          title="Analyze the session (Kernel)"
          style={{
            flex: "none",
            fontSize: 11,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 99,
            padding: "6px 13px",
            color: t.mutedLight,
            cursor: busy || messages.length === 0 ? "default" : "pointer",
            opacity: busy || messages.length === 0 ? 0.45 : 1,
          }}
        >
          Analyze
        </span>
        <IconButton theme={t} onClick={() => setFilesOpen((o) => !o)} bg={filesOpen ? t.sidebarActiveBg : t.cardBg2}>
          <IconFile size={14} />
        </IconButton>
        <IconButton theme={t} onClick={() => setRightOpen((o) => !o)}>
          <IconPanel size={14} />
        </IconButton>
        {filesOpen && (
          <div
            style={{
              position: "absolute",
              top: 56,
              right: 24,
              zIndex: 5,
              width: 240,
              background: t.cardBg2,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 14,
              boxShadow: t.cardShadow,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 8 }}>Session documents</div>
            {sessionFiles.length === 0 && (
              <div style={{ fontSize: 10.5, color: t.muted }}>No documents yet.</div>
            )}
            {sessionFiles.map((f) => (
              <div
                key={f.id}
                onClick={() => setPreview(f)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, cursor: "pointer" }}
              >
                {(f.mime_type ?? "").startsWith("image/") ? (
                  <IconImage size={13} style={{ color: t.muted }} />
                ) : (
                  <IconFile size={13} style={{ color: t.muted }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={ell(10.5, 600, t.text)}>{f.file_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* thread */}
      {messages.length === 0 ? (
        <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
          <div style={{ position: "relative", display: "inline-block", maxWidth: 520 }}>
            <h1
              style={{
                fontFamily: hand,
                fontWeight: 700,
                fontSize: "clamp(2.2rem,5vw,3.4rem)",
                lineHeight: 1,
                margin: 0,
                color: t.text,
                animation: "writeReveal 2.2s cubic-bezier(0.65,0,0.35,1) 0.15s 1 both",
              }}
            >
              Hi {greetingName}, ready to learn?
            </h1>
            <Bird variant={1} fill={status.aiIndigo} />
            <Bird variant={2} fill={t.mutedLight} />
          </div>
          <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: 13, lineHeight: 1.7, color: t.muted }}>
            Tell me what you&apos;d like to work on today, or pick a quick restart.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460 }}>
            {["Resume fractions", "Review grammar", "Surprise quiz"].map((label, i) => (
              <span
                key={label}
                className="shine"
                onClick={() => onSend(label)}
                style={{
                  cursor: "pointer",
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 14,
                  padding: "12px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.text,
                  animation: `floatSm ${6.5 + i * 0.35}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, padding: "28px 32px", flexDirection: "column", gap: 16, overflow: "auto" }}>
          {messages.map((m) => {
            const mine = m.role !== "assistant";
            const files = filesByMessage[m.id] ?? [];
            return (
              <div
                key={m.id}
                style={{
                  maxWidth: "62%",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  background: mine ? t.ctaBg : t.bubbleBg,
                  color: mine ? t.ctaText : t.text,
                  borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "13px 16px",
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                }}
              >
                {files.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: m.content ? "0.4rem" : 0 }}>
                    {files.map((f) => (
                      <AttachmentCard key={f.id} file={f} onOpen={setPreview} />
                    ))}
                  </div>
                )}
                {m.content}
              </div>
            );
          })}
        </div>
      )}

      {/* pending attachments */}
      {(pending.length > 0 || uploading) && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", padding: "0 24px 8px" }}>
          {pending.map((a) => (
            <AttachmentChip key={a.id} file={a} onRemove={() => removePending(a.id)} busy={busy} />
          ))}
          {uploading && <span style={{ fontSize: 11, color: t.mutedLight }}>Reading the document…</span>}
        </div>
      )}

      {/* error */}
      {(error || voice.error) && (
        <div style={{ padding: "0 24px 8px", fontSize: 12, color: "#f87171" }}>{error || voice.error}</div>
      )}

      {/* composer */}
      <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.cardBorder}`, display: "flex", gap: 8, alignItems: "center" }}>
        <IconButton
          theme={t}
          size={38}
          radius={999}
          onClick={voice.toggle}
          title="Voice message"
          bg={voice.recording ? "#e0245e" : t.cardBg2}
          color={voice.recording ? "#fff" : t.mutedLight}
        >
          {voice.recording ? <span style={{ fontSize: 12 }}>■</span> : <IconMic size={16} />}
        </IconButton>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          disabled={busy}
          placeholder="Write your reply to RAYA..."
          style={{
            flex: 1,
            minWidth: 100,
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 99,
            padding: "12px 18px",
            fontSize: 12.5,
            color: t.text,
            outline: "none",
          }}
        />
        <label
          title="Attach a file"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: t.cardBg2,
            color: t.mutedLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: busy || uploading ? "default" : "pointer",
            flex: "none",
          }}
        >
          <IconAttach size={16} />
          <input
            type="file"
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            style={{ display: "none" }}
            onChange={(e) => {
              uploadDoc(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
            disabled={busy || uploading}
          />
        </label>
        <IconButton theme={t} size={38} radius={999} title="AI mode — Encouraging" color={t.text}>
          <IconAiMode size={16} />
        </IconButton>
        <span
          role="button"
          onClick={() => onSend()}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: t.ctaBg,
            color: t.ctaText,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flex: "none",
            cursor: busy || uploading || !input.trim() ? "default" : "pointer",
            opacity: busy || uploading || !input.trim() ? 0.5 : 1,
          }}
        >
          ↑
        </span>
      </div>
    </div>
  );

  // ── right panel: recommendations + kernel analysis ────────
  const rightPanel = rightOpen ? (
    <RightPanel theme={t} width={270}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: t.text }}>For you</div>
        {recommendations.length === 0 && (
          <div style={{ fontSize: 11, color: t.muted }}>No recommendations yet.</div>
        )}
        {recommendations.map((r, i) => (
          <div key={i} style={{ background: t.rowActiveBg, borderRadius: 12, padding: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{r.content}</div>
            <div style={{ fontSize: 9.5, color: t.muted, marginTop: 2 }}>{r.source}</div>
          </div>
        ))}
      </div>

      {analysis && (
        <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text, flex: 1 }}>Kernel analysis</span>
            <span onClick={() => downloadText("kernel-analysis", analysisToText(analysis))} style={pillBtn(t)}>TXT</span>
            <span onClick={() => downloadPdf("kernel-analysis", "Kernel analysis", analysisToText(analysis))} style={pillBtn(t)}>PDF</span>
            <span onClick={() => setAnalysis(null)} title="Close" style={pillBtn(t)}>✕</span>
          </div>
          <div style={{ fontSize: 11.5, color: t.text, marginBottom: 4 }}>
            <strong>Root gap:</strong> {analysis.root_gap ?? "—"}
          </div>
          <div style={{ fontSize: 11.5, color: t.text, marginBottom: 6 }}>
            <strong>Summary:</strong> {analysis.summary || "—"}
          </div>
          <div style={{ fontSize: 10, color: t.muted }}>
            Confidence: {analysis.confidence} · KCs: {Object.keys(analysis.mastery_map).length} · Model: {analysis.llm_used}
          </div>
        </div>
      )}
    </RightPanel>
  ) : null;

  return (
    <>
      <RayaShell
        theme={t}
        active="chat"
        profileName={studentName}
        profileInitials={initialsOf(studentName)}
        profileAvatarUrl={studentAvatarUrl}
        chatHistory={chatHistory}
        rightPanel={rightPanel}
      >
        {main}
      </RayaShell>
      {preview && (
        <FilePreview file={preview} scope="conversation" onClose={() => setPreview(null)} />
      )}
    </>
  );
}

const ell = (size: number, weight: number, color: string): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
const pillBtn = (t: AppTheme): React.CSSProperties => ({
  fontSize: 10,
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  color: t.mutedLight,
  borderRadius: 99,
  padding: "3px 8px",
  cursor: "pointer",
});
