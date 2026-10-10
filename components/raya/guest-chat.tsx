"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider, useTranslate } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { useRightPanel } from "@/components/ui/use-right-panel";
import { RayaText } from "@/components/ui/brand";
import { text, type AppTheme } from "@/components/ui/tokens";
import { RightPanel } from "@/components/ui/shell";
import { Modal } from "@/components/ui/modal";
import {
  IconAiMode,
  IconAttach,
  IconChat,
  IconKernel,
  IconLock,
  IconMic,
  IconQuiz,
  IconRooms,
  IconSettings,
  IconSummary,
  IconTools,
} from "@/components/ui/icons";
import { RayaShell, type RayaLockedArea } from "@/components/raya/raya-shell";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import type { LockedControl } from "@/components/chat/chat-composer";
import { titleFrom, type ChatConfig, type Msg } from "@/components/chat/types";
import type { MessageKey, MessageVars } from "@/lib/i18n";
import {
  GUEST_TURN_LIMIT,
  guestTurns,
  readGuestThread,
  saveGuestThread,
  type GuestMessage,
} from "@/lib/raya/guest";

/**
 * Raya for a visitor with no account — what /chat renders when nobody is
 * signed in (lib/raya/guest.ts has the rules).
 *
 * The WHOLE app, not a chat box: the same shell, sidebar, history, session
 * header, right panel and composer the learner gets after signing up. Only the
 * conversation works. Everything else is in its place and can be pressed — and
 * pressing it opens a card saying what it does and that a free account opens
 * it. The visitor sees what they would have, touches it, and cannot have it
 * yet; a bare chat box showed them none of that, so it sold nothing.
 *
 * The thread is kept in this browser so a reload does not lose it and the
 * account created at the end inherits it. After GUEST_TURN_LIMIT turns the
 * composer gives way to the sign-up card — after the reply that used the last
 * turn has arrived in full, never in the middle of it.
 */
export function GuestChat() {
  const value = useDarkMode();
  const localeValue = useLocale();
  return (
    <AppThemeProvider value={value}>
      <LocaleProvider value={localeValue}>
        <GuestBody />
      </LocaleProvider>
    </AppThemeProvider>
  );
}

/** Everything a visitor can press and not have yet. */
type GuestFeature = RayaLockedArea | LockedControl | "history" | "analyze" | "forYou";

/** The single row the history shows: this visit's thread. */
const GUEST_THREAD_ID = "guest";
const SIGNUP = "/login?mode=signup";

function guestConfig(
  tr: (key: MessageKey, vars?: MessageVars) => string,
  onLocked: (control: LockedControl) => void,
): ChatConfig {
  return {
    endpoints: { chat: "/api/raya/try", conversations: "", files: "" },
    capabilities: { voice: false, files: false },
    sendHistory: true,
    locked: onLocked,
    greeting: () => tr("chatHome.greetingNoName"),
    emptyHint: tr("guest.emptyHint", { limit: GUEST_TURN_LIMIT }),
    suggestions: [
      tr("chatHome.suggestion1"),
      tr("chatHome.suggestion2"),
      tr("chatHome.suggestion3"),
      tr("chatHome.suggestion4"),
    ],
    placeholder: tr("chatHome.placeholder"),
  };
}

function GuestBody() {
  const { theme: t } = useAppTheme();
  // The stored thread is read after mount: the server has no browser storage,
  // and a first render that differed from its HTML would not hydrate.
  const [initial, setInitial] = useState<Msg[] | null>(null);
  useEffect(() => {
    setInitial(readGuestThread().map((m, i) => ({ id: `guest-${i}`, role: m.role, content: m.content })));
  }, []);
  if (!initial) return <div style={{ height: "100dvh", background: t.contentBg }} />;
  return <GuestApp initial={initial} />;
}

function GuestApp({ initial }: { initial: Msg[] }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [lock, setLock] = useState<GuestFeature | null>(null);
  const config = guestConfig(tr, setLock);
  const engine = useChatEngine({
    config,
    initialId: null,
    initialMessages: initial,
    initialFiles: [],
    initialConversations: [],
  });
  const [rightOpen, setRightOpen] = useRightPanel();

  // Kept as it is delivered: only settled turns with something in them, so a
  // half-streamed reply or a failed send is never what the account inherits.
  const settled: GuestMessage[] = engine.messages
    .filter((m) => !m.status && m.content)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content ?? "" }));
  const streaming = engine.busy;
  useEffect(() => {
    if (!streaming) saveGuestThread(settled);
    // `settled` is derived from engine.messages; saving when a turn settles is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.messages, streaming]);

  const used = guestTurns(settled);
  const left = Math.max(0, GUEST_TURN_LIMIT - used);
  // The server can also say the trial is over (the same limit, or the shared
  // ceiling of everyone behind this address) — the engine reports it as quota.
  const over = left === 0 || (engine.quota != null && engine.quota.used >= engine.quota.limit);

  const firstAsk = settled.find((m) => m.role === "user")?.content;
  const title = firstAsk ? titleFrom(firstAsk) : tr("chat.newSession");

  // One row, this visit's thread. "New chat" is locked rather than offered: a
  // fresh thread would also be a fresh count of free messages.
  const chatHistory = (
    <ChatHistoryList
      theme={t}
      conversations={firstAsk ? [{ id: GUEST_THREAD_ID, title, updated_at: new Date().toISOString() }] : []}
      activeId={firstAsk ? GUEST_THREAD_ID : null}
      busy={false}
      onNew={() => setLock("history")}
      onSelect={() => {}}
      onDelete={() => setLock("history")}
    />
  );

  const pill = (feature: GuestFeature, label: string, glyph: ReactNode) => (
    <span
      onClick={() => setLock(feature)}
      title={label}
      aria-label={label}
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        fontSize: 14,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 99,
        padding: "6px 13px",
        color: t.mutedLight,
        cursor: "pointer",
      }}
    >
      <span className="app-pill-label">{label}</span>
      <span className="app-pill-glyph">{glyph}</span>
      <IconLock size={11} />
    </span>
  );
  const headerActions = (
    <>
      {pill("kernel", tr("chatHome.viewKernelProfile"), <IconKernel size={15} />)}
      {pill("analyze", tr("chatHome.analyze"), <IconSummary size={15} />)}
    </>
  );

  const rightPanel = rightOpen ? (
    <RightPanel theme={t} width={300} title={tr("chatHome.forYou")} onCollapse={() => setRightOpen(false)}>
      <LockedTeaser theme={t} onOpen={() => setLock("forYou")} lines={[tr("guest.forYou.line1"), tr("guest.forYou.line2"), tr("guest.forYou.line3")]} />
    </RightPanel>
  ) : null;

  const notice =
    used > 0 && !over ? (
      <div style={{ padding: "0 0 8px", fontSize: text.sm, color: t.mutedLight }}>
        {tr(left === 1 ? "guest.leftOne" : "guest.leftOther", { n: left })}{" "}
        <a href={SIGNUP} style={{ color: "inherit", textDecoration: "underline" }}>
          {tr("guest.keepIt")}
        </a>
      </div>
    ) : null;

  const wall = over && !streaming ? <GuestWall /> : null;

  return (
    <>
      <RayaShell
        theme={t}
        active="chat"
        profileName={tr("guest.profileName")}
        profileInitials="?"
        profileAvatarBg={t.mutedLight}
        profileSubtitle={tr("guest.profileSub")}
        chatHistory={chatHistory}
        rightPanel={rightPanel}
        onToggleRight={() => setRightOpen((o) => !o)}
        mobileTitle={title}
        mobileTrailing={
          <a href={SIGNUP} style={ctaStyle(t, "6px 12px", text.sm)}>
            {tr("guest.createAccount")}
          </a>
        }
        locked={setLock}
        sidebarFooter={<SidebarSignup theme={t} left={left} />}
      >
        <ChatSurface
          theme={t}
          engine={engine}
          config={config}
          greetingName=""
          headerActions={headerActions}
          foldHeaderOnPhone
          onToggleRight={() => setRightOpen((o) => !o)}
          rightOpen={rightOpen}
          userInitials="?"
          composerNotice={notice}
          composerReplacement={wall}
        />
      </RayaShell>
      {lock && <LockedSheet feature={lock} left={over ? 0 : left} onClose={() => setLock(null)} />}
    </>
  );
}

const ctaStyle = (t: AppTheme, padding: string, fontSize: number): React.CSSProperties => ({
  display: "inline-block",
  fontSize,
  fontWeight: 600,
  color: t.ctaText,
  background: t.ctaBg,
  borderRadius: 999,
  padding,
  textDecoration: "none",
  whiteSpace: "nowrap",
  textAlign: "center",
});

/** The foot of the sidebar: what this visit is, and the way out of it. */
function SidebarSignup({ theme: t, left }: { theme: AppTheme; left: number }) {
  const tr = useTranslate();
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        border: `1px solid ${t.sidebarBorder}`,
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.45, color: t.sidebarText }}>
        <RayaText>{tr("guest.sidebar.body")}</RayaText>
      </div>
      <div style={{ fontSize: 13, color: t.sidebarMuted }}>
        {tr(left === 1 ? "guest.leftOne" : "guest.leftOther", { n: left })}
      </div>
      <a href={SIGNUP} style={ctaStyle(t, "9px 12px", 14)}>
        {tr("guest.wall.cta")}
      </a>
      <a href="/login" style={{ fontSize: 13, fontWeight: 600, color: t.sidebarText, textAlign: "center", textDecoration: "none" }}>
        {tr("guest.wall.signIn")}
      </a>
    </div>
  );
}

/** A panel's content shown as what it would hold, locked. */
function LockedTeaser({ theme: t, lines, onOpen }: { theme: AppTheme; lines: string[]; onOpen: () => void }) {
  const tr = useTranslate();
  return (
    <div onClick={onOpen} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((l) => (
        <div
          key={l}
          style={{ display: "flex", alignItems: "center", gap: 8, background: t.rowActiveBg, borderRadius: 12, padding: 10, fontSize: 14, color: t.text }}
        >
          <span style={{ flex: 1 }}>
            <RayaText>{l}</RayaText>
          </span>
          <span style={{ color: t.muted, display: "flex" }}>
            <IconLock size={12} />
          </span>
        </div>
      ))}
      <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>{tr("guest.lock.badge")}</div>
    </div>
  );
}

const FEATURE: Record<GuestFeature, { icon: ReactNode; title: MessageKey; body: MessageKey }> = {
  rooms: { icon: <IconRooms size={22} />, title: "guest.lock.rooms.title", body: "guest.lock.rooms.body" },
  tools: { icon: <IconTools size={22} />, title: "guest.lock.tools.title", body: "guest.lock.tools.body" },
  assignments: { icon: <IconQuiz size={22} />, title: "guest.lock.assignments.title", body: "guest.lock.assignments.body" },
  kernel: { icon: <IconKernel size={22} />, title: "guest.lock.kernel.title", body: "guest.lock.kernel.body" },
  settings: { icon: <IconSettings size={22} />, title: "guest.lock.settings.title", body: "guest.lock.settings.body" },
  account: { icon: <IconSettings size={22} />, title: "guest.lock.settings.title", body: "guest.lock.settings.body" },
  voice: { icon: <IconMic size={22} />, title: "guest.lock.voice.title", body: "guest.lock.voice.body" },
  files: { icon: <IconAttach size={22} />, title: "guest.lock.files.title", body: "guest.lock.files.body" },
  modes: { icon: <IconAiMode size={22} />, title: "guest.lock.modes.title", body: "guest.lock.modes.body" },
  history: { icon: <IconChat size={22} />, title: "guest.lock.history.title", body: "guest.lock.history.body" },
  analyze: { icon: <IconSummary size={22} />, title: "guest.lock.analyze.title", body: "guest.lock.analyze.body" },
  forYou: { icon: <IconKernel size={22} />, title: "guest.lock.forYou.title", body: "guest.lock.forYou.body" },
};

/** Pressed something an account opens: what it is, and the one step to it. */
function LockedSheet({ feature, left, onClose }: { feature: GuestFeature; left: number; onClose: () => void }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const f = FEATURE[feature];
  return (
    <Modal onClose={onClose} label={tr(f.title)} maxWidth={420} center>
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 18,
          padding: "22px 22px 18px",
          color: t.text,
          boxShadow: t.dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 30px rgba(15,23,42,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: t.cardBg2,
              color: t.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            {f.icon}
            <span
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: t.ctaBg,
                color: t.ctaText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconLock size={11} />
            </span>
          </span>
          <div style={{ fontSize: text.lg, fontWeight: 700 }}>
            <RayaText>{tr(f.title)}</RayaText>
          </div>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: text.base, lineHeight: 1.6, color: t.muted }}>
          <RayaText>{tr(f.body)}</RayaText>
        </p>
        <p style={{ margin: "0 0 16px", fontSize: text.sm, color: t.mutedLight }}>{tr("guest.lock.badge")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href={SIGNUP} style={ctaStyle(t, "11px 18px", text.base)}>
            {tr("guest.wall.cta")}
          </a>
          <a href="/login" style={{ fontSize: text.sm, fontWeight: 600, color: t.link, textAlign: "center", textDecoration: "none", padding: 4 }}>
            {tr("guest.wall.signIn")}
          </a>
          {left > 0 && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontFamily: "inherit",
                fontSize: text.sm,
                color: t.muted,
                cursor: "pointer",
                padding: 4,
              }}
            >
              {tr("guest.lock.later", { n: left })}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** What an account adds, said where the trial stops. */
function GuestWall() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const perks: MessageKey[] = ["guest.wall.perkMemory", "guest.wall.perkSaved", "guest.wall.perkDocs", "guest.wall.perkTools"];
  return (
    <div
      role="region"
      aria-label={tr("guest.wall.title")}
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 16,
        padding: "18px 20px",
        boxShadow: t.dark ? "0 6px 22px rgba(0,0,0,0.42)" : "0 6px 22px rgba(15,23,42,0.13)",
      }}
    >
      <div style={{ fontSize: text.lg, fontWeight: 700, color: t.text }}>
        <RayaText>{tr("guest.wall.title")}</RayaText>
      </div>
      <p style={{ margin: "6px 0 12px", fontSize: text.base, lineHeight: 1.6, color: t.muted }}>
        <RayaText>{tr("guest.wall.body")}</RayaText>
      </p>
      <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: text.sm, lineHeight: 1.8, color: t.text }}>
        {perks.map((k) => (
          <li key={k}>{tr(k)}</li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a href={SIGNUP} style={ctaStyle(t, "11px 20px", text.base)}>
          {tr("guest.wall.cta")}
        </a>
        <a href="/login" style={{ fontSize: text.sm, fontWeight: 600, color: t.link, textDecoration: "none" }}>
          {tr("guest.wall.signIn")}
        </a>
      </div>
    </div>
  );
}
