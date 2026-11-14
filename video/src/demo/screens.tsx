import { useRef } from "react";
import { ChatSurface } from "@/components/chat/chat-surface";
import type { ChatConfig, Conversation, Msg } from "@/components/chat/types";
import type { ChatEngine } from "@/components/chat/use-chat-engine";
import { RoomGroupChat, type GroupMsg } from "@/components/rooms/room-group-chat";
import { IconButton } from "@/components/ui/shell";
import { IconFile, IconPanel } from "@/components/ui/icons";
import { MasteryGauge } from "@/components/ui/widgets";
import { ctaButton, ghostButton, panelCard, textInput } from "@/components/ui/forms";
import { FilterChips, ListNoMatch, ListToolbar, useListSearch } from "@/components/ui/list-filter";
import { sortByName } from "@/lib/search";
import { StudentDetailView } from "@/components/school-admin";
import type { RosterStudent } from "@/lib/school-admin";
import { RayaName, RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { useConceptName } from "@/components/ui/concept-name";
import type { MessageKey } from "@/lib/i18n";
import type { ConceptStateOut, KCStatus, MindsetOut } from "@/lib/kernel/types";
import { Tools } from "@/components/tools";
import { SectionHeader } from "@/components/raya/section-header";
import { KernelMemory } from "@/components/kernel-memory";
import { ProgressCurve } from "@/components/progress-curve";
import { DemoProviders, T, trEn } from "./ui";
import { FONTS } from "../brand";
import {
  CLASSMATES,
  CLASS_NAME,
  FOLLOWUP_DRAFT,
  FOLLOWUPS,
  INSTRUCTION_DRAFT,
  INSTRUCTIONS,
  KERNEL_CONCEPTS,
  KERNEL_MEMORY,
  RAYA_SOLVED,
  RAYA_THREAD,
  ROOM_MESSAGES,
  ROOM_NAME,
  ROOM_SUBJECT,
  ROOM_TEACHER_JOIN,
  ROSTER,
  SOFIA,
  SOFIA_DETAIL,
  SOFIA_MINDSET,
  SOFIA_PROGRESS,
  STUDIO_FLASHCARDS,
  STUDIO_QUIZ,
  STUDIO_UPLOADS,
  TEACHER,
  WHY_STUCK,
} from "./data";

/**
 * The product on screen: the app's own components, fed demo data.
 *
 * ChatSurface, RoomGroupChat, Tools, KernelMemory, LearningGraphView and
 * StudentDetailView render for real (fake engines/props, no backend). The
 * screens that fetch on mount (insights list, rosters, instructions, notes)
 * are replicated 1:1 from their ready-state JSX — same primitives, same
 * tokens, same strings — because a fetch can never resolve inside one frame.
 * Everything is a pure function of film time `t`.
 */

const noop = () => {};

export function AppSurface({ children }: { children: React.ReactNode }) {
  return (
    <DemoProviders>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1760, height: 990, flex: "none", display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", background: T.contentBg, fontFamily: FONTS.body, color: T.text, border: "1px solid rgba(159,214,255,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 50px 110px rgba(0,0,0,0.55)" }}>
          {children}
        </div>
      </div>
    </DemoProviders>
  );
}

/* ── Raya solo chat (ChatSurface, fake engine) ── */

function rayaConfig(): ChatConfig {
  return {
    endpoints: { chat: "#", conversations: "#", files: "#" },
    capabilities: { voice: true, files: true },
    metered: false,
    aiModeSwitcher: true,
    toolRequests: true,
    greeting: (name) => (name ? `${trEn("chatHome.greetingWithName")} ${name}?` : trEn("chatHome.greetingNoName")),
    emptyHint: trEn("chatHome.emptyHint"),
    suggestions: [trEn("chatHome.suggestion1"), trEn("chatHome.suggestion2"), trEn("chatHome.suggestion3"), trEn("chatHome.suggestion4")],
    placeholder: trEn("chatHome.placeholder"),
  };
}

export interface ChatBeat {
  mineAt: number;
  mine: string;
  rayaAt: number;
  raya: string;
}

function streamChunk(full: string, p: number): string {
  // Reveal sentence by sentence — never mid-math, so RichText always parses.
  const parts = full.split(/(?<=[.!?] )/);
  const n = Math.max(1, Math.ceil(parts.length * p));
  return parts.slice(0, n).join(" ");
}

function fakeEngine(messages: Msg[], input: string, busy: boolean, title: string): ChatEngine {
  const convos: Conversation[] = [{ id: "demo-conv", title, updated_at: "2026-10-30T21:14:00.000Z" }];
  // Inert doubles, each annotated with the engine's own member type: the chat
  // never sends, uploads or switches threads inside a frame — it only renders.
  // No `as` casts: a bare `() => void` is not comparable to every member
  // (setArchived/retrySend resolve booleans, memorizeConversation a summary).
  const setInput: ChatEngine["setInput"] = () => {};
  const setPreview: ChatEngine["setPreview"] = () => {};
  const setError: ChatEngine["setError"] = () => {};
  const setBusy: ChatEngine["setBusy"] = () => {};
  const setConversations: ChatEngine["setConversations"] = () => {};
  const newChat: ChatEngine["newChat"] = () => {};
  const uploadDoc: ChatEngine["uploadDoc"] = async () => {};
  const removePending: ChatEngine["removePending"] = async () => {};
  const selectConversation: ChatEngine["selectConversation"] = async () => {};
  const deleteConversation: ChatEngine["deleteConversation"] = async () => {};
  const setArchived: ChatEngine["setArchived"] = async () => false;
  const memorizeConversation: ChatEngine["memorizeConversation"] = async () => null;
  const onSend: ChatEngine["onSend"] = async () => {};
  const retrySend: ChatEngine["retrySend"] = async () => false;
  const voice: ChatEngine["voice"] = {
    recording: false,
    busy: false,
    error: null,
    hasPending: false,
    toggle: async () => {},
    retry: async () => {},
    discard: () => {},
  };
  return {
    conversationId: "demo-conv",
    conversations: convos,
    messages,
    pending: [],
    filesByMessage: {},
    preview: null,
    input,
    busy,
    uploading: false,
    error: null,
    quota: null,
    voice,
    activeTitle: title,
    sessionFiles: [],
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
    setArchived,
    memorizeConversation,
    onSend,
    retrySend,
  };
}

export function RayaChat({ t, beats, title }: { t: number; beats: ChatBeat[]; title: string }) {
  const messages: Msg[] = [];
  let input = "";
  let busy = false;
  beats.forEach((b, i) => {
    if (t >= b.mineAt - 1.4 && t < b.mineAt) {
      const p = (t - (b.mineAt - 1.4)) / 1.4;
      input = b.mine.slice(0, Math.floor(b.mine.length * p));
    }
    if (t >= b.mineAt) {
      messages.push({ id: `m${i}`, role: "user", content: b.mine });
      input = "";
    }
    if (t >= b.mineAt && t < b.rayaAt) busy = true;
    if (t >= b.rayaAt) {
      busy = false;
      const p = Math.min(1, (t - b.rayaAt) / 1.6);
      messages.push({ id: `r${i}`, role: "assistant", content: p >= 1 ? b.raya : streamChunk(b.raya, p) });
    }
  });
  return (
    <AppSurface>
      <ChatSurface theme={T} engine={fakeEngine(messages, input, busy, title)} config={rayaConfig()} greetingName={SOFIA.first} userInitials={SOFIA.initials} />
    </AppSurface>
  );
}

export const RAYA_BEATS: ChatBeat[] = RAYA_THREAD.map((p) => ({ mineAt: 0, mine: p.mine, rayaAt: 0, raya: p.raya }));

/* ── Study Room (RoomGroupChat + room header) ── */

const ROOM_ROSTER = [SOFIA, ...CLASSMATES, { id: TEACHER.id, name: TEACHER.name, initials: TEACHER.initials }];

const ROOM_CHANNELS = ["group", "private", "challenge", "files", "report"] as const;

/** The room chrome, as room-view.tsx draws it: title, timer, members, tabs. */
function RoomHeader({ endsAt, now }: { endsAt: number; now: number }) {
  const t = T;
  const tr = useTranslate();
  const remainingMs = Math.max(0, (endsAt - now) * 1000);
  const total = Math.floor(remainingMs / 1000);
  const clock = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  const memberCount = ROOM_ROSTER.length;
  const btn = { background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 99, padding: "8px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer" };
  const ghost = { background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}`, borderRadius: 99, padding: "8px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer" };
  const tabBtn = (on: boolean): React.CSSProperties => (on ? { ...btn, fontSize: 15 } : { ...ghost, fontSize: 15 });
  const channelLabel = (c: string): React.ReactNode =>
    c === "group"
      ? tr("room.tab.group")
      : c === "private"
        ? <><RayaName /> {tr("room.tab.privateSuffix")}</>
        : c === "challenge"
          ? tr("room.tab.challenges")
          : c === "files"
            ? tr("room.tab.files")
            : tr("room.tab.report");
  return (
    <div className="room-chrome" style={{ flex: "none", background: t.cardBg, borderBottom: `1px solid ${t.cardBorder}`, padding: "16px 24px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: t.text, fontFamily: FONTS.display }}>{ROOM_NAME}</h1>
        <span style={{ color: t.muted, fontSize: 16 }}>
          {ROOM_SUBJECT} · {tr(memberCount === 1 ? "room.memberCountOne" : "room.memberCountMany", { count: memberCount })}
        </span>
        <span
          style={{
            alignSelf: "center", flex: "none", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700,
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderRadius: 99, padding: "3px 10px", color: t.text,
            background: t.cardBg2, border: `1px solid ${t.cardBorder}`,
          }}
          title={tr("room.timerLeftTitle")}
        >
          ⏱ {clock} {tr("room.leftSuffix")}
        </span>
        <span
          style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 15, fontWeight: 600, borderRadius: 99, padding: "3px 10px", color: t.mutedLight, background: t.cardBg2, border: `1px solid ${t.cardBorder}` }}
          title={tr("room.vis.privateHint")}
        >
          🔒 {tr("rooms.visPrivate")}
        </span>
        <span style={{ marginLeft: "auto", alignSelf: "center", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <IconButton theme={t} onClick={noop} title={tr("room.headerDocsPopoverTitle")} bg={t.cardBg2}>
            <IconFile size={14} />
          </IconButton>
          <span className="app-hide-phone" style={{ display: "inline-flex" }}>
            <IconButton theme={t} onClick={noop} title={tr("room.showPanel")}>
              <IconPanel size={14} />
            </IconButton>
          </span>
          <IconButton theme={t} onClick={noop} title={tr("room.collapseHeader")} bg={t.cardBg2}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: "transform .18s ease" }}>
              <path d="M6 15l6-6 6 6" />
            </svg>
          </IconButton>
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        {ROOM_CHANNELS.map((c) => (
          <button key={c} onClick={noop} style={{ ...tabBtn(c === "group"), flex: "none", whiteSpace: "nowrap" }}>
            {channelLabel(c)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StudyRoom({
  t,
  beats,
  inputAt,
  inputText,
  teacherAt,
  roomStart,
  myId,
}: {
  t: number;
  beats: number[];
  inputAt: number;
  inputText: string;
  teacherAt: number | null;
  roomStart: number;
  myId: string;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const messages: GroupMsg[] = ROOM_MESSAGES.filter((_, i) => t >= (beats[i] ?? Infinity));
  if (teacherAt != null && t >= teacherAt) messages.push(ROOM_TEACHER_JOIN);
  const input = t >= inputAt && t < inputAt + 1.6 ? inputText.slice(0, Math.floor((inputText.length * (t - inputAt)) / 1.6)) : "";
  const busy = beats.some((at, i) => ROOM_MESSAGES[i]?.role === "assistant" && t >= at - 0.9 && t < at);
  const nameOf = (id: string | null) => ROOM_ROSTER.find((u) => u.id === id)?.name ?? trEn("room.memberFallback");
  const avatarOf = (id: string | null) => ({ initials: ROOM_ROSTER.find((u) => u.id === id)?.initials ?? "?", avatarUrl: null });
  return (
    <AppSurface>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <RoomHeader endsAt={roomStart + 25 * 60} now={t} />
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <RoomGroupChat
            theme={T}
            myUserId={myId}
            messages={messages}
            nameOf={nameOf}
            avatarOf={avatarOf}
            myInitials={myId === TEACHER.id ? TEACHER.initials : SOFIA.initials}
            myAvatarUrl={null}
            roomFiles={{ g4: { id: "g4", file_name: "physics-chapter-5.pdf", mime_type: "application/pdf" } }}
            onPreview={noop}
            greetingName={SOFIA.first}
            input={input}
            onInput={noop}
            onSend={noop}
            onUpload={noop}
            uploading={false}
            voice={{ recording: false, busy: false, error: null, toggle: noop }}
            onAskRaya={noop}
            busy={busy}
            expired={false}
            error={null}
            endRef={endRef}
            subject={ROOM_SUBJECT}
          />
        </div>
      </div>
    </AppSurface>
  );
}

export { RAYA_SOLVED };

/* ── My Kernel insights (CognitiveProfile ready-state, WhyStuck open on physics) ──
 * Replicated 1:1 — same primitives, tokens and strings — because the real
 * component fetches /api/kernel/profile on mount, which can never resolve
 * inside one frame. Controlled twin: identical pixels, film-time state. */

const KC_STATUS: Record<KCStatus, { labelKey: MessageKey; color: string }> = {
  mastered: { labelKey: "kernel.status.mastered", color: "#22c55e" },
  partial: { labelKey: "kernel.status.partial", color: "#f59e0b" },
  gap: { labelKey: "kernel.status.gap", color: "#ef4444" },
  unknown: { labelKey: "kernel.status.unknown", color: "#94a3b8" },
};

const kPct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

function KBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
      <span style={{ width: 118, color: T.muted }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: T.gaugeTrack, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: kPct(value), height: "100%", background: color }} />
      </div>
      <span style={{ width: 40, textAlign: "right", color: T.muted }}>{kPct(value)}</span>
    </div>
  );
}

function WhyOpen({ label }: { label: string }) {
  const tr = useTranslate();
  const name = useConceptName();
  const gaps = WHY_STUCK.gaps;
  const frontier = WHY_STUCK.frontier;
  const askRaya = (concept: string) =>
    `/chat?ask=${encodeURIComponent(tr("kernel.why.askText", { concept: name(concept), target: name(label) }))}`;
  const linkStyle: React.CSSProperties = { color: T.link, fontSize: 14, fontWeight: 600, textDecoration: "none" };
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-expanded
        style={{ border: `1px solid ${T.controlBorder}`, background: "transparent", color: T.text, borderRadius: 8, padding: "5px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        {tr("kernel.why.hide")}
      </button>
      <div style={{ marginTop: 10, fontSize: 15, color: T.text, lineHeight: 1.5 }}>
        <p style={{ margin: "0 0 8px", color: T.muted }}>{tr("kernel.why.intro")}</p>
        <ol style={{ margin: 0, paddingLeft: "1.3em", display: "grid", gap: 8 }}>
          {gaps.map((g) => (
            <li key={g.concept_id || g.label}>
              <strong>{name(g.label)}</strong>
              <span style={{ color: T.muted }}> · {Math.round(Math.max(0, Math.min(1, g.k_effective)) * 100)}%</span>
              <div>
                <a href={askRaya(g.label)} style={linkStyle}>
                  <RayaText>{tr("kernel.why.workOn")}</RayaText> →
                </a>
              </div>
            </li>
          ))}
        </ol>
        {frontier.length > 0 && (
          <p style={{ margin: "10px 0 0", color: T.muted, fontSize: 14 }}>
            {tr("kernel.why.alreadyHeld")} {frontier.map((f) => name(f.label)).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function WhyClosed() {
  const tr = useTranslate();
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-expanded={false}
        style={{ border: `1px solid ${T.controlBorder}`, background: "transparent", color: T.text, borderRadius: 8, padding: "5px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        {tr("kernel.why.button")}
      </button>
    </div>
  );
}

function ConceptCard({ c, whyOpen }: { c: ConceptStateOut; whyOpen: boolean }) {
  const tr = useTranslate();
  const conceptLabel = useConceptName();
  const st = KC_STATUS[c.status] ?? KC_STATUS.unknown;
  return (
    <div style={{ ...panelCard(T) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <strong style={{ flex: 1, color: T.text, fontSize: 16 }}>{c.label ? conceptLabel(c.label) : c.concept_id}</strong>
        <span style={{ background: st.color, color: "#0b1020", borderRadius: 999, padding: "2px 10px", fontSize: 14, fontWeight: 600 }}>
          {tr(st.labelKey)}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <KBar label={tr("kernel.bar.knowledge")} value={c.k_effective} color="#2f7fe0" />
        <KBar label={tr("kernel.bar.retention")} value={c.v_score} color="#8b5cf6" />
        <KBar label={tr("kernel.bar.application")} value={c.p_score} color="#06b6d4" />
      </div>
      {c.last_interaction_at && (
        <p style={{ color: T.mutedLight, fontSize: 14, margin: "12px 0 0" }}>
          {tr("kernel.lastPracticed")} {new Date(c.last_interaction_at).toLocaleDateString()}
        </p>
      )}
      {c.label && (c.status === "gap" || c.status === "partial") && (whyOpen ? <WhyOpen label={c.label} /> : <WhyClosed />)}
    </div>
  );
}

export function KernelInsights({ t, whyAt, whyConceptId, scrollY }: { t: number; whyAt: number; whyConceptId: string; scrollY: number }) {
  const concepts = KERNEL_CONCEPTS;
  const mindset: MindsetOut | null = SOFIA_MINDSET;
  const globalMastery = concepts.reduce((s, c) => s + Math.max(0, Math.min(1, c.k_effective)), 0) / concepts.length;
  const whyOpen = t >= whyAt;
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scrollY}px)`, padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <SectionHeader title="My Kernel" subtitle={trEn("kernel.pageSubtitle")} />
          <ProgressCurve points={SOFIA_PROGRESS} />
          <KernelMemory initial={KERNEL_MEMORY} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div style={panelCard(T)}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: T.text }}>{trEn("kernel.overallMastery")}</div>
              <MasteryGauge theme={T} valueLabel={kPct(globalMastery)} caption={trEn("kernel.allConcepts")} dashoffset={188 * (1 - globalMastery)} />
            </div>
            {mindset && (
              <div style={panelCard(T)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <strong style={{ flex: 1, color: T.text, fontSize: 16 }}>{trEn("kernel.mindsetLabel")}</strong>
                  <span style={{ color: T.muted, textTransform: "capitalize", fontSize: 15 }}>{mindset.detected_mindset || "—"}</span>
                </div>
                <KBar label={trEn("kernel.growthLabel")} value={mindset.m_score} color="#22c55e" />
              </div>
            )}
          </div>
          {concepts.map((c) => (
            <ConceptCard key={c.concept_id} c={c} whyOpen={whyOpen && c.concept_id === whyConceptId} />
          ))}
          <p style={{ color: T.mutedLight, fontSize: 14 }}>
            {trEn("kernel.updatedOn")} {new Date("2026-10-30T21:14:00.000Z").toLocaleString()}
          </p>
        </div>
      </div>
    </AppSurface>
  );
}

/* ── Tools Studio (real Tools, demo library) ── */

export function StudioScreen({ scrollY }: { scrollY: number }) {
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scrollY}px)`, padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <Tools
            uploads={STUDIO_UPLOADS}
            outputs={[STUDIO_QUIZ, STUDIO_FLASHCARDS]}
            selfTests={[]}
            conversations={[{ id: "demo-conv", title: "Velocity-time graphs — slope practice", updated_at: "2026-10-30T21:14:00.000Z" }]}
            studentName={SOFIA.first}
          />
        </div>
      </div>
    </AppSurface>
  );
}

/* ── Teacher: class roster (RosterView + RosterList ready-state, controlled filter) ── */

const pctOrDash = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const riskColor = (level: string | null) =>
  level === "high" ? "#ef4444" : level === "medium" || level === "med" ? "#f59e0b" : level === "low" || level === "ok" ? "#22c55e" : "#6b7794";
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
const rosterAlert = (s: RosterStudent) =>
  s.riskLevel === "high" ||
  s.riskLevel === "medium" ||
  s.riskLevel === "med" ||
  (s.homeworkMissing ?? 0) >= 2 ||
  (s.homeworkAvg != null && s.homeworkAvg < 0.5);
const rosterHasData = (s: RosterStudent) =>
  s.riskLevel != null || (s.homeworkDone ?? 0) + (s.homeworkMissing ?? 0) > 0;

function RosterRow({ s }: { s: RosterStudent }) {
  const tr = useTranslate();
  const ghost = { background: T.cardBg2, color: T.text, border: `1px solid ${T.cardBorder}`, borderRadius: 99, padding: "6px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const due = (s.homeworkDone ?? 0) + (s.homeworkMissing ?? 0);
  const kernelAlert = s.riskLevel === "high" || s.riskLevel === "medium" || s.riskLevel === "med";
  const dot = kernelAlert ? s.riskLevel : rosterAlert(s) ? "medium" : s.riskLevel ?? (due > 0 ? "low" : null);
  const box = { background: T.cardBg2, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 18, marginBottom: 16 };
  return (
    <div style={{ ...box, display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(dot), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
        <div style={{ opacity: 0.55, fontSize: "0.8rem" }}>
          {s.statusLabel ?? (due > 0 ? tr("school.roster.homeworkLine", { done: s.homeworkDone ?? 0, due }) : tr("school.roster.noDataYet"))}{" "}
          · {tr("school.roster.lastActive")} {fmtDate(s.lastActiveAt)}
        </div>
      </div>
      <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>{pctOrDash(s.avgMastery ?? s.homeworkAvg ?? null)}</span>
      <button style={ghost} onClick={noop}>{tr("school.roster.view")}</button>
    </div>
  );
}

export function TeacherRoster({ filter }: { filter: string }) {
  const tr = useTranslate();
  const box = { background: T.cardBg2, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 18, marginBottom: 16 };
  const ghost = { background: T.cardBg2, color: T.text, border: `1px solid ${T.cardBorder}`, borderRadius: 99, padding: "6px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const students = ROSTER;
  const alerts = students.filter(rosterAlert).length;
  const withMastery = students.filter((s) => s.avgMastery != null);
  const avg = withMastery.length > 0 ? withMastery.reduce((a, s) => a + (s.avgMastery ?? 0), 0) / withMastery.length : null;
  const sorted = sortByName(students, (s) => `${s.lastName} ${s.firstName}`.trim());
  const search = useListSearch(sorted, (s) => [s.firstName, s.lastName, s.statusLabel], { noun: tr("list.noun.students") });
  const found = search.visible;
  const buckets: Record<string, (s: RosterStudent) => boolean> = {
    all: () => true,
    alert: rosterAlert,
    ok: (s) => rosterHasData(s) && !rosterAlert(s),
    none: (s) => !rosterHasData(s),
  };
  const shown = found.filter(buckets[filter] ?? buckets.all);
  const showChips = students.length >= 8;
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <button style={{ ...ghost, marginBottom: "1rem" }} onClick={noop}>{tr("school.roster.backToClasses")}</button>
          <div style={box}>
            <h2 style={{ margin: 0 }}>{CLASS_NAME}</h2>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.6rem", fontSize: "0.9rem" }}>
              <span><strong>{students.length}</strong> <span style={{ opacity: 0.6 }}>{tr("school.prof.studentsCountWord")}</span></span>
              <span><strong style={{ color: alerts ? "#f87171" : "inherit" }}>{alerts}</strong> <span style={{ opacity: 0.6 }}>{tr("school.roster.needAttention")}</span></span>
              <span><strong>{pctOrDash(avg)}</strong> <span style={{ opacity: 0.6 }}>{tr("school.roster.avgMastery")}</span></span>
            </div>
          </div>
          <ListToolbar search={search}>
            {showChips && (
              <FilterChips
                value={filter}
                onChange={noop}
                options={[
                  { key: "all", label: tr("school.roster.filterAll"), count: found.length },
                  { key: "alert", label: tr("school.roster.filterNeedsAttention"), count: found.filter(rosterAlert).length },
                  { key: "ok", label: tr("school.roster.filterOnTrack"), count: found.filter(buckets.ok).length },
                  { key: "none", label: tr("school.roster.filterNoData"), count: found.filter(buckets.none).length },
                ]}
              />
            )}
          </ListToolbar>
          {shown.map((s) => (
            <RosterRow key={s.userId} s={s} />
          ))}
          <ListNoMatch search={search} />
          {!search.noMatch && shown.length === 0 && found.length > 0 && (
            <p style={{ color: T.muted, fontSize: 16, padding: "8px 2px" }}>
              {tr("school.roster.noneInFilter")}{" "}
              <button type="button" onClick={noop} style={{ background: "none", border: "none", padding: 0, color: T.link, fontSize: 16, fontWeight: 650, fontFamily: "inherit", cursor: "pointer" }}>
                {tr("school.roster.showAll")}
              </button>
            </p>
          )}
        </div>
      </div>
    </AppSurface>
  );
}

/* ── Teacher: student profile (real StudentDetailView, no classId → no fetch) ── */

export function TeacherStudent({ scrollY }: { scrollY: number }) {
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scrollY}px)`, padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <StudentDetailView detail={SOFIA_DETAIL} onBack={noop} />
        </div>
      </div>
    </AppSurface>
  );
}

/* ── Teacher: team note + Raya instructions (controlled ready-state twins) ── */

const fmtNote = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const NOTE_AT = "2026-10-31T08:05:00.000Z";

export function TeacherNote({ t, typeAt, typeDur, postAt }: { t: number; typeAt: number; typeDur: number; postAt: number }) {
  const tr = useTranslate();
  const box = panelCard(T);
  const input = textInput(T);
  const btn = ctaButton(T);
  const posted = t >= postAt;
  const draft = posted ? "" : t >= typeAt ? FOLLOWUP_DRAFT.slice(0, Math.floor((FOLLOWUP_DRAFT.length * Math.min(1, (t - typeAt) / typeDur)))) : "";
  const items = posted
    ? [{ id: "f-new", content: FOLLOWUP_DRAFT, authorName: tr("room.youLabel"), createdAt: NOTE_AT, updatedAt: NOTE_AT }, ...FOLLOWUPS]
    : FOLLOWUPS;
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            {SOFIA.name} · {CLASS_NAME}
          </div>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>{tr("school.followups.heading")}</h3>
            <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>{tr("school.followups.intro")}</p>
            <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
              <input style={{ ...input, flex: 1, minWidth: 220 }} placeholder={tr("school.followups.placeholder")} value={draft} onChange={noop} maxLength={2000} />
              <button type="submit" style={btn} disabled={!draft.trim()}>{tr("school.followups.addNote")}</button>
            </form>
            {items.map((it) => (
              <div key={it.id} style={{ padding: "0.5rem 0", borderTop: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>{it.content}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                  <span style={{ opacity: 0.5, fontSize: "0.75rem", flex: 1 }}>{it.authorName} · {fmtNote(it.createdAt)}</span>
                  <button style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: "0.8rem" }} onClick={noop}>
                    {tr("school.followups.editButton")}
                  </button>
                  <button style={{ background: "transparent", border: "none", color: "#6b7794", cursor: "pointer" }} onClick={noop} title={tr("school.instructionsPanel.deleteTitle")}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppSurface>
  );
}

export function TeacherInstructions({ t, typeAt, typeDur, postAt }: { t: number; typeAt: number; typeDur: number; postAt: number }) {
  const tr = useTranslate();
  const box = panelCard(T);
  const input = textInput(T);
  const btn = ctaButton(T);
  const ghost = ghostButton(T);
  const posted = t >= postAt;
  const content = posted ? "" : t >= typeAt ? INSTRUCTION_DRAFT.slice(0, Math.floor((INSTRUCTION_DRAFT.length * Math.min(1, (t - typeAt) / typeDur)))) : "";
  const items = posted
    ? [{ id: "i-new", content: INSTRUCTION_DRAFT, subjectId: null, subjectName: null, isActive: true }, ...INSTRUCTIONS]
    : INSTRUCTIONS;
  const subjects = [{ id: "sub-phys", name: "Physics" }];
  return (
    <AppSurface>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "32px 40px 60px", maxWidth: 1060, margin: "0 auto" }}>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>{tr("school.instructionsPanel.titleA")} <RayaName /></h3>
            <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
              {tr("school.instructionsPanel.introA")} <RayaName /> {tr("school.instructionsPanel.introB")}
            </p>
            {items.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.instructionsPanel.noneYet")}</p>}
            {items.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}>
                <span style={{ flex: 1, opacity: it.isActive ? 1 : 0.45 }}>
                  {it.content}
                  <span style={{ opacity: 0.5, fontSize: "0.78rem" }}> · {it.subjectName ?? tr("school.instructionsPanel.allSubjectsFallback")}</span>
                </span>
                <button style={ghost} onClick={noop}>{it.isActive ? tr("school.instructionsPanel.disable") : tr("school.instructionsPanel.enable")}</button>
                <button onClick={noop} title={tr("school.instructionsPanel.deleteTitle")} style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ))}
            <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder={tr("school.instructionsPanel.placeholder")} value={content} onChange={noop} maxLength={500} />
              <select style={input} value="" onChange={noop}>
                <option value="">{tr("school.instructionsPanel.allSubjectsOption")}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="submit" style={btn} disabled={!content.trim()}>{tr("school.dashboard.addButton")}</button>
            </form>
          </div>
        </div>
      </div>
    </AppSurface>
  );
}
