"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/lib/kernel/types";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel } from "@/components/ui/shell";
import { IconKernel } from "@/components/ui/icons";
import { type AppTheme } from "@/components/ui/tokens";
import { initialsOf, avatarInitials } from "@/lib/name";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import { fetchHooks, type ChatConfig, type Msg, type Conversation, type ConversationFile } from "@/components/chat/types";

export type { ConversationFile } from "@/components/chat/types";

type Recommendation = { content: string; source: string };

/** The Raya student solo-chat: full voice + document upload + conversation history. */
const RAYA_CONFIG: ChatConfig = {
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
  greeting: (name) => (name ? `What are we cracking today, ${name}?` : "What are we cracking today?"),
  emptyHint: "Tell me what you'd like to work on — or pick a quick start.",
  suggestions: ["Pick up where I left off", "Unstick me on something", "Quiz me", "Surprise me"],
  placeholder: "Write your reply to Raya...",
  // Hybrid: if the learner has history, /api/raya/hooks personalizes these;
  // offline / brand-new → the static set above stays.
  personalizedHooks: fetchHooks("/api/raya/hooks"),
};

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
  const [rightOpen, setRightOpen] = useState(true);

  // Branded export of the Kernel analysis (Raya logo, title, footer attribution).
  const analysisDoc = (a: AnalyzeResponse): BrandedDoc => ({
    brand: "raya",
    title: "Kernel analysis",
    meta: new Date().toLocaleDateString(),
    audience: studentName || undefined,
    body: analysisToText(a),
  });

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
        title="View kernel profile"
        aria-label="View kernel profile"
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
        <span className="app-pill-label">View kernel profile</span>
        <span className="app-pill-glyph">
          <IconKernel size={15} />
        </span>
      </span>
      <span
        onClick={() => !busy && messages.length > 0 && onAnalyze()}
        title="Analyze the session (Kernel)"
        style={{
          flex: "none",
          fontSize: 13,
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
    </>
  );

  const rightPanel = rightOpen ? (
    <RightPanel theme={t} width={300} title="For you" onCollapse={() => setRightOpen(false)}>
      <div>
        {recommendations.length === 0 && (
          <div style={{ fontSize: 13, color: t.muted }}>No recommendations yet.</div>
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
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text, flex: 1 }}>Kernel analysis</span>
            <span onClick={() => downloadBrandedText(analysisDoc(analysis))} style={pillBtn(t)}>TXT</span>
            <span onClick={() => downloadBrandedPdf(analysisDoc(analysis))} style={pillBtn(t)}>PDF</span>
            <span onClick={() => setAnalysis(null)} title="Close" style={pillBtn(t)}>✕</span>
          </div>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 4 }}>
            <strong>Root gap:</strong> {analysis.root_gap ?? "—"}
          </div>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 6 }}>
            <strong>Summary:</strong> {analysis.summary || "—"}
          </div>
          <div style={{ fontSize: 13, color: t.muted }}>
            Confidence: {analysis.confidence} · KCs: {Object.keys(analysis.mastery_map).length} · Model: {analysis.llm_used}
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
    >
      <ChatSurface
        theme={t}
        engine={engine}
        config={RAYA_CONFIG}
        greetingName={greetingName}
        headerActions={headerActions}
        onToggleRight={() => setRightOpen((o) => !o)}
        rightOpen={rightOpen}
        userInitials={avatarInitials(studentName)}
        userAvatarUrl={studentAvatarUrl}
      />
    </RayaShell>
  );
}

const pillBtn = (t: AppTheme): React.CSSProperties => ({
  fontSize: 13,
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  color: t.mutedLight,
  borderRadius: 99,
  padding: "3px 8px",
  cursor: "pointer",
});
