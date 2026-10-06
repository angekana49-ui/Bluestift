"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { type AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { RichText } from "./rich-text";

/**
 * Raya explaining a calculation or a graph, under the tool.
 *
 * Starts on the press that opened it; then the learner can ask a question about
 * it. What is sent is the tool's own text (and the sliders' values) — the
 * server recomputes everything with math.js and asks the model only to
 * EXPLAIN those results (app/api/maths/explain/route.ts).
 */
export type ExplainRequest = {
  lang: "calc" | "graph";
  src: string;
  /** The calculator line to explain (its index among the non-empty lines); the whole tool otherwise. */
  focus?: number;
  degrees?: boolean;
  sliders?: Record<string, number>;
};

type State = { kind: "loading" } | { kind: "done"; text: string } | { kind: "error"; message: string };

export function MathExplain({ request, onClose, theme: t }: { request: ExplainRequest; onClose: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [question, setQuestion] = useState("");
  const live = useRef(true);
  // What the explanation was asked about — a new request (another line) starts over.
  const key = JSON.stringify(request);

  async function ask(q: string) {
    setState({ kind: "loading" });
    try {
      const res = await netFetch(
        "/api/maths/explain",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request, question: q || undefined }) },
        { timeoutMs: 65_000 },
      );
      const data = await res.json().catch(() => null);
      if (!live.current) return;
      if (!res.ok || typeof data?.text !== "string") {
        setState({ kind: "error", message: data?.error ?? tr("math.explainFailed") });
        return;
      }
      setState({ kind: "done", text: data.text });
      setQuestion("");
    } catch {
      if (live.current) setState({ kind: "error", message: tr("math.explainFailed") });
    }
  }

  useEffect(() => {
    live.current = true;
    void ask("");
    return () => {
      live.current = false;
    };
    // One request per thing asked about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={tr("math.explain")}
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${t.cardBorder}`,
        borderLeft: `3px solid ${t.link}`,
        background: t.cardBg,
        color: t.text,
        fontSize: "0.95em",
        lineHeight: 1.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span aria-hidden style={{ color: t.link }}>
          ✦
        </span>
        <strong style={{ flex: 1, fontSize: "0.9em" }}>Raya</strong>
        <button type="button" onClick={onClose} aria-label={tr("math.remove")} title={tr("math.remove")} style={small(t)}>
          ×
        </button>
      </div>
      {state.kind === "loading" && <div style={{ color: t.muted, fontSize: "0.9em" }}>{tr("math.explaining")}</div>}
      {state.kind === "error" && (
        <div role="alert" style={{ color: "#d64545", fontSize: "0.9em" }}>
          {state.message}
        </div>
      )}
      {state.kind === "done" && <RichText content={state.text} theme={t} />}
      {state.kind !== "loading" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question.trim());
          }}
          style={{ display: "flex", gap: 6, marginTop: 8 }}
        >
          <input
            value={question}
            maxLength={400}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={tr("math.askPlaceholder")}
            aria-label={tr("math.askPlaceholder")}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "0.95em",
              background: t.inputBg,
              color: t.text,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 8,
              padding: "6px 9px",
            }}
          />
          <button type="submit" style={{ ...small(t), background: t.ctaBg, color: t.ctaText, border: "none", padding: "6px 12px", fontWeight: 700 }}>
            {tr("math.ask")}
          </button>
        </form>
      )}
      <div style={{ marginTop: 6, fontSize: "0.78em", color: t.muted }}>{tr("math.explainNote")}</div>
    </div>
  );
}

/** The "✦ Explain" button that opens it. */
export function ExplainButton({ label, onClick, compact, theme: t }: { label: string; onClick: () => void; compact?: boolean; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        ...small(t),
        color: t.link,
        borderColor: t.controlBorder,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "4px 8px" : "6px 12px",
        fontWeight: 600,
        flex: "none",
      }}
    >
      <span aria-hidden>✦</span>
      {!compact && tr("math.explain")}
    </button>
  );
}

function small(t: AppTheme): CSSProperties {
  return {
    border: `1px solid ${t.controlBorder}`,
    background: "transparent",
    color: t.text,
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: "0.85em",
    fontFamily: "inherit",
    cursor: "pointer",
  };
}
