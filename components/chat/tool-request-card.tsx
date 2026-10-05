"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { netFetch } from "@/lib/net/client-fetch";
import { parseToolRequest, type ToolKind } from "@/lib/tool-request";
import { type AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { IconFlashcards, IconQuiz, IconSummary } from "@/components/ui/icons";
import { ToolPlayer, playerFor, type ActivePlayer } from "@/components/study/tool-player";
import { useToolRequestEnv } from "./tool-request-context";
import type { MessageKey } from "@/lib/i18n";

/**
 * Raya's ```create block, as the learner sees it: a card naming the tool and
 * what it will be built from, and a button. Nothing happens until it is
 * pressed — then the Tools route builds it (same quota, same checks, same
 * Wikipedia citation as on the Tools page), and the card shows a preview of
 * the result and opens it in the very player the Tools page uses.
 *
 * What was created is remembered on this device for this block, so coming back
 * to the conversation shows "Created" with a link, not a button that would
 * spend a second generation on the same request.
 */

const PRETTY: Record<ToolKind, MessageKey> = {
  quiz: "tools.pretty.quiz",
  summary: "tools.pretty.summary",
  flashcards: "tools.pretty.flashcards",
  mind_map: "tools.pretty.mindMap",
};

type Created = { id: string; toolType: string; content: unknown; reference: { title: string; url: string } | null };

type State = { kind: "idle" } | { kind: "creating" } | { kind: "done"; created: Created } | { kind: "remembered"; id: string } | { kind: "error"; message: string };

/** A short, stable key for one block in one conversation (FNV-1a). */
function blockKey(conversationId: string | null, src: string): string {
  let h = 0x811c9dc5;
  for (const c of `${conversationId ?? ""}|${src.trim()}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `bs_toolreq_${h.toString(36)}`;
}

/** The first words of a text, Markdown and LaTeX marks taken out — a preview, not the content. */
function plain(text: string, max: number): string {
  const flat = text
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")
    .replace(/[#*_`>|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max).replace(/\s\S*$/, "")}…` : flat;
}

export function ToolRequestCard({ src, open, theme: t }: { src: string; open?: boolean; theme: AppTheme }) {
  const tr = useTranslate();
  const env = useToolRequestEnv();
  const req = open ? null : parseToolRequest(src);
  const conversationId = env?.conversationId ?? null;
  const key = blockKey(conversationId, src);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [player, setPlayer] = useState<ActivePlayer | null>(null);

  useEffect(() => {
    try {
      const id = window.localStorage.getItem(key);
      if (id) setState((s) => (s.kind === "idle" ? { kind: "remembered", id } : s));
    } catch {
      // storage unavailable: the button stays, which is the safe side
    }
  }, [key]);

  if (!env?.enabled) return null;
  if (open) {
    return <div style={{ ...frame(t), color: t.muted, fontSize: "0.88em" }}>{tr("math.preparing")}</div>;
  }
  if (!req) return null;

  // Built from what was just studied when there is a thread to read, else from the topic.
  const fromConversation = req.from === "conversation" && conversationId != null;
  const name = tr(PRETTY[req.tool]);
  const title = `${name} — ${req.topic}`;

  async function create() {
    if (!req) return;
    setState({ kind: "creating" });
    try {
      const res = await netFetch(
        "/api/tools/generate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tool_type: req.tool,
            title: req.topic,
            ...(fromConversation ? { conversation_id: conversationId } : { topic: req.topic }),
          }),
        },
        { timeoutMs: 65_000 },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) {
        setState({ kind: "error", message: data?.error ?? tr("chat.tool.failed") });
        return;
      }
      const created: Created = { id: data.id, toolType: data.tool_type, content: data.output_content, reference: data.reference ?? null };
      try {
        window.localStorage.setItem(key, data.id);
      } catch {
        // not remembered: only costs a second button press on another visit
      }
      setState({ kind: "done", created });
    } catch {
      setState({ kind: "error", message: tr("chat.tool.failed") });
    }
  }

  const Icon = req.tool === "quiz" ? IconQuiz : req.tool === "flashcards" ? IconFlashcards : IconSummary;

  return (
    <div style={frame(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{ width: 34, height: 34, borderRadius: 10, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
        >
          <Icon size={17} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: "0.85em", color: t.muted, overflow: "hidden", textOverflow: "ellipsis" }}>
            {fromConversation ? tr("chat.tool.fromConversation") : tr("chat.tool.fromTopic", { topic: req.topic })}
          </div>
        </div>
        {state.kind === "idle" && (
          <button type="button" onClick={create} style={primary(t)}>
            {tr("chat.tool.create")}
          </button>
        )}
        {state.kind === "creating" && <span style={{ fontSize: "0.88em", color: t.muted }}>{tr("chat.tool.creating")}</span>}
        {state.kind === "remembered" && (
          <Link href={`/tools?open=${encodeURIComponent(state.id)}`} style={{ ...secondary(t), textDecoration: "none" }}>
            {tr("chat.tool.inTools")}
          </Link>
        )}
      </div>

      {state.kind === "error" && (
        <div role="alert" style={{ marginTop: 10, fontSize: "0.88em", color: "#d64545", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span>{state.message}</span>
          <button type="button" onClick={create} style={secondary(t)}>
            {tr("chat.retry")}
          </button>
        </div>
      )}

      {state.kind === "done" && (
        <>
          <Preview created={state.created} theme={t} />
          {state.created.reference && (
            <div style={{ marginTop: 6, fontSize: "0.8em", color: t.muted }}>
              {tr("tools.reference")}{" "}
              <a href={state.created.reference.url} target="_blank" rel="noopener noreferrer" style={{ color: t.link }}>
                {state.created.reference.title}
              </a>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={primary(t)} onClick={() => setPlayer(playerFor(state.created.toolType, state.created.id, state.created.content, title))}>
              {tr("chat.tool.open")}
            </button>
            <Link href={`/tools?open=${encodeURIComponent(state.created.id)}`} style={{ ...secondary(t), textDecoration: "none" }}>
              {tr("chat.tool.inTools")}
            </Link>
          </div>
        </>
      )}

      {/* The same full-screen player as the Tools page: the exact rendering.
          Portalled: a bubble may sit in a transformed parent (its entry
          animation), and `position: fixed` inside one is fixed to the bubble. */}
      {player && createPortal(<ToolPlayer player={player} onExit={() => setPlayer(null)} />, document.body)}
    </div>
  );
}

/** A glimpse of what was made, so the learner sees it worked before opening it. */
function Preview({ created, theme: t }: { created: Created; theme: AppTheme }) {
  const tr = useTranslate();
  const c = (created.content ?? {}) as Record<string, unknown>;
  const box: CSSProperties = { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)", fontSize: "0.92em", lineHeight: 1.5 };

  if (created.toolType === "quiz") {
    const qs = Array.isArray(c.questions) ? (c.questions as { question?: string }[]) : [];
    return (
      <div style={box}>
        <div style={{ fontSize: "0.85em", color: t.muted, marginBottom: 4 }}>{tr("chat.tool.questions", { n: qs.length })}</div>
        {qs[0]?.question && <div>1. {plain(qs[0].question, 160)}</div>}
      </div>
    );
  }
  if (created.toolType === "flashcards") {
    const cards = Array.isArray(c.cards) ? (c.cards as { front?: string }[]) : [];
    return (
      <div style={box}>
        <div style={{ fontSize: "0.85em", color: t.muted, marginBottom: 4 }}>{tr("chat.tool.cards", { n: cards.length })}</div>
        {cards[0]?.front && <div>{plain(cards[0].front, 160)}</div>}
      </div>
    );
  }
  if (created.toolType === "mind_map") {
    const branches = Array.isArray(c.branches) ? (c.branches as { label?: string }[]) : [];
    return (
      <div style={box}>
        {typeof c.title === "string" && <div style={{ fontWeight: 700, marginBottom: 6 }}>{c.title}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {branches.slice(0, 7).map((b, i) => (
            <span key={i} style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 99, padding: "2px 10px", fontSize: "0.9em" }}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return <div style={box}>{plain(typeof c.text === "string" ? c.text : "", 260)}</div>;
}

function frame(t: AppTheme): CSSProperties {
  return {
    margin: "0.7em 0 0",
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 12,
    background: t.dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
    color: t.text,
    padding: 12,
    maxWidth: "100%",
  };
}

function primary(t: AppTheme): CSSProperties {
  return { border: "none", background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "6px 14px", fontSize: "0.88em", fontWeight: 700, cursor: "pointer", flex: "none" };
}

function secondary(t: AppTheme): CSSProperties {
  return {
    border: `1px solid ${t.controlBorder}`,
    background: "transparent",
    color: t.text,
    borderRadius: 99,
    padding: "5px 13px",
    fontSize: "0.88em",
    fontWeight: 600,
    cursor: "pointer",
    flex: "none",
  };
}
