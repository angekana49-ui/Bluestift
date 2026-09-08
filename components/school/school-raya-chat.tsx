"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { RightPanel, Scrim, IconButton } from "@/components/ui/shell";
import { useRightPanel } from "@/components/ui/use-right-panel";
import { textInput, ctaButton } from "@/components/ui/forms";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import { fetchHooks, type ChatConfig, type Conversation } from "@/components/chat/types";
import { avatarInitials } from "@/lib/name";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type Role = "admin_master" | "prof";

/**
 * Raya-for-Schools chat — the same engine + surface as the Raya student chat
 * (streaming, voice, document upload, persisted history), wired to the Schools
 * backend. History lives in an in-tab popover (the dashboard sidebar is the
 * nav, not a chat list); the right panel carries the school directives +
 * a derived notifications feed. Rendered in the Raya tab's contentFlush body,
 * so its own header is the single header.
 */
function getSchoolConfig(tr: (key: MessageKey) => string): ChatConfig {
  return {
    endpoints: {
      chat: "/api/school/raya/chat",
      conversations: "/api/school/raya/conversations",
      files: "/api/school/raya/files",
    },
    capabilities: { voice: true, files: true },
    greeting: (name) => (name ? `${tr("school.rayaChat.greetingWithName")} ${name}?` : tr("school.rayaChat.greetingNoName")),
    emptyHint: tr("school.rayaChat.emptyHint"),
    suggestions: [
      tr("school.rayaChat.suggestion1"),
      tr("school.rayaChat.suggestion2"),
      tr("school.rayaChat.suggestion3"),
      tr("school.rayaChat.suggestion4"),
    ],
    placeholder: tr("school.rayaChat.placeholder"),
    // Hybrid: /api/school/raya/hooks personalizes from live insights; offline /
    // no data → the static set above stays.
    personalizedHooks: fetchHooks("/api/school/raya/hooks"),
  };
}

export function SchoolRayaChat({ role, staffName }: { role: Role; staffName?: string }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const SCHOOL_CONFIG = getSchoolConfig(tr);
  const engine = useChatEngine({
    config: SCHOOL_CONFIG,
    initialId: null,
    initialMessages: [],
    initialFiles: [],
    initialConversations: [],
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useRightPanel();

  const { setConversations } = engine;
  // Load persisted history on mount (no SSR here — this is a client tab).
  useEffect(() => {
    (async () => {
      // Cached first: opening the Raya tab shows the known thread list
      // immediately instead of an empty history menu on every visit.
      const { data } = await getJsonCached<{ conversations?: Conversation[] }>(
        "/api/school/raya/conversations",
        {
          cacheKey: "school:rayaConversations",
          onUpdate: (fresh) => setConversations(fresh.conversations ?? []),
        },
      );
      if (data) setConversations(data.conversations ?? []);
    })();
  }, [setConversations]);

  // Address the staffer by ROLE, never by name — the admin surface passes the
  // school name as `staffName`, so "…, Lycée François Dumas?" read absurd. A role
  // word ("Admin"/"Teacher") is always sensible.
  const greetingName = tr(role === "admin_master" ? "school.role.admin" : "school.role.teacher");

  const headerActions = (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <IconButton
        theme={t}
        onClick={() => setHistoryOpen((o) => !o)}
        bg={historyOpen ? t.sidebarActiveBg : t.cardBg2}
        title={tr("school.rayaChat.historyTitle")}
      >
        <IconHistory />
      </IconButton>
      {historyOpen && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            zIndex: 6,
            width: 232,
            maxHeight: 360,
            overflow: "auto",
            background: t.sidebarBg,
            border: `1px solid ${t.sidebarBorder}`,
            borderRadius: 12,
            padding: 8,
          }}
        >
          <ChatHistoryList
            theme={t}
            conversations={engine.conversations}
            activeId={engine.conversationId}
            busy={engine.busy}
            onNew={() => {
              engine.newChat();
              setHistoryOpen(false);
            }}
            onSelect={(id) => {
              engine.selectConversation(id);
              setHistoryOpen(false);
            }}
            onDelete={engine.deleteConversation}
          />
        </div>
      )}
    </span>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ChatSurface
          theme={t}
          engine={engine}
          config={SCHOOL_CONFIG}
          greetingName={greetingName}
          headerActions={headerActions}
          onToggleRight={() => setPanelOpen((o) => !o)}
          rightOpen={panelOpen}
          userInitials={avatarInitials(staffName)}
        />
      </div>
      {panelOpen && <Scrim open onClick={() => setPanelOpen(false)} />}
      {panelOpen && (
        <RightPanel theme={t} width={320} title={tr("school.rayaChat.panelTitle")} onCollapse={() => setPanelOpen(false)}>
          <DirectivesPanel role={role} />
          <NotificationsPanel />
        </RightPanel>
      )}
    </div>
  );
}

// ── right panel: directives + notifications ───────────────────────────────

type Directive = { id: string; content: string; audience: string; isActive: boolean };
const AUDIENCE_LABEL_KEY: Record<string, MessageKey> = {
  both: "school.directives.audienceEveryone",
  students: "school.overview.kpiStudents",
  teachers: "school.team.teachersHeading",
};

/** School directives — admins manage them here; profs read the active ones. */
function DirectivesPanel({ role }: { role: Role }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const isAdmin = role === "admin_master";
  const [items, setItems] = useState<Directive[]>([]);
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await getJsonCached<{ directives?: Directive[] }>("/api/school/directives", {
        cacheKey: "school:directives",
        onUpdate: (fresh) => setItems(fresh.directives ?? []),
      });
      if (data) setItems(data.directives ?? []);
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(
        "/api/school/directives",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content, audience }),
        },
        { timeoutMs: 15_000 },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? tr("school.directives.addFailed"));
      setItems((v) => [d as Directive, ...v]);
      setContent("");
      invalidateCached("school:directives");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.directives.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Directive) {
    try {
      await netFetch(
        "/api/school/directives",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: it.id, isActive: !it.isActive }),
        },
        { timeoutMs: 15_000 },
      );
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
      invalidateCached("school:directives");
    } catch {
      // ignore
    }
  }

  async function remove(id: string) {
    try {
      await netFetch(
        `/api/school/directives?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
        { timeoutMs: 15_000 },
      );
      setItems((v) => v.filter((x) => x.id !== id));
      invalidateCached("school:directives");
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>{tr("school.directives.heading")}</div>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 10 }}>
        {tr("school.directives.introA")} <RayaName /> {tr("school.directives.introB")} <RayaName />{tr("school.directives.introC")}
      </div>
      {error && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 6 }}>{error}</div>}
      {items.length === 0 && <div style={{ fontSize: 13, color: t.muted }}>{tr("school.directives.noneYet")}</div>}
      {items.map((it) => (
        <div
          key={it.id}
          style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 0", borderBottom: `1px solid ${t.cardBorder}` }}
        >
          <span style={{ flex: 1, fontSize: 14, color: t.text, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ color: t.mutedLight }}> · {AUDIENCE_LABEL_KEY[it.audience] ? tr(AUDIENCE_LABEL_KEY[it.audience]) : it.audience}</span>
          </span>
          {isAdmin && (
            <>
              <button
                onClick={() => toggle(it)}
                style={{ background: "transparent", border: "none", color: t.mutedLight, fontSize: 13, cursor: "pointer", padding: 0 }}
              >
                {it.isActive ? tr("school.directives.off") : tr("school.directives.on")}
              </button>
              <button
                onClick={() => remove(it.id)}
                title={tr("school.instructionsPanel.deleteTitle")}
                style={{ background: "transparent", border: "none", color: t.mutedLight, cursor: "pointer", padding: 0 }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      ))}
      {isAdmin && (
        <form onSubmit={add} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            style={{ ...textInput(t), fontSize: 14 }}
            placeholder={tr("school.directives.placeholder")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <select
              style={{ ...textInput(t), fontSize: 14, flex: 1 }}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="both">{tr("school.directives.audienceEveryone")}</option>
              <option value="students">{tr("school.overview.kpiStudents")}</option>
              <option value="teachers">{tr("school.team.teachersHeading")}</option>
            </select>
            <button type="submit" style={{ ...ctaButton(t), fontSize: 14, padding: "8px 14px" }} disabled={busy || !content.trim()}>
              {tr("school.dashboard.addButton")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type SchoolNotification = { id: string; kind: string; title: string; detail: string };

/** Derived notifications feed (join requests, at-risk students). */
function NotificationsPanel() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [items, setItems] = useState<SchoolNotification[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await getJsonCached<{ notifications?: SchoolNotification[] }>(
        "/api/school/notifications",
        {
          cacheKey: "school:notifications",
          cacheTtlMs: 15_000, // shorter — this feed is meant to feel live
          onUpdate: (fresh) => setItems(fresh.notifications ?? []),
        },
      );
      if (data) setItems(data.notifications ?? []);
    })();
  }, []);

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>{tr("room.panelNotifications")}</div>
      {items.length === 0 && <div style={{ fontSize: 13, color: t.muted }}>{tr("school.notifications.allCaughtUp")}</div>}
      {items.map((n) => (
        <div key={n.id} style={{ background: t.rowActiveBg, borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flex: "none",
                background: n.kind === "risk" ? "#ef4444" : n.kind === "request" ? "#f59e0b" : t.mutedLight,
              }}
            />
            {n.title}
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{n.detail}</div>
        </div>
      ))}
    </div>
  );
}

function IconHistory() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
