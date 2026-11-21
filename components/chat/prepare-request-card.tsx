"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { parsePrepareRequest, type PrepareKind } from "@/lib/prepare-request";
import { type AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { IconFile, IconQuiz } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { DocumentView } from "@/components/ui/document";
import type { BrandedDoc } from "@/lib/document";
import { usePrepareRequestEnv } from "./prepare-request-context";
import type { MessageKey } from "@/lib/i18n";

/**
 * Raya for Schools' ```prepare block, as the teacher sees it: a card naming
 * the kind and what it will be built from, a class picker (the generation
 * grounds on that class's real gaps), and a button. Nothing happens until it
 * is pressed — then the Prepare route builds it (same quota, same checks as
 * the Prepare tab), the card shows a preview of the result and opens it in the
 * very document view the Prepare library uses — with its TXT/PDF downloads.
 *
 * The staff-side mirror of tool-request-card.tsx. What was created is
 * remembered on this device for this block, so coming back to the conversation
 * shows "In Prepare" with a link, not a button that would spend a second
 * generation on the same request.
 */

// The Prepare tab's own kind names — the card and the library never diverge.
const PRETTY: Record<PrepareKind, MessageKey> = {
  exam: "tools.selfTest.kind.exam.label",
  exercise: "school.prepare.kindExerciseSet",
  worksheet: "school.prepare.kindWorksheet",
  quiz: "tools.pretty.quiz",
};

type Created = {
  id: string | null;
  kind: string;
  title: string;
  content: string;
  questions: { prompt?: string }[];
};

type State = { kind: "idle" } | { kind: "creating" } | { kind: "done"; created: Created } | { kind: "remembered"; id: string } | { kind: "error"; message: string };

/** A short, stable key for one block in one conversation (FNV-1a). */
function blockKey(conversationId: string | null, src: string): string {
  let h = 0x811c9dc5;
  for (const c of `${conversationId ?? ""}|${src.trim()}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `bs_prepreq_${h.toString(36)}`;
}

export function PrepareRequestCard({ src, open, theme: t }: { src: string; open?: boolean; theme: AppTheme }) {
  const tr = useTranslate();
  const env = usePrepareRequestEnv();
  const req = open ? null : parsePrepareRequest(src);
  const conversationId = env?.conversationId ?? null;
  const classes = env?.classes ?? [];
  const key = blockKey(conversationId, src);
  const [state, setState] = useState<State>({ kind: "idle" });
  // null = untouched: the teacher's first class, like the Prepare tab, so the
  // material grounds on real gaps unless they pick "general" instead. Kept as
  // a derived value rather than a defaulting effect — the class list can arrive
  // after the card, and an effect would either miss it or re-fire per render.
  const [classId, setClassId] = useState<string | null>(null);
  const effectiveClassId = classId ?? (classes.length > 0 ? classes[0].id : "");
  const [reportId, setReportId] = useState("");
  const [reports, setReports] = useState<{ id: string; title: string }[]>([]);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    try {
      const id = window.localStorage.getItem(key);
      if (id) setState((s) => (s.kind === "idle" ? { kind: "remembered", id } : s));
    } catch {
      // storage unavailable: the button stays, which is the safe side
    }
  }, [key]);

  // The school's reports for the optional "ground on this too" picker — same
  // cached list the Reports tab reads, so this costs nothing when that tab was
  // already visited. A failure hides the picker rather than breaking the card.
  useEffect(() => {
    let live = true;
    const apply = (list: { id: string | null; title: string }[]) => {
      if (live) setReports(list.filter((r) => r.id).map((r) => ({ id: r.id as string, title: r.title })));
    };
    getJsonCached<{ reports?: { id: string | null; title: string }[] }>("/api/school/reports", {
      cacheKey: "school:reports",
      onUpdate: (fresh) => apply(fresh.reports ?? []),
    })
      .then(({ data }) => apply(data?.reports ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!env?.enabled) return null;
  if (open) {
    return <div style={{ ...frame(t), color: t.muted, fontSize: "0.88em" }}>{tr("math.preparing")}</div>;
  }
  if (!req) return null;

  // Built from what was just discussed when the block says the thread holds
  // the material, else from the topic plus the picked class's gaps.
  const fromConversation = req.from === "conversation" && conversationId != null;
  const name = tr(PRETTY[req.kind]);

  async function create() {
    if (!req) return;
    setState({ kind: "creating" });
    try {
      const res = await netFetch(
        "/api/school/prepare",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: req.kind,
            topic: req.topic,
            count: req.count,
            ...(effectiveClassId ? { classId: effectiveClassId } : {}),
            ...(fromConversation ? { conversationId } : {}),
            ...(reportId ? { reportIds: [reportId] } : {}),
          }),
        },
        { timeoutMs: 65_000 },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.content) {
        setState({ kind: "error", message: data?.error ?? tr("chat.prepare.failed") });
        return;
      }
      const created: Created = {
        id: typeof data.id === "string" ? data.id : null,
        kind: data.kind ?? req.kind,
        title: data.title ?? req.topic,
        content: data.content,
        questions: Array.isArray(data.questions) ? data.questions : [],
      };
      if (created.id) {
        try {
          window.localStorage.setItem(key, created.id);
        } catch {
          // not remembered: only costs a second button press on another visit
        }
      }
      // The library list is cached client-side — drop it so Prepare shows the
      // new resource the moment the teacher opens that tab.
      invalidateCached("school:prepare");
      setState({ kind: "done", created });
    } catch {
      setState({ kind: "error", message: tr("chat.prepare.failed") });
    }
  }

  const Icon = req.kind === "quiz" ? IconQuiz : IconFile;
  const inPrepareHref = (id: string) => `/school?tab=prepare&resource=${encodeURIComponent(id)}`;

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
            {fromConversation ? tr("chat.prepare.fromConversation") : tr("chat.prepare.fromTopic", { topic: req.topic })}
          </div>
        </div>
        {state.kind === "idle" && (
          <button type="button" onClick={create} style={primary(t)}>
            {tr("chat.prepare.create")}
          </button>
        )}
        {state.kind === "creating" && <span style={{ fontSize: "0.88em", color: t.muted }}>{tr("chat.prepare.creating")}</span>}
        {state.kind === "remembered" && (
          <Link href={inPrepareHref(state.id)} style={{ ...secondary(t), textDecoration: "none" }}>
            {tr("chat.prepare.inPrepare")}
          </Link>
        )}
      </div>

      {state.kind === "idle" && classes.length > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: "0.85em", color: t.muted }}>
          <span style={{ flex: "none" }}>{tr("chat.prepare.classLabel")}</span>
          <select value={effectiveClassId} onChange={(e) => setClassId(e.target.value)} style={selectStyle(t)}>
            <option value="">{tr("school.prepare.noClassGeneral")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {state.kind === "idle" && reports.length > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: "0.85em", color: t.muted }}>
          <span style={{ flex: "none" }}>{tr("chat.prepare.reportLabel")}</span>
          <select value={reportId} onChange={(e) => setReportId(e.target.value)} style={selectStyle(t)}>
            <option value="">{tr("chat.prepare.noReport")}</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}

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
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)", fontSize: "0.92em", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700 }}>{state.created.title}</div>
            <div style={{ fontSize: "0.85em", color: t.muted, marginTop: 2 }}>
              {tr("chat.prepare.questions", { n: state.created.questions.length })}
            </div>
            {state.created.questions[0]?.prompt && (
              <div style={{ marginTop: 4 }}>1. {state.created.questions[0].prompt}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={primary(t)} onClick={() => setViewOpen(true)}>
              {tr("chat.prepare.open")}
            </button>
            {state.created.id && (
              <Link href={inPrepareHref(state.created.id)} style={{ ...secondary(t), textDecoration: "none" }}>
                {tr("chat.prepare.inPrepare")}
              </Link>
            )}
          </div>
        </>
      )}

      {/* The same branded document view the Prepare library opens: the exact
          rendering, TXT/PDF downloads included. Portalled: a bubble may sit in
          a transformed parent (its entry animation), and `position: fixed`
          inside one is fixed to the bubble. */}
      {viewOpen && state.kind === "done" && createPortal(
        <Modal onClose={() => setViewOpen(false)} label={state.created.title}>
          <DocumentView {...prepareDoc(state.created, tr)} doc={prepareDoc(state.created, tr)} onClose={() => setViewOpen(false)} />
        </Modal>,
        document.body,
      )}
    </div>
  );
}

/** The created resource as the branded document the library view downloads. */
function prepareDoc(c: Created, tr: (key: MessageKey) => string): BrandedDoc {
  const kindKey: Record<string, MessageKey> = {
    exam: "tools.selfTest.kind.exam.label",
    exercise: "school.prepare.kindExerciseSet",
    worksheet: "school.prepare.kindWorksheet",
    quiz: "tools.pretty.quiz",
  };
  return {
    brand: "bluestift",
    title: c.title,
    meta: [kindKey[c.kind] ? tr(kindKey[c.kind]) : c.kind, new Date().toLocaleDateString()].filter(Boolean).join(" · "),
    body: c.content,
  };
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
  return { border: "none", background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "6px 14px", fontSize: "0.88em", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none" };
}

function selectStyle(t: AppTheme): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    fontFamily: "inherit",
    fontSize: "1em",
    color: t.text,
    background: t.cardBg,
    border: `1px solid ${t.controlBorder}`,
    borderRadius: 10,
    padding: "6px 8px",
  };
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
    fontFamily: "inherit",
    cursor: "pointer",
    flex: "none",
  };
}
