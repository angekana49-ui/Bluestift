"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { joinRoom, postRoomMessage, setRoomVisibility } from "@/app/rooms/actions";
import { dispatchUpgrade } from "@/lib/upgrade";
import { useRightPanel } from "@/components/ui/use-right-panel";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { RoomChallenges } from "@/components/room-challenges";
import { RoomFiles } from "@/components/room-files";
import { FilePreview, type Attachment } from "@/components/attachment";
import { type BrandedDoc } from "@/lib/document";
import { DocumentActions } from "@/components/ui/doc-actions";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider, useTranslate } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel, IconButton, PageBody } from "@/components/ui/shell";
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
/**
 * The room's five channels, in the order they are offered. One list, read by
 * the wide-screen tab strip AND by the right panel's channel list (which is
 * the only channel switcher a phone has, the chrome being folded away there).
 */
const CHANNELS = ["group", "private", "challenge", "files", "report"] as const;
type Channel = (typeof CHANNELS)[number];

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

/**
 * The second site that rendered `RayaShell` without the providers above it —
 * same defect as /chat, same fix. See the note on `Chat`: the shell's Settings
 * sheet reads the theme from CONTEXT because it has to be able to change it,
 * so anything mounting the shell has to provide it.
 */
export function RoomView(props: React.ComponentProps<typeof RoomViewBody>) {
  const value = useDarkMode();
  const localeValue = useLocale();
  return (
    <AppThemeProvider value={value}>
      <LocaleProvider value={localeValue}>
        <RoomViewBody {...props} />
      </LocaleProvider>
    </AppThemeProvider>
  );
}

function RoomViewBody({
  roomId,
  isOwner,
  visibilityLocked,
  canChooseVisibility,
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
  /** The room's creator — the only member who may change its visibility. */
  isOwner: boolean;
  /** The age rule: a room holding anyone under 18 can never be opened. Sent as
   *  a bare boolean, never the ages or whose they are. */
  visibilityLocked: boolean;
  /** `roomVisibilityChoice` for the owner's plan. */
  canChooseVisibility: boolean;
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
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const btn = mkBtn(t);
  const ghost = mkGhost(t);
  const listBox = mkListBox(t);
  const [supabase] = useState(() => createClient());
  const [joined, setJoined] = useState(isMember);
  const [copied, setCopied] = useState(false);
  const [rightOpen, setRightOpen] = useRightPanel();
  const [docsOpen, setDocsOpen] = useState(false);
  /** The room header folds to a single line. Open by default, at every width —
   *  a room you have just walked into should say whose it is and how long is
   *  left before it starts saving you space. */
  const [chromeOpen, setChromeOpen] = useState(true);
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
  const [channel, setChannel] = useState<Channel>("group");
  const [report, setReport] = useState<RoomReport>(initialReport);
  // Held locally so the pill flips the moment the server action resolves,
  // rather than waiting for the revalidated page to come back.
  const [vis, setVis] = useState<string>(visibility);
  const [repBusy, setRepBusy] = useState(false);

  async function generateReport() {
    if (repBusy) return;
    setRepBusy(true);
    setError(null);
    try {
      // Server-generated narrative report (LLM-backed, non-streamed) — the
      // same 65s budget as the room's other full-generation calls.
      const res = await netFetch(
        "/api/rooms/report",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId }),
        },
        { timeoutMs: 65_000 },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? tr("room.reportGenFailed"));
        return;
      }
      setReport(data.report);
    } catch {
      setError(tr("room.reportGenFailed"));
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
    if (!userId) return tr("room.memberFallback");
    const r = roster[userId];
    return r?.display_name || (r?.username ? `@${r.username}` : tr("room.memberFallback"));
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
    // Same endpoint as the solo chat, so the same plan quota applies to it.
    metered: true,
    aiModeSwitcher: true,
    greeting: (name) => (name ? `${tr("room.privateGreetingWithName")} ${name}` : tr("room.privateGreetingNoName")),
    emptyHint: tr("room.privateEmptyHint"),
    suggestions: [tr("room.privateSuggestion1"), tr("room.privateSuggestion2"), tr("room.privateSuggestion3")],
    placeholder: tr("room.privatePlaceholder"),
    extraBody: { roomId },
    // Hybrid: no LLM needed — when the room has a subject we template the chips
    // from it (works offline); otherwise the static set above stays.
    personalizedHooks: async () => {
      const s = subject?.trim();
      if (!s) return null;
      return {
        suggestions: [
          `${tr("room.privateSuggestionOfA")} ${s}`,
          `${tr("room.privateSuggestionOfB")} ${s}`,
          tr("room.privateSuggestion3"),
        ],
      };
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
        // An age rule is not an upsell: no plan makes someone 18, so this one
        // gets the plain error line instead of the upgrade modal.
        if (result.code === "minor_public_room") {
          setError(result.error);
        } else {
          dispatchUpgrade({ code: result.code, message: result.error });
        }
        setBusy(false);
        return;
      }
      setJoined(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("room.joinFailed"));
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
      setError(e instanceof Error ? e.message : tr("room.sendFailed"));
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
      // Audio/PDF go through server-side extraction (maxDuration 60s).
      const res = await netFetch("/api/rooms/files", { method: "POST", body: fd }, { timeoutMs: 65_000 });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? tr("room.uploadFailed"));
        return;
      }
      const f = data.file as RoomFileRow | undefined;
      if (f?.message_id) setRoomFiles((m) => ({ ...m, [f.message_id as string]: f }));
    } catch {
      setError(tr("room.uploadFailed"));
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
        setError(data?.error ? `${tr("room.rayaErrorPrefix")} ${data.error}` : tr("room.rayaNoReply"));
        return;
      }
      // Render the reply straight from the response. Realtime may also deliver
      // it (deduplicated by id) — but if the socket is down, this is the only
      // way the student who asked ever sees it.
      if (data?.message) mergeMessages([data.message as GroupMsg]);
    } catch {
      setError(tr("room.rayaUnreachable"));
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (on: boolean): React.CSSProperties =>
    on ? { ...btn, fontSize: 14 } : { ...ghost, fontSize: 14 };

  /** One label per channel, so the chrome's tabs and the panel's list agree. */
  const channelLabel = (c: Channel): React.ReactNode =>
    c === "group"
      ? tr("room.tab.group")
      : c === "private"
        ? <><RayaName /> {tr("room.tab.privateSuffix")}</>
        : c === "challenge"
          ? tr("room.tab.challenges")
          : c === "files"
            ? tr("room.tab.files")
            : tr("room.tab.report");

  // The room's shared documents, for the header docs popover + the panel list.
  const sharedDocs = Object.values(roomFiles);

  /*
   * The session countdown, lifted out of the header row because every state of
   * the header needs it: the open chrome, the folded one, and — `compact` — the
   * shell's own header, which is the only one a phone has. Collapsing a timed
   * room must not take the clock with it: the room turns read-only when it runs
   * out, and "how long have I got" is the one fact here that changes on its own.
   */
  const timerPill = (compact: boolean) =>
    remainingMs != null ? (
      <span
        style={{
          alignSelf: "center",
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: compact ? 13 : 14,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          borderRadius: 99,
          padding: compact ? "3px 8px" : "3px 10px",
          color: expired ? "#b91c1c" : remainingMs <= 120_000 ? "#b45309" : t.text,
          background: expired
            ? "rgba(239,68,68,0.12)"
            : remainingMs <= 120_000
              ? "rgba(245,158,11,0.14)"
              : t.cardBg2,
          border: `1px solid ${expired ? "rgba(239,68,68,0.4)" : remainingMs <= 120_000 ? "rgba(245,158,11,0.45)" : t.cardBorder}`,
        }}
        title={expired ? tr("room.timerEndedTitle") : tr("room.timerLeftTitle")}
      >
        {/* Compact drops the "left" — it shares a 375px row with the room's
            name and a drawer button, and a clock glyph in front of a falling
            number does not need a word to say what it is. */}
        ⏱ {expired ? tr("room.timerEndedShort") : compact ? fmtRemaining(remainingMs) : `${fmtRemaining(remainingMs)} ${tr("room.leftSuffix")}`}
      </span>
    ) : null;
  const timerBadge = timerPill(false);

  /** Fold the metadata row away. Available at every width, not just phones. */
  const chromeToggle = (
    <IconButton
      theme={t}
      onClick={() => setChromeOpen((o) => !o)}
      title={chromeOpen ? tr("room.collapseHeader") : tr("room.expandHeader")}
      bg={t.cardBg2}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ transform: chromeOpen ? "none" : "rotate(180deg)", transition: "transform .18s ease" }}
      >
        <path d="M6 15l6-6 6 6" />
      </svg>
    </IconButton>
  );

  /*
   * The room chrome (title, timer, members, visibility, docs, tabs) — a solid
   * strip pinned above the chat, exactly where /chat keeps its session header.
   *
   * IT DOES NOT EXIST ON A PHONE. `.room-chrome` is display:none below 900px
   * (globals.css): the shell already puts a header on that screen, and two
   * stacked ones ate roughly a fifth of an iPhone's height before a single
   * message was shown. Everything on it has another home at that tier — the
   * room's name and countdown move into the shell header (`mobileTitle` /
   * `mobileTrailing`), and the channels, documents, members, subject,
   * visibility and session time are all in the right panel, which the header's
   * own button opens.
   */
  const chrome = (
    <div
      className="room-chrome"
      style={{
        flex: "none",
        background: t.cardBg,
        borderBottom: `1px solid ${t.cardBorder}`,
        padding: chromeOpen ? "16px 24px 12px" : "9px 24px 10px",
      }}
    >
      {chromeOpen ? (
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: t.text, fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>{roomName}</h1>
        <span style={{ color: t.muted, fontSize: 15 }}>
          {subject ?? "—"} · {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        {timerBadge}
        <RoomVisibility
          theme={t}
          roomId={roomId}
          visibility={vis}
          onChange={setVis}
          isOwner={isOwner}
          locked={visibilityLocked}
          canChoose={canChooseVisibility}
        />
        <span style={{ marginLeft: "auto", alignSelf: "center", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          {joined && (
            <>
            {/* Documents — a quick popover right in the header, like the chat
                header's files button. Keeps doc access out of the nav. */}
            <IconButton
              theme={t}
              onClick={() => setDocsOpen((o) => !o)}
              title={tr("room.headerDocsPopoverTitle")}
              bg={docsOpen ? t.sidebarActiveBg : t.cardBg2}
            >
              <IconFile size={14} />
            </IconButton>
            {/* Panel toggle: only when the panel is retracted (it has its own
                collapse), and hidden on phone where the mobile header owns it. */}
            {!rightOpen && (
              <span className="app-hide-phone" style={{ display: "inline-flex" }}>
                <IconButton theme={t} onClick={() => setRightOpen(true)} title={tr("room.showPanel")}>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>{tr("room.headerDocsPopoverTitle")}</div>
                {sharedDocs.length === 0 ? (
                  <div style={{ fontSize: 13, color: t.muted }}>{tr("room.noDocumentsYet")}</div>
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
            </>
          )}
          {chromeToggle}
        </span>
      </div>
      ) : (
        /* Collapsed: the name, the clock, and the way back. Everything else on
           the open row is reference material you can unfold when you want it —
           the tabs below stay put either way, so folding the header never costs
           you the ability to move between channels. */
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 800,
              margin: 0,
              color: t.text,
              fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
            title={roomName}
          >
            {roomName}
          </h1>
          {timerBadge}
          <span style={{ marginLeft: "auto", flex: "none" }}>{chromeToggle}</span>
        </div>
      )}

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
                {tr("room.expiredBannerA")} <strong>{tr("room.expiredBannerStrong")}</strong>
                {tr("room.expiredBannerB")}
              </span>
            </div>
          )}

          {/* Five channels, wrapping if they must. */}
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {CHANNELS.map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                style={{ ...tabBtn(channel === c), flex: "none", whiteSpace: "nowrap" }}
              >
                {channelLabel(c)}
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
      <PageBody maxWidth={900}>
        <div
          style={{
            background: t.cardBg2,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 18,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ color: t.muted, fontSize: 15 }}>{tr("room.joinPrompt")}</p>
          <button style={btn} onClick={join} disabled={busy}>
            {tr("room.joinButton")}
          </button>
          {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
        </div>
      </PageBody>
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
      <PageBody maxWidth={900}>
        {channel === "challenge" ? (
          <RoomChallenges roomId={roomId} roomName={roomName} subject={subject} myUserId={myUserId} isRoomOwner={isOwner} readOnly={expired} />
        ) : channel === "files" ? (
          <RoomFiles roomId={roomId} readOnly={expired} />
        ) : (
          <div style={listBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: t.text }}>{tr("room.reportHeading")}</h3>
              {report && (
                <>
                  <DocumentActions doc={reportDoc(roomName, report)} compact personal />
                  <button style={{ ...ghost, padding: "5px 12px", fontSize: 13 }} title={tr("room.closeTitle")} onClick={() => setReport(null)}>
                    ✕
                  </button>
                </>
              )}
              <button style={{ ...btn, opacity: repBusy ? 0.6 : 1 }} onClick={generateReport} disabled={repBusy}>
                {repBusy ? tr("room.reportGenerating") : report ? tr("room.reportRegenerate") : tr("room.reportGenerateButton")}
              </button>
            </div>
            {!report ? (
              <p style={{ color: t.muted, fontSize: 15 }}>
                {tr("room.reportEmpty")}
              </p>
            ) : (
              <div style={{ lineHeight: 1.6, color: t.text, fontSize: 15 }}>
                {report.squad_score != null && (
                  <p>
                    <strong>{tr("room.squadScoreLabel")}</strong> {report.squad_score}/100
                  </p>
                )}
                <p>
                  <strong>{tr("room.summaryLabel")}</strong> {report.summary ?? "—"}
                </p>
                <p>
                  <strong>{tr("room.keyLearningsLabel")}</strong> {report.key_learnings ?? "—"}
                </p>
                {Array.isArray(report.highlights) &&
                  (report.highlights as string[]).length > 0 && (
                    <>
                      <strong>{tr("room.highlightsLabel")}</strong>
                      <ul style={{ marginTop: 4 }}>
                        {(report.highlights as string[]).map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </>
                  )}
                <p>
                  <strong>{tr("room.recommendationsLabel")}</strong> {report.recommendations ?? "—"}
                </p>
              </div>
            )}
          </div>
        )}
        {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 15 }}>{error}</p>}
      </PageBody>
    );
  }

  const onlineCount = Object.values(roster).filter((r) => online.has(r.user_id)).length;

  // A light, derived notifications feed — no table, just the room's live signals.
  const notifications: { id: string; tone: "risk" | "warn" | "info"; title: string; detail: string }[] = [];
  if (expired) {
    notifications.push({ id: "ended", tone: "risk", title: tr("room.notifSessionEnded"), detail: tr("room.notifReadOnly") });
  } else if (remainingMs != null && remainingMs <= 120_000) {
    notifications.push({ id: "soon", tone: "warn", title: tr("room.notifEndingSoon"), detail: `${fmtRemaining(remainingMs)} ${tr("room.notifLeftInSession")}` });
  } else if (remainingMs != null) {
    notifications.push({ id: "running", tone: "info", title: tr("room.notifInProgress"), detail: `${fmtRemaining(remainingMs)} ${tr("room.notifLeftPeriod")}` });
  }
  notifications.push({
    id: "presence",
    tone: "info",
    title: `${onlineCount} ${tr(onlineCount === 1 ? "room.notifMemberOnlineOne" : "room.notifMemberOnlineOther")}`,
    detail: `${memberCount} ${tr("room.notifInThisRoom")}`,
  });
  if (sharedDocs.length > 0) {
    notifications.push({
      id: "docs",
      tone: "info",
      title: `${sharedDocs.length} ${tr(sharedDocs.length === 1 ? "room.notifDocSharedOne" : "room.notifDocSharedOther")}`,
      detail: tr("room.notifOpenDocsHint"),
    });
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
      {/* Channels — PHONE ONLY, and the only channel switcher there: the tab
          strip lives on the room chrome, which is folded away at this tier.
          A full-width list rather than a row of pills, because this is now a
          navigation menu and not a strip of tabs. */}
      <div className="app-only-phone">
        <div style={panelSectionTitle}>{tr("room.panelChannels")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {CHANNELS.map((c) => {
            const on = channel === c;
            return (
              <button
                key={c}
                onClick={() => {
                  setChannel(c);
                  // The panel is an overlay here — leaving it open would put the
                  // channel you just picked behind a scrim.
                  setRightOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${on ? "transparent" : t.cardBorder}`,
                  background: on ? t.ctaBg : "transparent",
                  color: on ? t.ctaText : t.text,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: on ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                {channelLabel(c)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <div style={panelSectionTitle}>{tr("room.panelNotifications")}</div>
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
        <div style={panelSectionTitle}>{tr("room.panelDocuments")}</div>
        {sharedDocs.length === 0 ? (
          <div style={{ fontSize: 13, color: t.muted }}>{tr("room.noDocumentsSharedYet")}</div>
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
        <div style={panelSectionTitle}>{tr("room.panelMembers")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px" }}>
          <ChatAvatar theme={t} size={26} isRaya />
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: t.text }}><RayaName /></span>
          <span className="online-dot" />
        </div>
        {Object.values(roster).map((r) => {
          const mine = r.user_id === myUserId;
          const label = mine ? tr("room.youLabel") : nameOf(r.user_id);
          return (
            <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px" }}>
              <ChatAvatar theme={t} size={26} initials={avatarInitials(mine ? studentName : label)} avatarUrl={r.profile_picture_url} />
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
        <div style={panelSectionTitle}>{tr("room.panelSettings")}</div>
        <div style={{ fontSize: 14, color: t.text, display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <span style={{ color: t.muted }}>{tr("room.settingsSubject")} </span>
            {subject ?? "—"}
          </div>
          <div>
            <span style={{ color: t.muted }}>{tr("room.settingsVisibility")} </span>
            {visibility === "private" ? tr("rooms.visPrivate") : tr("rooms.visPublic")}
          </div>
          <div>
            <span style={{ color: t.muted }}>{tr("room.settingsSession")} </span>
            {remainingMs == null ? tr("room.noTimeLimit") : expired ? tr("room.timerEndedShort") : `${fmtRemaining(remainingMs)} ${tr("room.leftSuffix")}`}
          </div>
          <button style={{ ...ghost, marginTop: 4, alignSelf: "flex-start" }} onClick={copyInvite}>
            {copied ? tr("room.inviteCopied") : tr("room.copyInviteLink")}
          </button>
        </div>
      </div>
    </RightPanel>
  ) : null;

  return (
    <RayaShell
      active="rooms"
      theme={t}
      profileName={studentName || tr("room.myAccountFallback")}
      profileInitials={studentInitials}
      profileSubtitle={studentPlan}
      profileAvatarUrl={studentAvatarUrl}
      rightPanel={rightOpen ? roomPanel : undefined}
      onToggleRight={joined ? () => setRightOpen((o) => !o) : undefined}
      // The phone has one header, and it is this one — so it carries the room's
      // name and its clock, which the folded chrome would otherwise take with it.
      mobileTitle={roomName}
      mobileTrailing={timerPill(true)}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {chrome}
        {channelBody}
      </div>
      {preview && <FilePreview file={preview} scope="room" onClose={() => setPreview(null)} />}
    </RayaShell>
  );
}

/**
 * Who can see this room, in the header beside the timer.
 *
 * Everyone sees the state, because "can a stranger walk in" is not the owner's
 * private business — it is the first thing a member should be able to check.
 * Only the owner gets the switch, and only when both gates above it are open:
 *
 *  - the age rule (`locked`) — a room holding a member under 18 is private and
 *    stays private, at any tier. Stated without naming who: the owner is told
 *    the room cannot be opened, not who is keeping it shut.
 *  - the plan (`canChoose`) — `roomVisibilityChoice`. A locked room does not
 *    also advertise an upgrade: it would be selling something that would not
 *    change the answer.
 *
 * Private is the default everywhere (see createRoom), so the only irreversible-
 * feeling direction is opening one — which is why that is the click that
 * confirms, and closing it again never does.
 */
function RoomVisibility({
  theme: t,
  roomId,
  visibility,
  onChange,
  isOwner,
  locked,
  canChoose,
}: {
  theme: AppTheme;
  roomId: string;
  visibility: string;
  onChange: (v: string) => void;
  isOwner: boolean;
  locked: boolean;
  canChoose: boolean;
}) {
  const tr = useTranslate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const isPublic = visibility === "public";
  const canSwitch = isOwner && canChoose && (!locked || isPublic);

  async function flip() {
    const next = isPublic ? "private" : "public";
    if (busy) return;
    if (next === "public" && !window.confirm(tr("room.vis.confirmOpen"))) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await setRoomVisibility(roomId, next);
      if (res && "error" in res) {
        // The age rule is not something a plan fixes, so it says so plainly
        // rather than opening the upgrade modal (same split as joinRoom).
        if (res.code === "minor_public_room") setNote(res.error);
        else dispatchUpgrade({ code: res.code, message: res.error });
        return;
      }
      onChange(next);
    } catch {
      setNote(tr("room.vis.changeFailed"));
    } finally {
      setBusy(false);
    }
  }

  const pill: React.CSSProperties = {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 99,
    padding: "3px 10px",
    color: t.mutedLight,
    background: t.cardBg2,
    border: `1px solid ${t.cardBorder}`,
  };

  return (
    <>
      {canSwitch ? (
        <button
          type="button"
          onClick={flip}
          disabled={busy}
          title={isPublic ? tr("room.vis.publicHint") : tr("room.vis.privateHint")}
          style={{ ...pill, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, font: "inherit", fontSize: 14, fontWeight: 600 }}
        >
          {isPublic ? `🌐 ${tr("rooms.visPublic")}` : `🔒 ${tr("rooms.visPrivate")}`}
          <span style={{ color: t.muted, fontWeight: 400 }}>· {busy ? tr("room.vis.saving") : tr("room.vis.change")}</span>
        </button>
      ) : (
        <span
          style={pill}
          title={
            isOwner && locked
              ? tr("room.vis.minorLockedHint")
              : isPublic
                ? tr("room.vis.publicHint")
                : tr("room.vis.privateHint")
          }
        >
          {isPublic ? `🌐 ${tr("rooms.visPublic")}` : `🔒 ${tr("rooms.visPrivate")}`}
          {isOwner && locked && <span style={{ color: t.muted, fontWeight: 400 }}>· {tr("room.vis.locked")}</span>}
        </span>
      )}
      {note && (
        <span style={{ alignSelf: "center", fontSize: 13, color: t.muted }}>{note}</span>
      )}
    </>
  );
}
