"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { type AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import {
  autoRange,
  niceStep,
  parseCalc,
  parseGraph,
  type LineError,
  type MathBlockLang,
} from "@/lib/math-blocks";

/**
 * The ```graph and ```calc blocks of a Raya reply, as tools the learner can use.
 *
 * Free stand-ins for MATLAB and GeoGebra, computed entirely in the learner's
 * browser: nothing they type here leaves the device, which matters when many
 * of them are minors, and it keeps working on a connection that has just
 * dropped. math.js arrives through a dynamic import the first time a block is
 * on screen — a learner who never sees one never downloads it.
 *
 * The block is editable: the learner can change a function or a number and run
 * it again. That is the point pedagogically (they test their own idea, not
 * ours), and it stays local — the stored reply is what Raya wrote.
 */

type Engine = typeof import("@/lib/math-engine");

let enginePromise: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
  // One download per page, shared by every block; a failure is forgotten so
  // the next block (or a remount) gets to try again.
  enginePromise ??= import("@/lib/math-engine").catch((e) => {
    enginePromise = null;
    throw e;
  });
  return enginePromise;
}

function useEngine(): Engine | "loading" | "failed" {
  const [engine, setEngine] = useState<Engine | "loading" | "failed">("loading");
  useEffect(() => {
    let live = true;
    loadEngine().then(
      (e) => live && setEngine(e),
      () => live && setEngine("failed"),
    );
    return () => {
      live = false;
    };
  }, []);
  return engine;
}

/** Curve colours: distinct in both themes, and never the error red alone. */
const PALETTE = ["#2f6fde", "#e07a1f", "#2a9d55", "#9b5de5", "#d64545", "#0e9aa7"];

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function frame(t: AppTheme): CSSProperties {
  return {
    margin: "0.7em 0 0",
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 12,
    background: t.dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
    padding: 10,
    maxWidth: "100%",
  };
}

function button(t: AppTheme): CSSProperties {
  return {
    border: `1px solid ${t.controlBorder}`,
    background: "transparent",
    color: "inherit",
    borderRadius: 8,
    padding: "3px 10px",
    fontSize: "0.82em",
    cursor: "pointer",
  };
}

function Errors({ errors }: { errors: LineError[] }) {
  const tr = useTranslate();
  if (!errors.length) return null;
  return (
    <div style={{ marginTop: 6, fontSize: "0.82em", color: "#d64545" }}>
      {errors.map((e, i) => (
        <div key={i}>{tr("math.lineError", { line: e.line, text: e.text })}</div>
      ))}
    </div>
  );
}

/**
 * The shared chrome: a title row with Edit / Reset, and the source editor.
 * `children` renders whatever the APPLIED source means.
 */
function Shell({
  lang,
  src,
  theme: t,
  children,
}: {
  lang: MathBlockLang;
  src: string;
  theme: AppTheme;
  children: (applied: string) => ReactNode;
}) {
  const tr = useTranslate();
  const [applied, setApplied] = useState(src);
  const [draft, setDraft] = useState(src);
  const [editing, setEditing] = useState(false);
  return (
    <div style={frame(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <strong style={{ fontSize: "0.82em", flex: 1, opacity: 0.8 }}>
          {tr(lang === "graph" ? "math.graph" : "math.calc")}
        </strong>
        {applied !== src && (
          <button
            type="button"
            style={button(t)}
            onClick={() => {
              setApplied(src);
              setDraft(src);
            }}
          >
            {tr("math.reset")}
          </button>
        )}
        <button type="button" style={button(t)} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          {tr("math.edit")}
        </button>
      </div>
      {editing && (
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: mono,
              fontSize: "0.86em",
              background: t.inputBg,
              color: t.text,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 8,
              padding: 8,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              style={{ ...button(t), background: t.ctaBg, color: t.ctaText, border: "none" }}
              onClick={() => setApplied(draft)}
            >
              {tr("math.run")}
            </button>
            <span style={{ fontSize: "0.78em", color: t.muted }}>{tr("math.editHint")}</span>
          </div>
        </div>
      )}
      {children(applied)}
    </div>
  );
}

// ── Calculator ────────────────────────────────────────────────────────────

function CalcView({ src, engine, theme: t }: { src: string; engine: Engine; theme: AppTheme }) {
  const { lines, errors } = useMemo(() => parseCalc(src), [src]);
  const rows = useMemo(() => engine.runCalc(lines), [engine, lines]);
  return (
    <>
      <div style={{ fontFamily: mono, fontSize: "0.88em", lineHeight: 1.6, overflowX: "auto" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{r.expr}</span>
            {r.error ? (
              <span style={{ color: "#d64545" }}>⚠ {r.error}</span>
            ) : r.result ? (
              <span style={{ color: t.muted }}>
                → <strong style={{ color: t.text }}>{r.result}</strong>
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <Errors errors={errors} />
    </>
  );
}

// ── Graph ─────────────────────────────────────────────────────────────────

/**
 * The drawing is laid out at the width it is actually shown at (clamped), not
 * scaled from a fixed one: scaled, a 480-wide plot in a phone's bubble shrinks
 * its tick labels to four pixels.
 */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(Math.min(640, Math.max(240, entry.contentRect.width))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function GraphView({ src, engine, theme: t }: { src: string; engine: Engine; theme: AppTheme }) {
  const tr = useTranslate();
  const spec = useMemo(() => parseGraph(src), [src]);
  // Several graphs can share a page; each clips to its own area.
  const clipId = `plot-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [box, W] = useWidth();
  const H = Math.round(W * 0.62);
  const [values, setValues] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(1);
  // A new source (Run, Reset, or the reply itself changing) starts fresh.
  useEffect(() => {
    setValues(Object.fromEntries(spec.sliders.map((s) => [s.name, s.value])));
    setZoom(1);
  }, [spec]);

  const baseX = spec.x ?? [-10, 10];
  const cx = (baseX[0] + baseX[1]) / 2;
  const hx = ((baseX[1] - baseX[0]) / 2) * zoom;
  const xWin: [number, number] = [cx - hx, cx + hx];

  const sampled = useMemo(() => {
    const sliders = Object.fromEntries(spec.sliders.map((s) => [s.name, values[s.name] ?? s.value]));
    return engine.sampleGraph(spec, sliders, xWin);
    // xWin is derived from spec + zoom, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, spec, values, zoom]);

  let yWin: [number, number];
  if (spec.y) {
    const cy = (spec.y[0] + spec.y[1]) / 2;
    const hy = ((spec.y[1] - spec.y[0]) / 2) * zoom;
    yWin = [cy - hy, cy + hy];
  } else {
    yWin = autoRange([
      ...sampled.curves.flatMap((c) => c.points.map((p) => p[1])),
      ...sampled.points.map((p) => p.y),
    ]);
  }

  const sx = (x: number) => ((x - xWin[0]) / (xWin[1] - xWin[0])) * W;
  const sy = (y: number) => H - ((y - yWin[0]) / (yWin[1] - yWin[0])) * H;
  const ySpan = yWin[1] - yWin[0];

  /** A curve as path segments, broken at gaps and at asymptote-sized jumps. */
  const path = (pts: [number, number][]) => {
    let d = "";
    let pen = false;
    let prev = NaN;
    for (const [x, y] of pts) {
      const ok = Number.isFinite(y) && Math.abs(y - (yWin[0] + yWin[1]) / 2) < ySpan * 20;
      if (!ok || (pen && Math.abs(y - prev) > ySpan * 2)) {
        pen = false;
        if (!ok) continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
      pen = true;
      prev = y;
    }
    return d;
  };

  const grid = t.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const axis = t.dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const xStep = niceStep(xWin[1] - xWin[0]);
  const yStep = niceStep(ySpan, 6);
  const ticks = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 && out.length < 40; v += step) {
      out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    }
    return out;
  };
  const fmt = (v: number) => String(Number(v.toPrecision(6)));
  // The axes sit at zero when zero is in view, else along the nearest edge.
  const ax = Math.min(H, Math.max(0, sy(0)));
  const ay = Math.min(W, Math.max(0, sx(0)));
  const label = tr("math.graphOf", { list: spec.functions.map((f) => `${f.name}(x) = ${f.expr}`).join(", ") });

  return (
    <>
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={W} height={H} />
            </clipPath>
          </defs>
          {ticks(xWin[0], xWin[1], xStep).map((v) => (
            <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={H} stroke={grid} />
          ))}
          {ticks(yWin[0], yWin[1], yStep).map((v) => (
            <line key={`gy${v}`} x1={0} x2={W} y1={sy(v)} y2={sy(v)} stroke={grid} />
          ))}
          <line x1={0} x2={W} y1={ax} y2={ax} stroke={axis} />
          <line x1={ay} x2={ay} y1={0} y2={H} stroke={axis} />
          <g fontSize={10} fill={t.muted} fontFamily={mono}>
            {ticks(xWin[0], xWin[1], xStep)
              .filter((v) => v !== 0)
              .map((v) => (
                <text key={`lx${v}`} x={sx(v) + 2} y={Math.min(H - 3, ax + 12)}>
                  {fmt(v)}
                </text>
              ))}
            {ticks(yWin[0], yWin[1], yStep)
              .filter((v) => v !== 0)
              .map((v) => (
                <text key={`ly${v}`} x={Math.min(W - 30, ay + 3)} y={sy(v) - 2}>
                  {fmt(v)}
                </text>
              ))}
          </g>
          <g clipPath={`url(#${clipId})`}>
            {sampled.curves.map((c, i) => (
              <path key={c.name + i} d={path(c.points)} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} />
            ))}
            {sampled.points.map((p) => (
              <g key={p.name}>
                <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={t.text} />
                <text x={sx(p.x) + 6} y={sy(p.y) - 6} fontSize={12} fill={t.text} fontWeight={700}>
                  {p.name}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6, fontSize: "0.85em", alignItems: "center" }}>
        {sampled.curves.map((c, i) => (
          <span key={c.name + i} style={{ fontFamily: mono }}>
            <span style={{ color: PALETTE[i % PALETTE.length], fontWeight: 700 }}>━</span> {c.name}(x) = {c.expr}
            {c.error && <span style={{ color: "#d64545" }}> ⚠ {c.error}</span>}
          </span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button type="button" style={button(t)} aria-label={tr("math.zoomIn")} title={tr("math.zoomIn")} onClick={() => setZoom((z) => z / 2)}>
            +
          </button>
          <button type="button" style={button(t)} aria-label={tr("math.zoomOut")} title={tr("math.zoomOut")} onClick={() => setZoom((z) => z * 2)}>
            −
          </button>
        </span>
      </div>

      {spec.sliders.map((s) => {
        const v = values[s.name] ?? s.value;
        return (
          <label key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: mono, fontSize: "0.85em" }}>
            <span style={{ minWidth: 70 }}>
              {s.name} = {fmt(v)}
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={niceStep(s.max - s.min, 100)}
              value={v}
              onChange={(e) => setValues((prev) => ({ ...prev, [s.name]: Number(e.target.value) }))}
              style={{ flex: 1 }}
            />
          </label>
        );
      })}

      {sampled.errors.map((e, i) => (
        <div key={i} style={{ marginTop: 6, fontSize: "0.82em", color: "#d64545" }}>
          ⚠ {e}
        </div>
      ))}
      <Errors errors={spec.errors} />
    </>
  );
}

// ── Entry ─────────────────────────────────────────────────────────────────

/**
 * A maths block inside a reply. `open` while the closing fence has not
 * streamed in yet: a half-written function is not worth plotting.
 */
export function MathBlock({
  lang,
  src,
  open,
  theme: t,
}: {
  lang: MathBlockLang;
  src: string;
  open?: boolean;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  if (open) {
    return <div style={{ ...frame(t), fontSize: "0.85em", color: t.muted }}>{tr("math.preparing")}</div>;
  }
  return <LoadedBlock lang={lang} src={src} theme={t} />;
}

function LoadedBlock({ lang, src, theme: t }: { lang: MathBlockLang; src: string; theme: AppTheme }) {
  const tr = useTranslate();
  const engine = useEngine();
  if (engine === "failed") {
    // The source is still worth showing: it is readable maths on its own.
    return (
      <div style={frame(t)}>
        <div style={{ fontSize: "0.82em", color: t.muted, marginBottom: 6 }}>{tr("math.loadFailed")}</div>
        <pre style={{ margin: 0, fontFamily: mono, fontSize: "0.86em", whiteSpace: "pre-wrap" }}>{src}</pre>
      </div>
    );
  }
  if (engine === "loading") {
    return <div style={{ ...frame(t), fontSize: "0.85em", color: t.muted }}>{tr("math.loading")}</div>;
  }
  return (
    <Shell lang={lang} src={src} theme={t}>
      {(applied) =>
        lang === "graph" ? (
          <GraphView src={applied} engine={engine} theme={t} />
        ) : (
          <CalcView src={applied} engine={engine} theme={t} />
        )
      }
    </Shell>
  );
}
