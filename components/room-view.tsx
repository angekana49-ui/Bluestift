"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinRoom, postRoomMessage } from "@/app/rooms/actions";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { RoomChallenges } from "@/components/room-challenges";
import { RoomFiles } from "@/components/room-files";
import {
  AttachmentCard,
  AttachmentChip,
  FilePreview,
  splitByMessage,
  type Attachment,
  type AttachmentScope,
} from "@/components/attachment";
import { downloadText, downloadPdf } from "@/lib/export";
import { useDarkMode } from "@/components/ui/theme";
import { RayaShell } from "@/components/raya/raya-shell";
import { status, type AppTheme } from "@/components/ui/tokens";

function reportToText(r: {
  summary: string | null;
  key_learnings: string | null;
  highlights: unknown;
  recommendations: string | null;
  squad_score: number | null;
}): string {
  const highlights = Array.isArray(r.highlights) ? (r.highlights as string[]) : [];
  return [
    r.squad_score != null ? `Squad score: ${r.squad_score}/100` : "",
    `Summary: ${r.summary ?? "-"}`,
    `Key learnings: ${r.key_learnings ?? "-"}`,
    highlights.length ? `Highlights:\n${highlights.map((h) => `- ${h}`).join("\n")}` : "",
    `Recommendations: ${r.recommendations ?? "-"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

type Msg = {
  id: string;
  user_id: string | null;
  role: string;
  content: string | null;
  has_media?: boolean;
};
type PrivMsg = { id: string; role: string; content: string | null };
/** A learning.room_files row, already tied to the message that shared it. */
export type RoomFileRow = Attachment & { message_id: string | null };
/** A learning.conversation_files row from the private RAYA channel. */
export type PrivateFileRow = Attachment & { message_id: string | null };
type RoomReport = {
  id: string;
  summary: string | null;
  key_learnings: string | null;
  highlights: unknown;
  recommendations: string | null;
  squad_score: number | null;
  created_at: string;
} | null;

// Themed style helpers — built from the active theme inside the component.
const mkBtn = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const mkGhost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const mkInput = (t: AppTheme): React.CSSProperties => ({
  flex: 1,
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: 99,
  padding: "11px 16px",
  fontSize: 12.5,
  outline: "none",
});
const mkBubble = (t: AppTheme) => (kind: "me" | "raya" | "other"): React.CSSProperties => ({
  alignSelf: kind === "me" ? "flex-end" : "flex-start",
  background: kind === "me" ? t.ctaBg : kind === "raya" ? t.bubbleBg : t.bubbleAccentBg,
  color: kind === "me" ? t.ctaText : t.text,
  padding: "11px 14px",
  borderRadius: kind === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
  maxWidth: "72%",
  whiteSpace: "pre-wrap",
  fontSize: 13,
  lineHeight: 1.6,
});
const mkListBox = (t: AppTheme): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minHeight: 280,
  maxHeight: "52vh",
  overflow: "auto",
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 16,
  padding: 16,
  margin: "16px 0",
});

export function RoomView({
  roomId,
  roomName,
  subject,
  visibility,
  timerEndsAt,
  isMember,
  memberCount,
  myUserId,
  studentName,
  studentInitials,
  studentAvatarUrl,
  initialMessages,
  initialRoomFiles,
  privateConvId,
  privateMessages,
  privateFiles,
  initialReport,
}: {
  roomId: string;
  roomName: string;
  subject: string | null;
  visibility: string;
  timerEndsAt: string | null;
  isMember: boolean;
  memberCount: number;
  myUserId: string;
  studentName: string;
  studentInitials: string;
  studentAvatarUrl?: string | null;
  initialMessages: Msg[];
  initialRoomFiles: RoomFileRow[];
  privateConvId: string | null;
  privateMessages: PrivMsg[];
  privateFiles: PrivateFileRow[];
  initialReport: RoomReport;
}) {
  const router = useRouter();
  const { theme: t } = useDarkMode();
  const btn = mkBtn(t);
  const ghost = mkGhost(t);
  const inputStyle = mkInput(t);
  const bubble = mkBubble(t);
  const listBox = mkListBox(t);
  const [supabase] = useState(() => createClient());
  const [joined, setJoined] = useState(isMember);
  const [copied, setCopied] = useState(false);

  // Session timer: a live countdown to `timerEndsAt`. `remainingMs` ticks every
  // second; once it hits 0 the room is read-only (server enforces it too). An
  // untimed room (null) has no countdown and is always open.
  const [remainingMs, setRemainingMs] = useState<number | null>(
    timerEndsAt ? new Date(timerEndsAt).getTime() - Date.now() : null,
  );
  useEffect(() => {
    if (!timerEndsAt) {
      setRemainingMs(null);
      return;
    }
    const end = new Date(timerEndsAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, end - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timerEndsAt]);
  const expired = remainingMs != null && remainingMs <= 0;

  function fmtRemaining(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  const [channel, setChannel] = useState<
    "group" | "private" | "challenge" | "report" | "files"
  >("group");
  const [report, setReport] = useState<RoomReport>(initialReport);
  const [repBusy, setRepBusy] = useState(false);

  async function generateReport() {
    if (repBusy) return;
    setRepBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not generate the report.");
        return;
      }
      setReport(data.report);
    } catch {
      setError("Could not generate the report.");
    } finally {
      setRepBusy(false);
    }
  }

  // Group channel state
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Shared documents, keyed by the room_messages row that announced them.
  const [roomFiles, setRoomFiles] = useState<Record<string, Attachment>>(() => {
    const map: Record<string, Attachment> = {};
    for (const f of initialRoomFiles) if (f.message_id) map[f.message_id] = f;
    return map;
  });
  const [groupUploading, setGroupUploading] = useState(false);
  const [preview, setPreview] = useState<{ file: Attachment; scope: AttachmentScope } | null>(
    null,
  );

  // Roster (names) + live presence (who's online)
  type RosterEntry = {
    user_id: string;
    display_name: string | null;
    username: string | null;
    role: string;
    profile_picture_url: string | null;
  };
  const [roster, setRoster] = useState<Record<string, RosterEntry>>({});
  const [online, setOnline] = useState<Set<string>>(new Set());

  function nameOf(userId: string | null): string {
    if (!userId) return "Member";
    const r = roster[userId];
    return r?.display_name || (r?.username ? `@${r.username}` : "Member");
  }

  // Private channel state
  const privInitial = splitByMessage(privateFiles);
  const [privConvId, setPrivConvId] = useState(privateConvId);
  const [privMsgs, setPrivMsgs] = useState<PrivMsg[]>(privateMessages);
  const [privInput, setPrivInput] = useState("");
  const [privBusy, setPrivBusy] = useState(false);
  const [privPending, setPrivPending] = useState<Attachment[]>(privInitial.staged);
  const [privFiles, setPrivFiles] = useState<Record<string, Attachment[]>>(privInitial.byMessage);
  const [privUploading, setPrivUploading] = useState(false);
  const privEndRef = useRef<HTMLDivElement>(null);

  // Voice input for each RAYA channel (record → transcribe → send).
  const groupVoice = useVoiceRecorder((text) => send(text));
  const privVoice = useVoiceRecorder((text) => sendPrivate(text));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    privEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [privMsgs]);

  // Load member names (safe SECURITY DEFINER RPC — names only, members only).
  useEffect(() => {
    if (!joined) return;
    supabase.rpc("room_roster", { p_room_id: roomId }).then(({ data }) => {
      if (!data) return;
      const map: Record<string, RosterEntry> = {};
      for (const r of data) map[r.user_id] = r;
      setRoster(map);
    });
  }, [joined, roomId, supabase]);

  // Live group channel: new messages (postgres_changes) + presence (who's online).
  useEffect(() => {
    if (!joined) return;
    const ch = supabase
      .channel(`room-${roomId}`, { config: { presence: { key: myUserId } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "learning",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(ch.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [joined, roomId, myUserId, supabase]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await joinRoom(roomId);
      setJoined(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  // Realtime only carries room_messages. When a document notice arrives (ours or
  // a teammate's) we still need its file row to render the card.
  useEffect(() => {
    const missing = messages
      .filter((m) => m.has_media && !roomFiles[m.id])
      .map((m) => m.id);
    if (missing.length === 0) return;
    let cancelled = false;
    supabase
      .schema("learning")
      .from("room_files")
      .select("id, message_id, file_name, file_type, mime_type, file_size")
      .in("message_id", missing)
      .then(({ data }) => {
        if (cancelled || !data?.length) return;
        setRoomFiles((prev) => {
          const next = { ...prev };
          for (const f of data) if (f.message_id) next[f.message_id] = f;
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [messages, roomFiles, supabase]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy || expired) return;
    if (textArg === undefined) setInput("");
    try {
      await postRoomMessage(roomId, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    }
  }

  /** Share a document with the whole room. Realtime fans the notice out. */
  async function uploadRoomDoc(file: File | null) {
    if (!file || groupUploading || expired) return;
    setGroupUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("file", file);
      const res = await fetch("/api/rooms/files", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Upload failed.");
        return;
      }
      const f = data.file as RoomFileRow | undefined;
      if (f?.message_id) setRoomFiles((m) => ({ ...m, [f.message_id as string]: f }));
    } catch {
      setError("Upload failed.");
    } finally {
      setGroupUploading(false);
    }
  }

  async function askRaya() {
    if (busy || expired) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms/raya", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? `RAYA: ${data.error}` : "RAYA could not reply.");
      }
    } catch {
      setError("Could not reach RAYA.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Attach a document to the private RAYA channel. It lands on this
   * conversation, never on room_files, so the group never sees it — but
   * /api/raya/chat merges both sources, so RAYA still reads it.
   */
  async function uploadPrivateDoc(file: File | null) {
    if (!file || privUploading || expired) return;
    setPrivUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      if (privConvId) fd.append("conversationId", privConvId);
      fd.append("file", file);
      const res = await fetch("/api/raya/files", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? `Upload: ${data.error}` : "Upload failed.");
        return;
      }
      if (data.conversationId) setPrivConvId(data.conversationId);
      if (data.file) setPrivPending((a) => [...a, data.file as Attachment]);
    } catch {
      setError("Upload failed.");
    } finally {
      setPrivUploading(false);
    }
  }

  async function removePrivatePending(id: string) {
    setPrivPending((a) => a.filter((f) => f.id !== id));
    try {
      await fetch(`/api/raya/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // The chip is already gone; a stale row costs nothing but storage.
    }
  }

  // Private student<->RAYA channel (reuses the streaming chat endpoint).
  async function sendPrivate(textArg?: string) {
    const text = (textArg ?? privInput).trim();
    if (!text || privBusy || privUploading || expired) return;
    const sentFiles = privPending;
    const tmpId = `tmp-${Date.now()}`;
    setPrivBusy(true);
    setError(null);
    setPrivMsgs((m) => [...m, { id: tmpId, role: "user", content: text }]);
    if (sentFiles.length) {
      setPrivFiles((map) => ({ ...map, [tmpId]: sentFiles }));
      setPrivPending([]);
    }
    if (textArg === undefined) setPrivInput("");
    try {
      const res = await fetch("/api/raya/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: privConvId,
          content: text,
          roomId,
          fileIds: sentFiles.map((f) => f.id),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? `RAYA: ${data.error}` : `Request failed (${res.status}).`);
        // Hand the files back to the composer — the turn never happened.
        if (sentFiles.length) {
          setPrivFiles((map) => {
            const next = { ...map };
            delete next[tmpId];
            return next;
          });
          setPrivPending(sentFiles);
        }
        setPrivMsgs((m) => m.filter((x) => x.id !== tmpId));
        return;
      }
      const cid = res.headers.get("x-conversation-id");
      if (cid) setPrivConvId(cid);
      const msgId = res.headers.get("x-message-id");
      if (msgId) {
        setPrivMsgs((m) => m.map((x) => (x.id === tmpId ? { ...x, id: msgId } : x)));
        if (sentFiles.length) {
          setPrivFiles(({ [tmpId]: moved, ...rest }) =>
            moved ? { ...rest, [msgId]: moved } : rest,
          );
        }
      }
      const rayaId = `raya-${Date.now()}`;
      setPrivMsgs((m) => [...m, { id: rayaId, role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setPrivMsgs((m) =>
          m.map((x) => (x.id === rayaId ? { ...x, content: (x.content ?? "") + chunk } : x)),
        );
      }
    } catch {
      setError("Could not reach RAYA.");
    } finally {
      setPrivBusy(false);
    }
  }

  const body = (
    <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.text, fontFamily: "var(--font-inter-tight),'Inter Tight',sans-serif" }}>{roomName}</h1>
        <span style={{ color: t.muted, fontSize: 12.5 }}>
          {subject ?? "—"} · {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        {remainingMs != null && (
          <span
            style={{
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              borderRadius: 99,
              padding: "3px 10px",
              color: expired ? "#b91c1c" : remainingMs <= 120_000 ? "#b45309" : t.text,
              background: expired
                ? "rgba(239,68,68,0.12)"
                : remainingMs <= 120_000
                  ? "rgba(245,158,11,0.14)"
                  : t.cardBg2,
              border: `1px solid ${expired ? "rgba(239,68,68,0.4)" : remainingMs <= 120_000 ? "rgba(245,158,11,0.45)" : t.cardBorder}`,
            }}
            title={expired ? "The session has ended" : "Time left in this session"}
          >
            ⏱ {expired ? "Ended" : `${fmtRemaining(remainingMs)} left`}
          </span>
        )}
      </div>

      {!joined ? (
        <div
          style={{
            background: t.cardBg2,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 18,
            padding: 24,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          <p style={{ color: t.muted, fontSize: 13 }}>Join this room to see the conversation.</p>
          <button style={btn} onClick={join} disabled={busy}>
            Join the room
          </button>
          {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {[
              { id: "raya", label: "RAYA", on: true, avatar: null as string | null },
              ...Object.values(roster).map((r) => ({
                id: r.user_id,
                label: r.user_id === myUserId ? "You" : nameOf(r.user_id),
                on: online.has(r.user_id),
                avatar: r.profile_picture_url,
              })),
            ].map((m) => (
              <span
                key={m.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  color: t.text,
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 99,
                  padding: "3px 10px 3px 4px",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: m.id === "raya" ? status.aiIndigo : "#c7d2fe",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: m.id === "raya" ? "#fff" : "#0b1220",
                    flexShrink: 0,
                  }}
                >
                  {m.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : m.id === "raya" ? (
                    "R"
                  ) : (
                    m.label.charAt(0).toUpperCase()
                  )}
                </span>
                {m.label}
                <span className={m.on ? "online-dot" : "offline-dot"} />
              </span>
            ))}
          </div>

          {visibility === "private" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                fontSize: 12,
                color: t.muted,
                background: t.cardBg2,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              <span>🔒 Private room — share the invite link:</span>
              <button style={{ ...ghost, padding: "5px 12px", fontSize: 11 }} onClick={copyInvite}>
                {copied ? "Copied ✓" : "Copy the link"}
              </button>
            </div>
          )}

          {expired && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                fontSize: 12,
                color: t.text,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 12,
                padding: "9px 14px",
              }}
            >
              <span aria-hidden>🔒</span>
              <span>
                This session has ended — the room is now <strong>read-only</strong>. You can still read the
                conversation and generate the session report.
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
            {(["group", "private", "challenge", "files", "report"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                style={channel === c ? { ...btn, fontSize: 12 } : { ...ghost, fontSize: 12 }}
              >
                {c === "group"
                  ? "Group chat"
                  : c === "private"
                    ? "RAYA (private)"
                    : c === "challenge"
                      ? "Challenges"
                      : c === "files"
                        ? "Files"
                        : "Report"}
              </button>
            ))}
          </div>

          {channel === "group" ? (
            <>
              <div style={listBox}>
                {messages.length === 0 && (
                  <p style={{ color: t.muted, fontSize: 12.5 }}>No messages yet. Say hi 👋</p>
                )}
                {messages.map((m) => {
                  // Document-shared event (livestreamed on upload).
                  if (m.has_media) {
                    const who = m.user_id === myUserId ? "You" : nameOf(m.user_id);
                    const file = roomFiles[m.id];
                    // Notices posted before attachments existed have no file row —
                    // fall back to the plain name they carry in `content`.
                    if (!file) {
                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: "center",
                            fontSize: 11,
                            color: t.muted,
                            background: t.cardBg2,
                            border: `1px solid ${t.cardBorder}`,
                            borderRadius: 99,
                            padding: "5px 12px",
                          }}
                        >
                          📄 {who} shared a document: <strong>{m.content}</strong>
                        </div>
                      );
                    }
                    const mine = m.user_id === myUserId;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: mine ? "flex-end" : "flex-start",
                        }}
                      >
                        <span style={{ fontSize: 10, color: t.mutedLight }}>
                          {who} shared a document
                        </span>
                        <div style={{ ...bubble(mine ? "me" : "other"), minWidth: 220 }}>
                          <AttachmentCard
                            file={file}
                            onOpen={(f) => setPreview({ file: f, scope: "room" })}
                          />
                        </div>
                      </div>
                    );
                  }
                  const kind =
                    m.role === "assistant"
                      ? "raya"
                      : m.user_id === myUserId
                        ? "me"
                        : "other";
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: t.mutedLight,
                          alignSelf: kind === "me" ? "flex-end" : "flex-start",
                        }}
                      >
                        {kind === "raya" ? "RAYA" : kind === "me" ? "You" : nameOf(m.user_id)}
                      </span>
                      <div style={bubble(kind)}>{m.content}</div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {groupUploading && (
                <p style={{ fontSize: 11, color: t.mutedLight, margin: "0 0 8px" }}>
                  Uploading and reading the document…
                </p>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: expired ? 0.5 : 1 }}>
                <label style={{ ...ghost, display: "inline-flex", alignItems: "center", pointerEvents: expired ? "none" : undefined }} title="Share a document with the room">
                  📎
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      uploadRoomDoc(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    disabled={groupUploading || expired}
                  />
                </label>
                <button
                  style={{ ...ghost, background: groupVoice.recording ? "#e0245e" : t.cardBg2, color: groupVoice.recording ? "#fff" : t.text }}
                  onClick={groupVoice.toggle}
                  disabled={expired || (groupVoice.busy && !groupVoice.recording)}
                  title="Voice message"
                >
                  {groupVoice.recording ? "■" : groupVoice.busy ? "…" : "🎤"}
                </button>
                <input
                  style={inputStyle}
                  placeholder={expired ? "Session ended — read-only" : "Message the group…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={expired}
                />
                <button style={{ ...btn, opacity: expired || !input.trim() ? 0.5 : 1 }} onClick={() => send()} disabled={expired || !input.trim()}>
                  Send
                </button>
                <button style={ghost} onClick={askRaya} disabled={busy || expired}>
                  Ask RAYA
                </button>
              </div>
              {groupVoice.error && (
                <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>
                  {groupVoice.error}
                </p>
              )}
            </>
          ) : channel === "private" ? (
            <>
              <p style={{ color: t.mutedLight, fontSize: 11.5, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🔒 Private — only you and RAYA can see this conversation.
              </p>
              <div style={listBox}>
                {privMsgs.length === 0 && (
                  <p style={{ color: t.muted, fontSize: 12.5 }}>Ask RAYA any question about the room&apos;s topic.</p>
                )}
                {privMsgs.map((m) => {
                  const files = privFiles[m.id] ?? [];
                  return (
                    <div key={m.id} style={bubble(m.role === "assistant" ? "raya" : "me")}>
                      {files.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.3rem",
                            marginBottom: m.content ? "0.4rem" : 0,
                          }}
                        >
                          {files.map((f) => (
                            <AttachmentCard
                              key={f.id}
                              file={f}
                              onOpen={(file) => setPreview({ file, scope: "conversation" })}
                            />
                          ))}
                        </div>
                      )}
                      {m.content}
                    </div>
                  );
                })}
                <div ref={privEndRef} />
              </div>

              {(privPending.length > 0 || privUploading) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  {privPending.map((a) => (
                    <AttachmentChip
                      key={a.id}
                      file={a}
                      onRemove={() => removePrivatePending(a.id)}
                      busy={privBusy}
                    />
                  ))}
                  {privUploading && (
                    <span style={{ fontSize: 11, color: t.mutedLight }}>Reading the document…</span>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: expired ? 0.5 : 1 }}>
                <label style={{ ...ghost, display: "inline-flex", alignItems: "center", pointerEvents: expired ? "none" : undefined }} title="Attach a document — private between you and RAYA">
                  📎
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      uploadPrivateDoc(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    disabled={privBusy || privUploading || expired}
                  />
                </label>
                <button
                  style={{ ...ghost, background: privVoice.recording ? "#e0245e" : t.cardBg2, color: privVoice.recording ? "#fff" : t.text }}
                  onClick={privVoice.toggle}
                  disabled={privBusy || expired || (privVoice.busy && !privVoice.recording)}
                  title="Voice message"
                >
                  {privVoice.recording ? "■" : privVoice.busy ? "…" : "🎤"}
                </button>
                <input
                  style={inputStyle}
                  placeholder={expired ? "Session ended — read-only" : "Write privately to RAYA…"}
                  value={privInput}
                  onChange={(e) => setPrivInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendPrivate()}
                  disabled={privBusy || expired}
                />
                <button
                  style={{ ...btn, opacity: privBusy || privUploading || expired || !privInput.trim() ? 0.5 : 1 }}
                  onClick={() => sendPrivate()}
                  disabled={privBusy || privUploading || expired || !privInput.trim()}
                >
                  Send
                </button>
              </div>
              {privVoice.error && (
                <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>
                  {privVoice.error}
                </p>
              )}
            </>
          ) : channel === "challenge" ? (
            <RoomChallenges roomId={roomId} subject={subject} myUserId={myUserId} readOnly={expired} />
          ) : channel === "files" ? (
            <RoomFiles roomId={roomId} readOnly={expired} />
          ) : (
            <div style={listBox}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, color: t.text }}>Session report</h3>
                {report && (
                  <>
                    <button style={{ ...ghost, padding: "5px 12px", fontSize: 11 }} onClick={() => downloadText(`${roomName}-report`, reportToText(report))}>
                      TXT
                    </button>
                    <button style={{ ...ghost, padding: "5px 12px", fontSize: 11 }} onClick={() => downloadPdf(`${roomName}-report`, `${roomName} — session report`, reportToText(report))}>
                      PDF
                    </button>
                    <button style={{ ...ghost, padding: "5px 12px", fontSize: 11 }} title="Close" onClick={() => setReport(null)}>
                      ✕
                    </button>
                  </>
                )}
                <button style={{ ...btn, opacity: repBusy ? 0.6 : 1 }} onClick={generateReport} disabled={repBusy}>
                  {repBusy ? "Generating…" : report ? "Regenerate" : "Generate the report"}
                </button>
              </div>
              {!report ? (
                <p style={{ color: t.muted, fontSize: 12.5 }}>
                  No report yet — generate one from the room conversation.
                </p>
              ) : (
                <div style={{ lineHeight: 1.6, color: t.text, fontSize: 13 }}>
                  {report.squad_score != null && (
                    <p>
                      <strong>Squad score:</strong> {report.squad_score}/100
                    </p>
                  )}
                  <p>
                    <strong>Summary:</strong> {report.summary ?? "—"}
                  </p>
                  <p>
                    <strong>Key learnings:</strong> {report.key_learnings ?? "—"}
                  </p>
                  {Array.isArray(report.highlights) &&
                    (report.highlights as string[]).length > 0 && (
                      <>
                        <strong>Highlights:</strong>
                        <ul style={{ marginTop: 4 }}>
                          {(report.highlights as string[]).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  <p>
                    <strong>Recommendations:</strong> {report.recommendations ?? "—"}
                  </p>
                </div>
              )}
            </div>
          )}
          {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 12.5 }}>{error}</p>}
        </>
      )}

      {preview && (
        <FilePreview
          file={preview.file}
          scope={preview.scope}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );

  return (
    <RayaShell
      active="rooms"
      theme={t}
      profileName={studentName || "My account"}
      profileInitials={studentInitials}
      profileAvatarUrl={studentAvatarUrl}
      mainMinWidth={340}
    >
      {body}
    </RayaShell>
  );
}
