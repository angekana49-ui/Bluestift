"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { joinRoom, postRoomMessage } from "@/app/rooms/actions";
import { dispatchUpgrade } from "@/lib/upgrade";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { RoomChallenges } from "@/components/room-challenges";
import { RoomFiles } from "@/components/room-files";
import { FilePreview, type Attachment } from "@/components/attachment";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { ShareLinkButton } from "@/components/study/share-button";
import { useDarkMode } from "@/components/ui/theme";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel, IconButton } from "@/components/ui/shell";
import { IconPanel, IconFile } from "@/components/ui/icons";
import { status, type AppTheme } from "@/components/ui/tokens";
import { RayaName } from "@/components/ui/brand";
import { avatarInitials } from "@/lib/name";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { RoomGroupChat, type GroupMsg } from "@/components/rooms/room-group-chat";
import type { ChatConfig, Msg as ChatMsg, ConversationFile } from "@/components/chat/types";

function reportToMd(r: {
  summary: string | null;
  key_learnings: string | null;
  highlights: unknown;
  recommendations: string | null;
  squad_score: number | null;
}): string {
  const highlights = Array.isArray(r.highlights) ? (r.highlights as string[]) : [];
  return [
    r.squad_score != null ? `## Squad score\n${r.squad_score}/100` : "",
    `## Summary\n${r.summary ?? "—"}`,
    `## Key learnings\n${r.key_learnings ?? "—"}`,
    highlights.length ? `## Highlights\n${highlights.map((h) => `- ${h}`).join("\n")}` : "",
    `## Recommendations\n${r.recommendations ?? "—"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Branded session-report document (Raya logo, "…for <room> room" footer). */
function reportDoc(roomName: string, r: Parameters<typeof reportToMd>[0]): BrandedDoc {
  return {
    brand: "raya",
    title: `${roomName} — session report`,
    meta: new Date().toLocaleDateString(),
    audience: `${roomName} room`,
    body: reportToMd(r),
  };
}

/** A learning.room_files row, already tied to the message that shared it. */
export type RoomFileRow = Attachment & { message_id: string | null };
/** A learning.conversation_files row from the private Raya channel. */
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
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const mkGhost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
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
  studentPlan,
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
  studentPlan?: string;
  initialMessages: GroupMsg[];
  initialRoomFiles: RoomFileRow[];
  privateConvId: string | null;
  privateMessages: ChatMsg[];
  privateFiles: PrivateFileRow[];
  initialReport: RoomReport;
}) {
  const router = useRouter();
  const { theme: t } = useDarkMode();
  const btn = mkBtn(t);
  const ghost = mkGhost(t);
  const listBox = mkListBox(t);
  const [supabase] = useState(() => createClient());
  const [joined, setJoined] = useState(isMember);
  const [copied, setCopied] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);
  const greetingName = studentName.trim().split(/\s+/)[0] || "";
  const myInitials = avatarInitials(studentName);

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
  const [messages, setMessages] = useState<GroupMsg[]>(initialMessages);
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
  const [preview, setPreview] = useState<Attachment | null>(null);

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
  // The live channel dropped: presence and instant delivery are stale until it
  // comes back. Surfaced to the student rather than left as a silent divergence.
  const [realtimeDown, setRealtimeDown] = useState(false);

  function nameOf(userId: string | null): string {
    if (!userId) return "Member";
    const r = roster[userId];
    return r?.display_name || (r?.username ? `@${r.username}` : "Member");
  }

  /** A member's avatar seed (initials + optional photo) for the chat + panel. */
  function avatarOf(userId: string | null): { initials: string; avatarUrl: string | null } {
    const r = userId ? roster[userId] : null;
    return { initials: avatarInitials(nameOf(userId)), avatarUrl: r?.profile_picture_url ?? null };
  }

  // Private student<->Raya channel — the very same surface as the solo /chat,
  // driven by the shared chat engine. `roomId` rides along in every request so
  // the streaming endpoint scopes the conversation to this room and grounds
  // Raya on the room's shared documents.
  const privateConfig: ChatConfig = {
    endpoints: {
      chat: "/api/raya/chat",
      conversations: "/api/raya/conversations",
      files: "/api/raya/files",
    },
    capabilities: { voice: true, files: true },
    greeting: (name) => (name ? `This stays between us, ${name}` : "Private line to Raya"),
    emptyHint: "Private to you and Raya. Ask anything about the room's topic — Raya can read the shared documents.",
    suggestions: ["Explain the key idea", "Quiz me on this", "Break down the shared docs"],
    placeholder: "Write privately to Raya…",
    extraBody: { roomId },
    // Hybrid: no LLM needed — when the room has a subject we template the chips
    // from it (works offline); otherwise the static set above stays.
    personalizedHooks: async () => {
      const s = subject?.trim();
      if (!s) return null;
      return { suggestions: [`Explain the key idea of ${s}`, `Quiz me on ${s}`, "Break down the shared docs"] };
    },
  };
  const privateEngine = useChatEngine({
    config: privateConfig,
    initialId: privateConvId,
    initialMessages: privateMessages,
    initialFiles: privateFiles as ConversationFile[],
    initialConversations: [],
  });

  // Voice input for the group Raya channel (record → transcribe → send). The
  // private channel gets its own voice from the shared engine.
  const groupVoice = useVoiceRecorder((text) => send(text));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  /**
   * Merge messages by id, keeping chronological order. Every arrival path
   * (Realtime, the ask-Raya response, a reconnect backfill) goes through here,
   * so a message delivered twice renders once.
   */
  const mergeMessages = useCallback((incoming: GroupMsg[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const added = incoming.filter((m) => !known.has(m.id));
      if (added.length === 0) return prev;
      return [...prev, ...added].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      );
    });
  }, []);

  // Everything received so far, as a backfill watermark. A ref, not state, so
  // the subscription effect doesn't re-run on every message.
  const lastSeenRef = useRef<string | null>(null);
  useEffect(() => {
    for (const m of messages) {
      if (m.created_at && (!lastSeenRef.current || m.created_at > lastSeenRef.current)) {
        lastSeenRef.current = m.created_at;
      }
    }
  }, [messages]);

  /** Fetch whatever arrived while we were disconnected. */
  const backfill = useCallback(async () => {
    if (!joined) return;
    let q = supabase
      .schema("learning")
      .from("room_messages")
      .select("id, user_id, role, content, has_media, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (lastSeenRef.current) q = q.gt("created_at", lastSeenRef.current);
    const { data } = await q;
    if (data?.length) mergeMessages(data as GroupMsg[]);
  }, [joined, roomId, supabase, mergeMessages]);

  // Live group channel: new messages (postgres_changes) + presence (who's
  // online). The socket is the first casualty of a weak link, so a dropped
  // channel re-subscribes with backoff and every (re)connection backfills what
  // it missed — otherwise the thread silently diverges from the database.
  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      ch = supabase
        .channel(`room-${roomId}`, { config: { presence: { key: myUserId } } })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "learning",
            table: "room_messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => mergeMessages([payload.new as GroupMsg]),
        )
        .on("presence", { event: "sync" }, () => {
          if (ch) setOnline(new Set(Object.keys(ch.presenceState())));
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            attempt = 0;
            setRealtimeDown(false);
            ch?.track({ online_at: new Date().toISOString() });
            void backfill();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeDown(true);
            const current = ch;
            ch = null;
            if (current) void supabase.removeChannel(current);
            // Capped exponential backoff: 1s, 2s, 4s… up to 30s.
            const delay = Math.min(30_000, 1000 * 2 ** attempt++);
            retry = setTimeout(connect, delay);
          }
        });
    };
    connect();

    // A tab returning to the foreground, or a regained radio, is the cheapest
    // moment to reconcile.
    const onWake = () => {
      if (document.visibilityState === "visible") void backfill();
    };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
      if (ch) supabase.removeChannel(ch);
    };
  }, [joined, roomId, myUserId, supabase, mergeMessages, backfill]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom(roomId);
      if (result && "error" in result) {
        dispatchUpgrade({ code: result.code, message: result.error });
        setBusy(false);
        return;
      }
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
    if (!text || expired) return;
    try {
      await postRoomMessage(roomId, text);
      // Only clear the composer once the message is actually away — clearing
      // first (as this did) threw the text away on every failed send.
      if (textArg === undefined) setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send — your message is still here.");
      if (textArg === undefined) setInput(text);
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
      const res = await netFetch(
        "/api/rooms/raya",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId }),
        },
        { timeoutMs: 60_000 }, // a group reply is a full, non-streamed generation
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? `Raya: ${data.error}` : "Raya could not reply.");
        return;
      }
      // Render the reply straight from the response. Realtime may also deliver
      // it (deduplicated by id) — but if the socket is down, this is the only
      // way the student who asked ever sees it.
      if (data?.message) mergeMessages([data.message as GroupMsg]);
    } catch {
      setError("Could not reach Raya.");
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (on: boolean): React.CSSProperties =>
    on ? { ...btn, fontSize: 14 } : { ...ghost, fontSize: 14 };

  // The room's shared documents, for the header docs popover + the panel list.
  const sharedDocs = Object.values(roomFiles);

  // The room chrome (title, timer, members, tabs) — a solid strip pinned above
  // the chat, exactly where /chat keeps its session header.
  const chrome = (
    <div
      style={{
        flex: "none",
        background: t.cardBg,
        borderBottom: `1px solid ${t.cardBorder}`,
        padding: "16px 24px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: t.text, fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>{roomName}</h1>
        <span style={{ color: t.muted, fontSize: 15 }}>
          {subject ?? "—"} · {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        {remainingMs != null && (
          <span
            style={{
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 14,
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
        {joined && (
          <span style={{ marginLeft: "auto", alignSelf: "center", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
            {/* Documents — a quick popover right in the header, like the chat
                header's files button. Keeps doc access out of the nav. */}
            <IconButton
              theme={t}
              onClick={() => setDocsOpen((o) => !o)}
              title="Room documents"
              bg={docsOpen ? t.sidebarActiveBg : t.cardBg2}
            >
              <IconFile size={14} />
            </IconButton>
            {/* Panel toggle: only when the panel is retracted (it has its own
                collapse), and hidden on phone where the mobile header owns it. */}
            {!rightOpen && (
              <span className="app-hide-phone" style={{ display: "inline-flex" }}>
                <IconButton theme={t} onClick={() => setRightOpen(true)} title="Show panel">
                  <IconPanel size={14} />
                </IconButton>
              </span>
            )}
            {docsOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 6,
                  width: 244,
                  maxHeight: 320,
                  overflow: "auto",
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 14,
                  boxShadow: t.cardShadow,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Room documents</div>
                {sharedDocs.length === 0 ? (
                  <div style={{ fontSize: 13, color: t.muted }}>No documents yet.</div>
                ) : (
                  sharedDocs.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setPreview(f);
                        setDocsOpen(false);
                      }}
                      title={f.file_name ?? undefined}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 15, flex: "none" }}>📄</span>
                      <span style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {f.file_name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </span>
        )}
      </div>

      {joined && (
        <>
          {expired && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                fontSize: 14,
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

          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {(["group", "private", "challenge", "files", "report"] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)} style={tabBtn(channel === c)}>
                {c === "group"
                  ? "Group chat"
                  : c === "private"
                    ? <><RayaName /> (private)</>
                    : c === "challenge"
                      ? "Challenges"
                      : c === "files"
                        ? "Files"
                        : "Report"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // The active channel fills the space under the chrome. The two chat channels
  // render on the shared chat surface; the rest scroll inside a padded pane.
  let channelBody: React.ReactNode;
  if (!joined) {
    channelBody = (
      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
        <div
          style={{
            background: t.cardBg2,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 18,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ color: t.muted, fontSize: 15 }}>Join this room to see the conversation.</p>
          <button style={btn} onClick={join} disabled={busy}>
            Join the room
          </button>
          {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
        </div>
      </div>
    );
  } else if (channel === "group") {
    channelBody = (
      <RoomGroupChat
        theme={t}
        myUserId={myUserId}
        messages={messages}
        nameOf={nameOf}
        avatarOf={avatarOf}
        myInitials={myInitials}
        myAvatarUrl={studentAvatarUrl}
        roomFiles={roomFiles}
        onPreview={setPreview}
        greetingName={greetingName}
        input={input}
        onInput={setInput}
        onSend={send}
        onUpload={uploadRoomDoc}
        uploading={groupUploading}
        voice={groupVoice}
        onAskRaya={askRaya}
        busy={busy}
        expired={expired}
        error={error}
        liveDown={realtimeDown}
        endRef={endRef}
        subject={subject}
      />
    );
  } else if (channel === "private") {
    channelBody = (
      <ChatSurface
        theme={t}
        engine={privateEngine}
        config={privateConfig}
        greetingName={greetingName}
        hideHeader
        userInitials={myInitials}
        userAvatarUrl={studentAvatarUrl}
      />
    );
  } else {
    channelBody = (
      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
        {channel === "challenge" ? (
          <RoomChallenges roomId={roomId} roomName={roomName} subject={subject} myUserId={myUserId} readOnly={expired} />
        ) : channel === "files" ? (
          <RoomFiles roomId={roomId} readOnly={expired} />
        ) : (
          <div style={listBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: t.text }}>Session report</h3>
              {report && (
                <>
                  <button style={{ ...ghost, padding: "5px 12px", fontSize: 13 }} onClick={() => downloadBrandedText(reportDoc(roomName, report))}>
                    TXT
                  </button>
                  <button style={{ ...ghost, padding: "5px 12px", fontSize: 13 }} onClick={() => downloadBrandedPdf(reportDoc(roomName, report))}>
                    PDF
                  </button>
                  <ShareLinkButton theme={t} doc={reportDoc(roomName, report)} />
                  <button style={{ ...ghost, padding: "5px 12px", fontSize: 13 }} title="Close" onClick={() => setReport(null)}>
                    ✕
                  </button>
                </>
              )}
              <button style={{ ...btn, opacity: repBusy ? 0.6 : 1 }} onClick={generateReport} disabled={repBusy}>
                {repBusy ? "Generating…" : report ? "Regenerate" : "Generate the report"}
              </button>
            </div>
            {!report ? (
              <p style={{ color: t.muted, fontSize: 15 }}>
                No report yet — generate one from the room conversation.
              </p>
            ) : (
              <div style={{ lineHeight: 1.6, color: t.text, fontSize: 15 }}>
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
        {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 15 }}>{error}</p>}
      </div>
    );
  }

  const onlineCount = Object.values(roster).filter((r) => online.has(r.user_id)).length;

  // A light, derived notifications feed — no table, just the room's live signals.
  const notifications: { id: string; tone: "risk" | "warn" | "info"; title: string; detail: string }[] = [];
  if (expired) {
    notifications.push({ id: "ended", tone: "risk", title: "Session ended", detail: "The room is now read-only." });
  } else if (remainingMs != null && remainingMs <= 120_000) {
    notifications.push({ id: "soon", tone: "warn", title: "Ending soon", detail: `${fmtRemaining(remainingMs)} left in this session.` });
  } else if (remainingMs != null) {
    notifications.push({ id: "running", tone: "info", title: "Session in progress", detail: `${fmtRemaining(remainingMs)} left.` });
  }
  notifications.push({ id: "presence", tone: "info", title: `${onlineCount} member${onlineCount === 1 ? "" : "s"} online`, detail: `${memberCount} in this room.` });
  if (sharedDocs.length > 0) {
    notifications.push({ id: "docs", tone: "info", title: `${sharedDocs.length} document${sharedDocs.length === 1 ? "" : "s"} shared`, detail: "Open the Documents section to review them." });
  }

  const panelSectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: t.mutedLight,
    margin: "0 0 8px",
  };

  const roomPanel = joined ? (
    <RightPanel theme={t} width={300} title={roomName} onCollapse={() => setRightOpen(false)}>
      {/* Notifications */}
      <div>
        <div style={panelSectionTitle}>Notifications</div>
        {notifications.map((n) => (
          <div key={n.id} style={{ background: t.rowActiveBg, borderRadius: 10, padding: "9px 11px", marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flex: "none",
                  background: n.tone === "risk" ? "#ef4444" : n.tone === "warn" ? "#f59e0b" : status.aiIndigo,
                }}
              />
              {n.title}
            </div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{n.detail}</div>
          </div>
        ))}
      </div>

      {/* Documents */}
      <div>
        <div style={panelSectionTitle}>Documents</div>
        {sharedDocs.length === 0 ? (
          <div style={{ fontSize: 13, color: t.muted }}>No documents shared yet.</div>
        ) : (
          sharedDocs.map((f) => (
            <div
              key={f.id}
              onClick={() => setPreview(f)}
              title={f.file_name ?? undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, cursor: "pointer" }}
            >
              <span style={{ fontSize: 16, flex: "none" }}>📄</span>
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {f.file_name}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Members */}
      <div>
        <div style={panelSectionTitle}>Members</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px" }}>
          <ChatAvatar theme={t} size={26} isRaya />
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: t.text }}><RayaName /></span>
          <span className="online-dot" />
        </div>
        {Object.values(roster).map((r) => {
          const mine = r.user_id === myUserId;
          const label = mine ? "You" : nameOf(r.user_id);
          return (
            <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px" }}>
              <ChatAvatar theme={t} size={26} initials={avatarInitials(label === "You" ? studentName : label)} avatarUrl={r.profile_picture_url} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </span>
              <span className={online.has(r.user_id) ? "online-dot" : "offline-dot"} />
            </div>
          );
        })}
      </div>

      {/* Settings */}
      <div>
        <div style={panelSectionTitle}>Room settings</div>
        <div style={{ fontSize: 14, color: t.text, display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <span style={{ color: t.muted }}>Subject · </span>
            {subject ?? "—"}
          </div>
          <div>
            <span style={{ color: t.muted }}>Visibility · </span>
            {visibility === "private" ? "Private" : "Public"}
          </div>
          <div>
            <span style={{ color: t.muted }}>Session · </span>
            {remainingMs == null ? "No time limit" : expired ? "Ended" : `${fmtRemaining(remainingMs)} left`}
          </div>
          <button style={{ ...ghost, marginTop: 4, alignSelf: "flex-start" }} onClick={copyInvite}>
            {copied ? "Invite link copied ✓" : "Copy invite link"}
          </button>
        </div>
      </div>
    </RightPanel>
  ) : null;

  return (
    <RayaShell
      active="rooms"
      theme={t}
      profileName={studentName || "My account"}
      profileInitials={studentInitials}
      profileSubtitle={studentPlan}
      profileAvatarUrl={studentAvatarUrl}
      rightPanel={rightOpen ? roomPanel : undefined}
      onToggleRight={joined ? () => setRightOpen((o) => !o) : undefined}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {chrome}
        {channelBody}
      </div>
      {preview && <FilePreview file={preview} scope="room" onClose={() => setPreview(null)} />}
    </RayaShell>
  );
}
