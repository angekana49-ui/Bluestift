"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { netFetch } from "@/lib/net/client-fetch";
import { type AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { RichText } from "./rich-text";
import { setChatHandoff } from "@/lib/chat-handoff";

/**
 * Raya explaining a calculation or a graph, under the tool.
 *
 * Starts on the press that opened it. What is sent is the tool's own text (and
 * the sliders' values) — the server recomputes everything with math.js and
 * asks the model only to EXPLAIN those results (app/api/maths/explain/route.ts).
 * Going further is a conversation with Raya, not this box: see `goDeeper`.
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

/*
 * One explanation per thing asked about, for the session.
 *
 * Owner, 2026-10-07: "on dirait que Raya relance le LLM pour les explications
 * à chaque fois". It did: the box fetched on every mount, and it is mounted
 * again by closing and reopening it, by switching between the calculator and
 * the graph, and by the panel going full screen. The same lines with the same
 * settings get the same explanation, so it is kept — in memory, and in
 * sessionStorage so a reload of the Tools page does not pay again either. A
 * request already on its way is shared, not sent twice.
 */
const STORE = "bs_math_explain";
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<State>>();

function readStored(key: string): string | undefined {
  if (cache.has(key)) return cache.get(key);
  try {
    const all = JSON.parse(window.sessionStorage.getItem(STORE) ?? "{}") as Record<string, string>;
    if (typeof all[key] === "string") {
      cache.set(key, all[key]);
      return all[key];
    }
  } catch {
    // no storage: memory only
  }
  return undefined;
}

function remember(key: string, text: string) {
  cache.set(key, text);
  try {
    const all = JSON.parse(window.sessionStorage.getItem(STORE) ?? "{}") as Record<string, string>;
    delete all[key];
    all[key] = text;
    // The last twenty are plenty for one sitting.
    window.sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(Object.entries(all).slice(-20))));
  } catch {
    // best effort
  }
}

/** For the tests: forget what this session was told. */
export function clearExplanations() {
  cache.clear();
  inflight.clear();
}

export function fetchExplanation(key: string, request: ExplainRequest, failed: string): Promise<State> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async (): Promise<State> => {
    try {
      const res = await netFetch(
        "/api/maths/explain",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) },
        { timeoutMs: 65_000 },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.text !== "string") return { kind: "error", message: data?.error ?? failed };
      remember(key, data.text);
      return { kind: "done", text: data.text };
    } catch {
      return { kind: "error", message: failed };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

type Tr = ReturnType<typeof useTranslate>;

/**
 * The first message of the conversation "Go deeper with Raya" opens: what the
 * learner was working on, written out so Raya — and the learner, who sees it
 * as their own message — know where they are, then their question.
 */
export function deeperMessage(request: ExplainRequest, question: string, tr: Tr): string {
  const filled = request.src
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parts = [tr(request.lang === "graph" ? "math.deeperGraph" : "math.deeperCalc"), ...filled.slice(0, 12).map((l) => `• ${l.slice(0, 120)}`)];
  const sliders = Object.entries(request.sliders ?? {})
    .slice(0, 6)
    .map(([k, v]) => `${k} = ${Math.round(v * 1000) / 1000}`);
  if (sliders.length) parts.push(`(${sliders.join(", ")})`);
  const focused = request.focus != null ? filled[request.focus] : undefined;
  if (focused) parts.push(tr("math.deeperLine", { line: focused.slice(0, 120) }));
  const q = question.trim();
  parts.push(q ? tr("math.deeperQuestion", { q: q.slice(0, 400) }) : tr("math.deeperDefault"));
  return parts.join("\n");
}

export function MathExplain({ request, onClose, theme: t }: { request: ExplainRequest; onClose: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  const router = useRouter();
  // What the explanation was asked about — a new request (another line) is another explanation.
  const key = JSON.stringify(request);
  const [state, setState] = useState<State>(() => {
    const known = typeof window === "undefined" ? undefined : readStored(key);
    return known != null ? { kind: "done", text: known } : { kind: "loading" };
  });
  const [question, setQuestion] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const known = readStored(key);
    if (known != null) {
      setState({ kind: "done", text: known });
      return;
    }
    let live = true;
    setState({ kind: "loading" });
    void fetchExplanation(key, request, tr("math.explainFailed")).then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
    // One request per thing asked about (and per press of "retry").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  /*
   * Going further is a conversation, not a second explanation. The follow-up
   * field used to re-run this explanation with the question added — another
   * model call that replaced the answer above it, which read as "nothing
   * happens". It now opens a NEW conversation with Raya, already sent,
   * carrying the lines and the question (lib/chat-handoff.ts; owner, 2026-10-07: "si quelqu'un
   * veut approfondir il est redirigé").
   */
  const goDeeper = () => {
    setChatHandoff(deeperMessage(request, question, tr));
    router.push("/chat");
  };

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
        <div role="alert" style={{ color: "#d64545", fontSize: "0.9em", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{state.message}</span>
          <button type="button" onClick={() => setRetry((n) => n + 1)} style={small(t)}>
            {tr("math.retry")}
          </button>
        </div>
      )}
      {state.kind === "done" && <RichText content={state.text} theme={t} />}
      {state.kind === "done" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goDeeper();
          }}
          style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}
        >
          <input
            value={question}
            maxLength={400}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={tr("math.askPlaceholder")}
            aria-label={tr("math.askPlaceholder")}
            style={{
              flex: "1 1 180px",
              minWidth: 0,
              fontSize: "0.95em",
              background: t.inputBg,
              color: t.text,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 8,
              padding: "7px 9px",
            }}
          />
          <button type="submit" style={{ ...small(t), background: t.ctaBg, color: t.ctaText, border: "none", padding: "7px 12px", fontWeight: 700, flex: "none" }}>
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
