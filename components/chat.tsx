"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { netFetch } from "@/lib/net/client-fetch";
import type { AnalyzeResponse } from "@/lib/kernel/types";
import type { BrandedDoc } from "@/lib/document";
import { DocumentActions } from "@/components/ui/doc-actions";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider, useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { useRightPanel } from "@/components/ui/use-right-panel";
import { useLocale } from "@/lib/use-locale";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel } from "@/components/ui/shell";
import { IconFile, IconKernel, IconSummary } from "@/components/ui/icons";
import { type AppTheme } from "@/components/ui/tokens";
import { initialsOf, avatarInitials } from "@/lib/name";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import { fetchHooks, type ChatConfig, type Msg, type Conversation, type ConversationFile } from "@/components/chat/types";

export type { ConversationFile } from "@/components/chat/types";

type Recommendation = { content: string; source: string };

/** The Raya student solo-chat: full voice + document upload + conversation history. */
function getRayaConfig(tr: (key: MessageKey) => string): ChatConfig {
  return {
    endpoints: {
      chat: "/api/raya/chat",
      conversations: "/api/raya/conversations",
      files: "/api/raya/files",
      summarize: "/api/raya/conversations",
    },
    capabilities: { voice: true, files: true },
    // Metered by the Raya plan — the composer shows what is left of the day.
    metered: true,
    aiModeSwitcher: true,
    greeting: (name) => (name ? `${tr("chatHome.greetingWithName")} ${name}?` : tr("chatHome.greetingNoName")),
    emptyHint: tr("chatHome.emptyHint"),
    suggestions: [
      tr("chatHome.suggestion1"),
      tr("chatHome.suggestion2"),
      tr("chatHome.suggestion3"),
      tr("chatHome.suggestion4"),
    ],
    placeholder: tr("chatHome.placeholder"),
    // Hybrid: if the learner has history, /api/raya/hooks personalizes these;
    // offline / brand-new → the static set above stays.
    personalizedHooks: fetchHooks("/api/raya/hooks"),
  };
}

function analysisToText(a: AnalyzeResponse, tr: (key: MessageKey) => string): string {
  return [
    `${tr("chatHome.rootGapLabel")} ${a.root_gap ?? "-"}`,
    `${tr("room.summaryLabel")} ${a.summary || "-"}`,
    a.recommended_path?.length
      ? `${tr("chatHome.recommendedPathLabel")} ${a.recommended_path.join(" -> ")}`
      : "",
    a.detection_path?.length
      ? `${tr("chatHome.detectionPathLabel")} ${a.detection_path.join(" -> ")}`
      : "",
    `${tr("chatHome.confidenceLabel")} ${a.confidence}`,
    `${tr("chatHome.knowledgeComponentsLabel")} ${Object.keys(a.mastery_map).length}`,
    `${tr("chatHome.modelLabel")} ${a.llm_used}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * `/chat` was the one Raya route that rendered `RayaShell` bare.
 *
 * Every other one — /rooms, /tools, /profile, /assignments, /account — goes
 * through `RayaScaffold`, which mounts `AppThemeProvider` and `LocaleProvider`
 * above the shell. This route called `useDarkMode()` privately and threaded the
 * theme down as props instead, which worked for as long as nothing inside the
 * shell read the CONTEXT. `SettingsSheet` does — it needs `setMode`, not just a
 * palette — so opening Settings on the most-used screen in the product threw.
 *
 * The providers have to sit ABOVE whatever renders the shell, so the body is
 * split out rather than wrapped in place: this component owns the single
 * `useDarkMode` instance and the body reads it back through `useAppTheme()`,
 * which is also what makes the theme switch inside Settings re-render the
 * conversation behind it instead of only the sheet.
 */
export function Chat(props: React.ComponentProps<typeof ChatBody>) {
  const value = useDarkMode();
  const localeValue = useLocale();
  return (
    <AppThemeProvider value={value}>
      <LocaleProvider value={localeValue}>
        <ChatBody {...props} />
      </LocaleProvider>
    </AppThemeProvider>
  );
}

function ChatBody({
  conversationId: initialId,
  initialMessages,
  initialFiles,
  conversations: initialConversations,
  recommendations = [],
  studentName = "Emma M.",
  studentAvatarUrl,
  studentPlan,
  openConversationId = null,
}: {
  conversationId: string | null;
  initialMessages: Msg[];
  initialFiles: ConversationFile[];
  conversations: Conversation[];
  recommendations?: Recommendation[];
  studentName?: string;
  studentAvatarUrl?: string | null;
  /** Plan/forfait label shown under the name in the sidebar profile chip. */
  studentPlan?: string;
  /**
   * A thread the learner explicitly asked for (`/chat?c=<id>`, e.g. from the
   * Memory list on the Kernel page).
   *
   * This does NOT undo "Raya always opens blank". That rule is about the app
   * deciding on its own to reopen whatever was left behind; this is a link
   * someone clicked, which is the same act as clicking a row in the history —
   * and it takes the same client-side path, so the page itself stays free of
   * the two blocking queries it used to make on every open.
   */
  openConversationId?: string | null;
}) {
  const router = useRouter();
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const RAYA_CONFIG = getRayaConfig(tr);
  const engine = useChatEngine({
    config: RAYA_CONFIG,
    initialId,
    initialMessages,
    initialFiles,
    initialConversations,
  });
  const { messages, busy, setError, setBusy } = engine;

  // Open the requested thread once, on mount. `selectConversation` already
  // no-ops when it is busy or the thread is current, and the ref keeps a
  // re-render from re-issuing it.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !openConversationId) return;
    deepLinked.current = true;
    void engine.selectConversation(openConversationId);
  }, [openConversationId, engine]);

  // Kernel analysis is Raya-specific — it stays here, off the shared engine.
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [rightOpen, setRightOpen] = useRightPanel();

  // Branded export of the Kernel analysis (Raya logo, title, footer attribution).
  const analysisDoc = (a: AnalyzeResponse): BrandedDoc => ({
    brand: "raya",
    title: tr("chatHome.kernelAnalysisTitle"),
    meta: new Date().toLocaleDateString(),
    audience: studentName || undefined,
    body: analysisToText(a, tr),
  });

  async function onAnalyze() {
    if (messages.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      // Proxies to the external Kernel service — give it more room than a
      // plain JSON round trip before calling it unreachable.
      const res = await netFetch(
        "/api/kernel/analyze",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversation_history: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content ?? "",
            })),
          }),
        },
        { timeoutMs: 20_000 },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.detail
            ? `${tr("chatHome.kernelErrorPrefix")} ${JSON.stringify(data.detail)}`
            : `${tr("chat.requestFailedPrefix")} (${res.status}). ${tr("chatHome.isKernelRunning")}`,
        );
        return;
      }
      setAnalysis(data as AnalyzeResponse);
    } catch {
      setError(tr("chatHome.couldNotReachKernel"));
    } finally {
      setBusy(false);
    }
  }

  const greetingName = studentName.trim().split(/\s+/)[0] || "";

  const chatHistory = (
    <ChatHistoryList
      theme={t}
      conversations={engine.conversations}
      activeId={engine.conversationId}
      busy={busy}
      onNew={engine.newChat}
      onSelect={engine.selectConversation}
      onDelete={engine.deleteConversation}
      onArchive={engine.setArchived}
      onMemorize={engine.memorizeConversation}
    />
  );

  const headerActions = (
    <>
      {/* Below 900px this pill drops its words and keeps the brain glyph — the
          header has a title, two pills and two icon buttons to fit, and this
          label is the widest thing in the row. */}
      <span
        onClick={() => router.push("/profile")}
        title={tr("chatHome.viewKernelProfile")}
        aria-label={tr("chatHome.viewKernelProfile")}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 13,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 99,
          padding: "6px 13px",
          color: t.mutedLight,
          cursor: "pointer",
        }}
      >
        <span className="app-pill-label">{tr("chatHome.viewKernelProfile")}</span>
        <span className="app-pill-glyph">
          <IconKernel size={15} />
        </span>
      </span>
      {/* Same swap, same reason: on a phone the header's four controls and the
          session title were fighting over 375px, and the title lost — it was
          rendering as three letters and an ellipsis while "In session" wrapped
          under the dot. Words above the tier, glyph below it. */}
      <span
        onClick={() => !busy && messages.length > 0 && onAnalyze()}
        title={tr("chatHome.analyzeSessionTitle")}
        aria-label={tr("chatHome.analyzeSessionTitle")}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          fontSize: 13,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 99,
          padding: "6px 13px",
          color: t.mutedLight,
          cursor: busy || messages.length === 0 ? "default" : "pointer",
          opacity: busy || messages.length === 0 ? 0.45 : 1,
        }}
      >
        <span className="app-pill-label">{tr("chatHome.analyze")}</span>
        <span className="app-pill-glyph">
          <IconSummary size={15} />
        </span>
      </span>
    </>
  );

  const rightPanel = rightOpen ? (
    <RightPanel theme={t} width={300} title={tr("chatHome.forYou")} onCollapse={() => setRightOpen(false)}>
      {/* PHONE ONLY — what the session header carries at every other width.
          It is folded away below 700px (`.chat-session-header.is-foldable`),
          where the shell's header already names the conversation, so the two
          controls on it that have nowhere else to go come here. The Kernel
          pill does not: "My Kernel" is a nav item three inches to the left. */}
      <div className="app-only-phone">
        <div style={panelSectionTitle(t)}>{tr("chatHome.sessionTitle")}</div>
        <button
          type="button"
          onClick={() => !busy && messages.length > 0 && onAnalyze()}
          disabled={busy || messages.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            color: t.text,
            cursor: busy || messages.length === 0 ? "default" : "pointer",
            opacity: busy || messages.length === 0 ? 0.45 : 1,
          }}
        >
          <IconSummary size={15} />
          {tr("chatHome.analyze")}
        </button>
        <div style={{ ...panelSectionTitle(t), marginTop: 14 }}>{tr("chat.sessionDocuments")}</div>
        {engine.sessionFiles.length === 0 ? (
          <div style={{ fontSize: 13, color: t.muted }}>{tr("chat.noDocuments")}</div>
        ) : (
          engine.sessionFiles.map((f) => (
            <div
              key={f.id}
              onClick={() => engine.setPreview(f)}
              title={f.file_name ?? undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", borderRadius: 9, cursor: "pointer" }}
            >
              <IconFile size={13} style={{ color: t.muted }} />
              <span style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.file_name}
              </span>
            </div>
          ))
        )}
      </div>

      <div>
        {recommendations.length === 0 && (
          <div style={{ fontSize: 13, color: t.muted }}>{tr("chatHome.noRecommendationsYet")}</div>
        )}
        {recommendations.map((r, i) => (
          <div key={i} style={{ background: t.rowActiveBg, borderRadius: 12, padding: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{r.content}</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{r.source}</div>
          </div>
        ))}
      </div>

      {analysis && (
        <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text, flex: 1 }}>{tr("chatHome.kernelAnalysisTitle")}</span>
            {/* One student's own analysis: never cached (see doc-actions.tsx's
                `personal`), and not shareable — this stays theirs. */}
            <DocumentActions doc={analysisDoc(analysis)} compact shareable={false} personal />
            <span onClick={() => setAnalysis(null)} title={tr("room.closeTitle")} style={pillBtn(t)}>✕</span>
          </div>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 4 }}>
            <strong>{tr("chatHome.rootGapLabel")}</strong> {analysis.root_gap ?? "—"}
          </div>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 6 }}>
            <strong>{tr("room.summaryLabel")}</strong> {analysis.summary || "—"}
          </div>
          <div style={{ fontSize: 13, color: t.muted }}>
            {tr("chatHome.confidenceLabel")} {analysis.confidence} · {tr("chatHome.kcsAbbrev")} {Object.keys(analysis.mastery_map).length} · {tr("chatHome.modelLabel")} {analysis.llm_used}
          </div>
        </div>
      )}
    </RightPanel>
  ) : null;

  return (
    <RayaShell
      theme={t}
      active="chat"
      profileName={studentName}
      profileInitials={initialsOf(studentName)}
      profileAvatarUrl={studentAvatarUrl}
      profileSubtitle={studentPlan}
      chatHistory={chatHistory}
      rightPanel={rightPanel}
      onToggleRight={() => setRightOpen((o) => !o)}
      // The phone has one header, and it is this one — so it names the
      // conversation rather than repeating the word the sidebar already shows.
      mobileTitle={engine.activeTitle}
    >
      <ChatSurface
        theme={t}
        engine={engine}
        config={RAYA_CONFIG}
        greetingName={greetingName}
        headerActions={headerActions}
        foldHeaderOnPhone
        onToggleRight={() => setRightOpen((o) => !o)}
        rightOpen={rightOpen}
        userInitials={avatarInitials(studentName)}
        userAvatarUrl={studentAvatarUrl}
      />
    </RayaShell>
  );
}

/** Same section label the room's panel uses — these two panels sit in the same
 *  app and should not each invent their own heading. */
const panelSectionTitle = (t: AppTheme): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: t.mutedLight,
  margin: "0 0 8px",
});

const pillBtn = (t: AppTheme): React.CSSProperties => ({
  fontSize: 13,
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  color: t.mutedLight,
  borderRadius: 99,
  padding: "3px 8px",
  cursor: "pointer",
});
