"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/lib/kernel/types";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { useDarkMode } from "@/components/ui/theme";
import { RayaShell } from "@/components/raya/raya-shell";
import { RightPanel } from "@/components/ui/shell";
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

export function Chat({
  conversationId: initialId,
  initialMessages,
  initialFiles,
  conversations: initialConversations,
  recommendations = [],
  studentName = "Emma M.",
  studentAvatarUrl,
  studentPlan,
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
}) {
  const router = useRouter();
  const { theme: t } = useDarkMode();
  const engine = useChatEngine({
    config: RAYA_CONFIG,
    initialId,
    initialMessages,
    initialFiles,
    initialConversations,
  });
  const { messages, busy, setError, setBusy } = engine;

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
    />
  );

  const headerActions = (
    <>
      <span
        onClick={() => router.push("/profile")}
        style={{
          flex: "none",
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
        View kernel profile
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
