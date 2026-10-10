"use client";

import { useEffect, useState } from "react";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider, useTranslate } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { RayaName, RayaText } from "@/components/ui/brand";
import { text } from "@/components/ui/tokens";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import type { ChatConfig, Msg } from "@/components/chat/types";
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
 * The same chat surface as the signed-in one, on a stateless endpoint, with
 * everything that needs an account left off: no history list, no documents,
 * no voice, no personas, no Tools. The thread is kept in this browser so a
 * reload does not lose it and the account created at the end inherits it.
 *
 * After GUEST_TURN_LIMIT turns the composer gives way to the sign-up card. The
 * reply that used the last turn is shown in full first — the wall arrives after
 * Raya has been useful, not in the middle of being useful.
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

function guestConfig(tr: (key: MessageKey, vars?: MessageVars) => string): ChatConfig {
  return {
    endpoints: { chat: "/api/raya/try", conversations: "", files: "" },
    capabilities: { voice: false, files: false },
    sendHistory: true,
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
  const tr = useTranslate();
  // The stored thread is read after mount: the server has no browser storage,
  // and a first render that differed from its HTML would not hydrate.
  const [initial, setInitial] = useState<Msg[] | null>(null);
  useEffect(() => {
    setInitial(readGuestThread().map((m, i) => ({ id: `guest-${i}`, role: m.role, content: m.content })));
  }, []);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: t.contentBg, color: t.text }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: t.cardBg,
          borderBottom: `1px solid ${t.cardBorder}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.dark ? "/raya-mark-dark.png" : "/raya-mark.png"} alt="" width={26} height={26} />
        <span style={{ fontSize: 20, flex: 1 }}>
          <RayaName />
        </span>
        <a href="/login" style={{ fontSize: text.sm, fontWeight: 600, color: t.text, textDecoration: "none", padding: "8px 10px" }}>
          {tr("guest.signIn")}
        </a>
        <a
          href="/login?mode=signup"
          style={{
            fontSize: text.sm,
            fontWeight: 600,
            color: t.ctaText,
            background: t.ctaBg,
            borderRadius: 999,
            padding: "8px 14px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {tr("guest.createAccount")}
        </a>
      </header>
      {initial && <GuestThread initial={initial} />}
    </div>
  );
}

function GuestThread({ initial }: { initial: Msg[] }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const config = guestConfig(tr);
  const engine = useChatEngine({
    config,
    initialId: null,
    initialMessages: initial,
    initialFiles: [],
    initialConversations: [],
  });

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

  const notice =
    used > 0 ? (
      <div style={{ padding: "0 0 8px", fontSize: text.sm, color: t.mutedLight }}>
        {tr(left === 1 ? "guest.leftOne" : "guest.leftOther", { n: left })}{" "}
        <a href="/login?mode=signup" style={{ color: "inherit", textDecoration: "underline" }}>
          {tr("guest.keepIt")}
        </a>
      </div>
    ) : null;

  const wall = over && !streaming ? <GuestWall /> : null;

  return (
    <ChatSurface
      theme={t}
      engine={engine}
      config={config}
      greetingName=""
      hideHeader
      composerNotice={notice}
      composerReplacement={wall}
    />
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
        <a
          href="/login?mode=signup"
          style={{
            fontSize: text.base,
            fontWeight: 600,
            color: t.ctaText,
            background: t.ctaBg,
            borderRadius: 999,
            padding: "11px 20px",
            textDecoration: "none",
          }}
        >
          {tr("guest.wall.cta")}
        </a>
        <a href="/login" style={{ fontSize: text.sm, fontWeight: 600, color: t.link, textDecoration: "none" }}>
          {tr("guest.wall.signIn")}
        </a>
      </div>
    </div>
  );
}
