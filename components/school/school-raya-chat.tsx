"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { RightPanel, Scrim, IconButton } from "@/components/ui/shell";
import { textInput, ctaButton } from "@/components/ui/forms";
import { useChatEngine } from "@/components/chat/use-chat-engine";
import { ChatSurface } from "@/components/chat/chat-surface";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import type { ChatConfig } from "@/components/chat/types";

type Role = "admin_master" | "prof";

/**
 * RAYA-for-Schools chat — the same engine + surface as the Raya student chat
 * (streaming, voice, document upload, persisted history), wired to the Schools
 * backend. History lives in an in-tab popover (the dashboard sidebar is the
 * nav, not a chat list); the right panel carries the school directives +
 * a derived notifications feed. Rendered in the RAYA tab's contentFlush body,
 * so its own header is the single header.
 */
const SCHOOL_CONFIG: ChatConfig = {
  endpoints: {
    chat: "/api/school/raya/chat",
    conversations: "/api/school/raya/conversations",
    files: "/api/school/raya/files",
  },
  capabilities: { voice: true, files: true },
  greeting: (name) => (name ? `Hi ${name}, what should we look into?` : "What should we look into?"),
  emptyHint: "Ask about your classes and students, or attach a document to analyse together.",
  suggestions: ["Which class needs the most attention?", "Who is at risk right now?", "Weakest concepts this week"],
  placeholder: "Ask about your students…",
};

export function SchoolRayaChat({ role, staffName }: { role: Role; staffName?: string }) {
  const { theme: t } = useAppTheme();
  const engine = useChatEngine({
    config: SCHOOL_CONFIG,
    initialId: null,
    initialMessages: [],
    initialFiles: [],
    initialConversations: [],
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const { setConversations } = engine;
  // Load persisted history on mount (no SSR here — this is a client tab).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/raya/conversations");
        const d = await r.json();
        if (r.ok) setConversations(d.conversations ?? []);
      } catch {
        // best-effort — an empty history just starts fresh
      }
    })();
  }, [setConversations]);

  const greetingName = (staffName ?? "").trim().split(/\s+/)[0] || "";

  const headerActions = (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <IconButton
        theme={t}
        onClick={() => setHistoryOpen((o) => !o)}
        bg={historyOpen ? t.sidebarActiveBg : t.cardBg2}
        title="History"
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
        />
      </div>
      {panelOpen && <Scrim open onClick={() => setPanelOpen(false)} />}
      {panelOpen && (
        <RightPanel theme={t} width={320} title="School" onCollapse={() => setPanelOpen(false)}>
          <DirectivesPanel role={role} />
          <NotificationsPanel />
        </RightPanel>
      )}
    </div>
  );
}

// ── right panel: directives + notifications ───────────────────────────────

type Directive = { id: string; content: string; audience: string; isActive: boolean };
const AUDIENCE_LABEL: Record<string, string> = {
  both: "Everyone",
  students: "Students",
  teachers: "Teachers",
};

/** School directives — admins manage them here; profs read the active ones. */
function DirectivesPanel({ role }: { role: Role }) {
  const { theme: t } = useAppTheme();
  const isAdmin = role === "admin_master";
  const [items, setItems] = useState<Directive[]>([]);
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/directives");
        const d = await r.json();
        if (r.ok) setItems(d.directives ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/directives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, audience }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not add.");
      setItems((v) => [d as Directive, ...v]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Directive) {
    try {
      await fetch("/api/school/directives", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: it.id, isActive: !it.isActive }),
      });
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    } catch {
      // ignore
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/school/directives?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setItems((v) => v.filter((x) => x.id !== id));
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 4 }}>Instructions</div>
      <div style={{ fontSize: 10.5, color: t.muted, marginBottom: 10 }}>
        School guidance RAYA passes to students and shows teachers. Never overrides RAYA&apos;s rules.
      </div>
      {error && <div style={{ fontSize: 11, color: "#f87171", marginBottom: 6 }}>{error}</div>}
      {items.length === 0 && <div style={{ fontSize: 11, color: t.muted }}>No directives yet.</div>}
      {items.map((it) => (
        <div
          key={it.id}
          style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 0", borderBottom: `1px solid ${t.cardBorder}` }}
        >
          <span style={{ flex: 1, fontSize: 11.5, color: t.text, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ color: t.mutedLight }}> · {AUDIENCE_LABEL[it.audience] ?? it.audience}</span>
          </span>
          {isAdmin && (
            <>
              <button
                onClick={() => toggle(it)}
                style={{ background: "transparent", border: "none", color: t.mutedLight, fontSize: 10.5, cursor: "pointer", padding: 0 }}
              >
                {it.isActive ? "Off" : "On"}
              </button>
              <button
                onClick={() => remove(it.id)}
                title="Delete"
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
            style={{ ...textInput(t), fontSize: 11.5 }}
            placeholder="e.g. Exam week — prioritise past papers"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <select
              style={{ ...textInput(t), fontSize: 11.5, flex: 1 }}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="both">Everyone</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
            </select>
            <button type="submit" style={{ ...ctaButton(t), fontSize: 11.5, padding: "8px 14px" }} disabled={busy || !content.trim()}>
              Add
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
  const [items, setItems] = useState<SchoolNotification[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/notifications");
        const d = await r.json();
        if (r.ok) setItems(d.notifications ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 8 }}>Notifications</div>
      {items.length === 0 && <div style={{ fontSize: 11, color: t.muted }}>You&apos;re all caught up.</div>}
      {items.map((n) => (
        <div key={n.id} style={{ background: t.rowActiveBg, borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
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
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{n.detail}</div>
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
