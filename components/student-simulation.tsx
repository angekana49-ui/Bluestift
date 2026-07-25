"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import type { AppTheme } from "@/components/ui/tokens";

type SimResult = {
  projected_mastery_pct: number | null;
  current_mastery_pct: number | null;
  confidence: "low" | "medium" | "high" | string;
  summary: string;
  assumptions?: string[];
  risks?: string[];
  next_steps?: string[];
};

type SimRun = {
  id: string;
  focus: string | null;
  add_hours: number;
  result: SimResult;
  created_at: string;
};

// One-tap focus suggestions so the field is never a blank box.
const FOCUS_SUGGESTIONS = ["My weakest concepts", "Maths", "Essay writing", "Exam problems", "Reading comprehension"];

const confColor = (c: string) => (c === "high" ? "#22c55e" : c === "medium" ? "#f59e0b" : "#94a3b8");

/**
 * Student what-if simulation — the learner's mirror of the Schools admin
 * projection. "If I put in N more hours/week on X, where could I get?" Grounded
 * on the student's own Kernel profile server-side; the result is a clearly
 * labelled estimate. Dismissible like the other generated panels.
 */
export function StudentSimulation() {
  const { theme: t } = useAppTheme();
  const [focus, setFocus] = useState("");
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [history, setHistory] = useState<SimRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load past runs so the student can revisit them (persisted, owner-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/simulations");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHistory((data.simulations ?? []) as SimRun[]);
      } catch {
        // history is a nicety — ignore failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus, addHours: hours }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't run the simulation.");
        return;
      }
      setResult(data.result as SimResult);
      if (data.id) {
        setHistory((h) => [
          { id: data.id, focus: focus || null, add_hours: hours, result: data.result, created_at: data.createdAt },
          ...h,
        ]);
      }
    } catch {
      setError("Couldn't run the simulation.");
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean): React.CSSProperties => ({
    background: on ? t.ctaBg : "transparent",
    color: on ? t.ctaText : t.muted,
    border: `1px solid ${on ? t.ctaBg : t.cardBorder}`,
    borderRadius: 99,
    padding: "5px 11px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  const current = result?.current_mastery_pct ?? null;
  const projected = result?.projected_mastery_pct ?? null;
  const delta = current != null && projected != null ? projected - current : null;

  return (
    <div style={panelCard(t)}>
      <h2 style={cardTitle(t)}>What-if simulation</h2>
      <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 14, lineHeight: 1.6 }}>
        Project where you could get if you put in more focused study. It&apos;s a grounded estimate from
        your own Kernel profile — a compass, not a promise.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          style={{ ...textInput(t), flex: 1, minWidth: 180, width: "auto" }}
          placeholder="Focus (e.g. Fractions) — optional"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
        <select
          style={{ ...textInput(t), width: "auto", cursor: "pointer" }}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {[1, 2, 3, 5, 8, 10].map((h) => (
            <option key={h} value={h}>
              +{h} h / week
            </option>
          ))}
        </select>
        <button style={{ ...ctaButton(t), opacity: busy ? 0.6 : 1 }} onClick={run} disabled={busy}>
          {busy ? "Projecting…" : "Run"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FOCUS_SUGGESTIONS.map((s) => {
          const on = focus === s;
          return (
            <button key={s} type="button" style={chip(on)} onClick={() => setFocus(on ? "" : s)}>
              {s}
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: "#f87171", marginTop: 10, fontSize: 15 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${t.cardBorder}`, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            {current != null && (
              <Stat theme={t} label="Now" value={`${current}%`} color={t.muted} />
            )}
            {projected != null && (
              <>
                <span style={{ color: t.mutedLight }}>→</span>
                <Stat theme={t} label="Projected" value={`${projected}%`} color="#22c55e" />
              </>
            )}
            {delta != null && (
              <span style={{ fontSize: 14, fontWeight: 700, color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                {delta >= 0 ? "+" : ""}
                {delta} pts
              </span>
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 13,
                fontWeight: 700,
                color: confColor(result.confidence),
                background: t.cardBg2,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 99,
                padding: "3px 10px",
              }}
            >
              {result.confidence} confidence
            </span>
            <button style={ghostButton(t)} title="Dismiss" onClick={() => setResult(null)}>
              ✕
            </button>
          </div>

          <p style={{ fontSize: 15, color: t.text, lineHeight: 1.65, margin: "0 0 12px" }}>{result.summary}</p>

          <List theme={t} title="What this assumes" items={result.assumptions} />
          <List theme={t} title="Watch out for" items={result.risks} />
          <List theme={t} title="Your next steps" items={result.next_steps} accent="#2f7fe0" />

          <p style={{ fontSize: 13, color: t.mutedLight, margin: "10px 0 0" }}>
            Estimate generated from your cognitive profile — not a guarantee.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${t.cardBorder}`, paddingTop: 12 }}>
          <button
            onClick={() => setShowHistory((s) => !s)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: t.muted }}
          >
            {showHistory ? "▾" : "▸"} Past simulations ({history.length})
          </button>
          {showHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {history.map((h) => {
                const proj = h.result?.projected_mastery_pct;
                const cur = h.result?.current_mastery_pct;
                return (
                  <button
                    key={h.id}
                    onClick={() => setResult(h.result)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                      background: t.cardBg,
                      border: `1px solid ${t.cardBorder}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 14, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      +{h.add_hours}h · {h.focus || "weakest concepts"}
                    </span>
                    {cur != null && proj != null && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: proj >= cur ? "#22c55e" : "#ef4444" }}>
                        {cur}%→{proj}%
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: t.mutedLight }}>
                      {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ theme: t, label, value, color }: { theme: AppTheme; label: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.2 }}>
      <span style={{ fontSize: 13, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <strong style={{ fontSize: 21, color }}>{value}</strong>
    </span>
  );
}

function List({
  theme: t,
  title,
  items,
  accent,
}: {
  theme: AppTheme;
  title: string;
  items?: string[];
  accent?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent ?? t.muted, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: t.text, fontSize: 14, lineHeight: 1.6 }}>
        {items.slice(0, 5).map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
