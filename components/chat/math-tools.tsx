"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { type AppTheme } from "@/components/ui/tokens";
import { useMathsDock } from "@/components/raya/maths-dock-context";
import { useAppLocale, useTranslate } from "@/components/ui/locale";
import {
  autoRange,
  graphToSource,
  nextFunctionName,
  nextPointName,
  niceStep,
  parseCalc,
  parseGraph,
  type GraphSpec,
  type LineError,
  type MathBlockLang,
} from "@/lib/math-blocks";

/**
 * The graph and the calculator: in a Raya reply (```graph / ```calc), and on
 * the Tools page.
 *
 * Built for a collégien, not a MATLAB user. The learner writes the way they
 * would in an exercise book — x², √(…), 3,5, "2x + 3 = 7", "dérivée de x³" —
 * helped by a keypad, and every line comes back typeset like a textbook
 * (KaTeX), never as code. A graph is a list of functions to fill in; any
 * letter other than x becomes a slider on its own.
 *
 * Everything is computed in the learner's browser: nothing they type here
 * leaves the device, which matters when many of them are minors, and it keeps
 * working on a connection that has just dropped. math.js and KaTeX arrive
 * through a dynamic import the first time a tool is on screen.
 */

type Engine = typeof import("@/lib/math-engine");

let enginePromise: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
  // One download per page, shared by every tool; a failure is forgotten so
  // the next tool (or a remount) gets to try again.
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
const ERROR = "#d64545";

/** A function's colour — its curve, and the areas and tangents drawn from it. */
function colourFor(spec: GraphSpec, name: string): string {
  return PALETTE[Math.max(0, spec.functions.findIndex((f) => f.name === name)) % PALETTE.length];
}

function frame(t: AppTheme): CSSProperties {
  return {
    margin: "0.7em 0 0",
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 12,
    background: t.dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
    // Set, not inherited: in a bubble the colour comes from the bubble, but on
    // the Tools page the tool sits straight on the page ground.
    color: t.text,
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
    padding: "4px 10px",
    fontSize: "0.85em",
    cursor: "pointer",
  };
}

/** A button laid over the plot: opaque, so the grid does not show through its label. */
function overlayButton(t: AppTheme): CSSProperties {
  return {
    border: `1px solid ${t.controlBorder}`,
    background: t.cardBg,
    color: t.text,
    borderRadius: 8,
    height: 30,
    padding: "0 9px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  };
}

function field(t: AppTheme): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    fontSize: "1em",
    background: t.inputBg,
    color: t.text,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: 8,
    padding: "6px 9px",
  };
}

/** French, Spanish and German readers write 3,5 — numbers are shown their way. */
function useDecimalComma(): boolean {
  return useAppLocale().locale !== "en";
}

/** KaTeX output. Safe to inject: KaTeX escapes its input and runs no links or scripts. */
function Tex({ html, style }: { html: string; style?: CSSProperties }) {
  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Keypad ────────────────────────────────────────────────────────────────

/** The input the keypad types into, and how to change its value. */
type Target = { el: HTMLInputElement; set: (v: string) => void };

function useKeypadTarget() {
  const target = useRef<Target | null>(null);
  const bind = (set: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      target.current = { el: e.currentTarget, set };
    },
  });
  /**
   * Type `text` at the caret. A `{}` in it marks where the caret should land
   * — "intégrale de {} de 0 à 1" leaves the learner typing the function.
   */
  const insert = (text: string) => {
    const tgt = target.current;
    if (!tgt || !tgt.el.isConnected) return;
    const { el } = tgt;
    const at = text.indexOf("{}");
    const clean = text.replace("{}", "");
    const caret = at >= 0 ? at : clean.length;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + clean + el.value.slice(end);
    tgt.set(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + caret, start + caret);
    });
  };
  return { bind, insert };
}

type KeyTab = "basic" | "functions" | "analysis";
type Key = { label: string; insert: string; wide?: boolean; title?: string };

/**
 * The keys, in three tabs so a collégien is not faced with thirty of them at
 * once: the basics (powers, roots, π), the functions (trigonometry and its
 * inverses, ln, log, eˣ) and — in the calculator — analysis (solve, derive,
 * integrate, limits), each of which types the sentence to complete.
 */
function Keypad({ calc, onKey, theme: t }: { calc: boolean; onKey: (text: string) => void; theme: AppTheme }) {
  const tr = useTranslate();
  const [tab, setTab] = useState<KeyTab>("basic");
  const keys: Record<KeyTab, Key[]> = {
    basic: [
      { label: "x²", insert: "²" },
      { label: "xⁿ", insert: "^" },
      { label: "√", insert: "√(" },
      { label: "∛", insert: "∛(" },
      { label: "π", insert: "π" },
      { label: "e", insert: "e" },
      { label: "(", insert: "(" },
      { label: ")", insert: ")" },
      { label: "×", insert: "×" },
      { label: "÷", insert: "÷" },
      { label: "|x|", insert: "|" },
      { label: "°", insert: "°" },
      { label: "n!", insert: "!" },
      ...(calc ? [{ label: "=", insert: " = " }] : []),
    ],
    functions: [
      { label: "sin", insert: "sin(" },
      { label: "cos", insert: "cos(" },
      { label: "tan", insert: "tan(" },
      { label: "arcsin", insert: "arcsin(" },
      { label: "arccos", insert: "arccos(" },
      { label: "arctan", insert: "arctan(" },
      { label: "ln", insert: "ln(" },
      { label: "log", insert: "log(" },
      { label: "eˣ", insert: "e^(" },
    ],
    analysis: [
      { label: tr("math.key.solve"), insert: `${tr("math.word.solve")} `, wide: true },
      { label: tr("math.key.derivative"), insert: `${tr("math.word.derivative")} `, wide: true },
      { label: tr("math.key.primitive"), insert: tr("math.tpl.primitive"), wide: true },
      { label: tr("math.key.integral"), insert: tr("math.tpl.integral"), wide: true },
      { label: tr("math.key.limit"), insert: tr("math.tpl.limit"), wide: true },
      { label: tr("math.key.simplify"), insert: `${tr("math.word.simplify")} `, wide: true },
    ],
  };
  const tabs: KeyTab[] = calc ? ["basic", "functions", "analysis"] : ["basic", "functions"];
  const wide = keys[tab].some((k) => k.wide);
  return (
    <div style={{ margin: "4px 0 10px", padding: 8, borderRadius: 12, background: t.cardBg2, border: `1px solid ${t.cardBorder}` }}>
      <Switch
        theme={t}
        value={tab}
        options={tabs.map((k) => ({ value: k, label: tr(`math.tab.${k}`) }))}
        onChange={setTab}
        // Keep the focus in the input being typed into.
        keepFocus
      />
      {/* An even grid, like a calculator's keys — not a ragged row of chips. */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${wide ? 118 : 44}px, 1fr))`, gap: 5, marginTop: 8 }}>
        {keys[tab].map((k) => (
          <button
            key={k.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(k.insert)}
            style={{
              border: `1px solid ${t.cardBorder}`,
              background: t.cardBg,
              color: t.text,
              borderRadius: 9,
              height: 36,
              padding: "0 6px",
              fontSize: "0.95em",
              fontFamily: k.wide ? "inherit" : "Georgia, 'Times New Roman', serif",
              fontWeight: k.wide ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small segmented control: the keypad's tabs, degrees or radians. */
function Switch<T extends string>({
  theme: t,
  value,
  options,
  onChange,
  label,
  keepFocus,
}: {
  theme: AppTheme;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  /** Leave the focus where it is (the input the keypad types into). */
  keepFocus?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 99, background: t.pillTrackBg, maxWidth: "100%", flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
            onClick={() => onChange(o.value)}
            style={{
              border: `1px solid ${on ? t.controlBorder : "transparent"}`,
              background: on ? t.cardBg : "transparent",
              color: on ? t.text : t.muted,
              borderRadius: 99,
              padding: "3px 12px",
              fontSize: "0.82em",
              fontWeight: on ? 700 : 550,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const ANGLES_KEY = "bs_math_degrees";

/** Degrees or radians, remembered on this device for the learner's own calculator. */
function useDegrees(remember: boolean): [boolean, (v: boolean) => void] {
  const [degrees, setDegrees] = useState(false);
  useEffect(() => {
    if (!remember) return;
    try {
      setDegrees(window.localStorage.getItem(ANGLES_KEY) === "1");
    } catch {
      // storage unavailable: radians, the default
    }
  }, [remember]);
  const set = (v: boolean) => {
    setDegrees(v);
    if (!remember) return;
    try {
      window.localStorage.setItem(ANGLES_KEY, v ? "1" : "0");
    } catch {
      // not remembered, still applied
    }
  };
  return [degrees, set];
}

function AngleSwitch({ degrees, onChange, theme: t }: { degrees: boolean; onChange: (v: boolean) => void; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88em", color: t.muted, marginBottom: 10 }}>
      <span>{tr("math.angles")}</span>
      <Switch
        theme={t}
        label={tr("math.angles")}
        value={degrees ? "deg" : "rad"}
        options={[
          { value: "deg", label: tr("math.deg") },
          { value: "rad", label: tr("math.rad") },
        ]}
        onChange={(v) => onChange(v === "deg")}
      />
    </div>
  );
}

function RemoveButton({ onClick, theme: t }: { onClick: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <button type="button" aria-label={tr("math.remove")} title={tr("math.remove")} onClick={onClick} style={{ ...button(t), padding: "4px 8px", color: t.muted }}>
      ×
    </button>
  );
}

// ── Calculator ────────────────────────────────────────────────────────────

type Row = ReturnType<Engine["runCalc"]>[number];

/** What went wrong, said so the learner knows what to change — not "error". */
function problemText(row: Row, tr: ReturnType<typeof useTranslate>): string {
  const p = row.problem;
  if (p?.kind === "unknownFunction") return tr("math.err.unknownFunction", { name: p.name });
  if (p?.kind === "unknownSymbol") return tr("math.err.unknownSymbol", { name: p.name });
  if (p?.kind === "brackets") return tr("math.err.brackets");
  if (p?.kind === "diverges") return tr("math.err.diverges");
  return tr("math.cantRead");
}

function CalcResult({ row, raw, theme: t }: { row: Row; raw: string; theme: AppTheme }) {
  const tr = useTranslate();
  if (row.error) {
    return (
      <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
        {row.inputHtml && <Tex html={row.inputHtml} />}
        <span style={{ color: ERROR, fontSize: "0.88em" }}>{problemText(row, tr)}</span>
      </span>
    );
  }
  const noteText =
    row.note === "noSolution"
      ? tr("math.noSolution")
      : row.note === "everyValue"
        ? tr("math.everyValue")
        : row.note === "noPrimitive"
          ? tr("math.noPrimitive")
          : row.note === "noLimit"
            ? tr("math.noLimit")
            : null;
  // The answer in the link blue: the one thing on the line the learner came for.
  const answer = row.resultHtml ? <Tex html={row.resultHtml} style={{ fontWeight: 600, color: t.link }} /> : noteText ? <span>{noteText}</span> : null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
      {row.inputHtml ? <Tex html={row.inputHtml} /> : <span>{raw}</span>}
      {answer && (
        <>
          <span style={{ color: t.muted }}>→</span>
          {answer}
        </>
      )}
      {row.note === "approx" && <span style={{ fontSize: "0.8em", color: t.muted }}>({tr("math.approx")})</span>}
      {/* Two one-sided limits: the values are shown, and why that is "no limit". */}
      {row.resultHtml && noteText && <span style={{ fontSize: "0.8em", color: t.muted }}>{noteText}</span>}
    </span>
  );
}

function CalcTool({
  lines,
  editing,
  standalone,
  onChange,
  engine,
  theme: t,
}: {
  lines: string[];
  editing: boolean;
  /**
   * The learner's own calculator (the Maths panel), not a block in a reply:
   * their degrees/radians choice is remembered. A reply's block is always read
   * in radians — Raya writes ° when she means degrees.
   */
  standalone: boolean;
  onChange: (lines: string[]) => void;
  engine: Engine;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  const comma = useDecimalComma();
  const [degrees, setDegrees] = useDegrees(standalone);
  const rows = useMemo(
    () => engine.runCalc(lines.map((l) => l.trim()).filter(Boolean), comma, { degrees }),
    [engine, lines, comma, degrees],
  );
  const pad = useKeypadTarget();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusNext, setFocusNext] = useState<number | null>(null);
  useEffect(() => {
    if (focusNext != null) {
      inputs.current[focusNext]?.focus();
      setFocusNext(null);
    }
  }, [focusNext, lines]);

  // Rows are matched to results by their position among the non-empty lines.
  let k = 0;
  const resultFor = lines.map((l) => (l.trim() ? rows[k++] : null));

  if (!editing) {
    // A reply's calculator, read like a worked solution.
    return (
      <div style={{ lineHeight: 1.9 }}>
        {lines.map((l, i) =>
          resultFor[i] ? (
            <div key={i}>
              <CalcResult row={resultFor[i]!} raw={l} theme={t} />
            </div>
          ) : null,
        )}
      </div>
    );
  }

  const setLine = (i: number, v: string) => onChange(lines.map((l, j) => (j === i ? v : l)));

  return (
    <>
      <Keypad calc onKey={pad.insert} theme={t} />
      <AngleSwitch degrees={degrees} onChange={setDegrees} theme={t} />
      <div style={{ display: "grid", gap: 10 }}>
        {lines.map((line, i) => (
          <div key={i}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={line}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label={`${tr("math.calc")} ${i + 1}`}
                {...pad.bind((v) => setLine(i, v))}
                onChange={(e) => setLine(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onChange([...lines.slice(0, i + 1), "", ...lines.slice(i + 1)]);
                    setFocusNext(i + 1);
                  } else if (e.key === "Backspace" && line === "" && lines.length > 1) {
                    e.preventDefault();
                    onChange(lines.filter((_, j) => j !== i));
                    setFocusNext(Math.max(0, i - 1));
                  }
                }}
                style={field(t)}
              />
              {lines.length > 1 && <RemoveButton theme={t} onClick={() => onChange(lines.filter((_, j) => j !== i))} />}
            </div>
            {/* The line typeset, under what was typed: a strip of its own, so a
                result is told from the next line's input at a glance. */}
            {resultFor[i] && (
              <div
                style={{
                  margin: "4px 0 0",
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: resultFor[i]!.error ? (t.dark ? "rgba(214,69,69,0.12)" : "rgba(214,69,69,0.06)") : t.cardBg2,
                  minHeight: "1.4em",
                  overflowX: "auto",
                }}
              >
                <CalcResult row={resultFor[i]!} raw={line} theme={t} />
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        style={{ ...button(t), marginTop: 10, width: "100%", padding: "7px 10px", borderStyle: "dashed", color: t.muted }}
        onClick={() => {
          onChange([...lines, ""]);
          setFocusNext(lines.length);
        }}
      >
        {tr("math.addLine")}
      </button>
    </>
  );
}

// ── Graph ─────────────────────────────────────────────────────────────────

/**
 * The drawing is laid out at the size it is actually shown at, not scaled from
 * a fixed one: scaled, a 480-wide plot in a phone's bubble shrinks its tick
 * labels to four pixels. Height is measured too, for the full-screen view,
 * where the graph takes whatever the screen has left.
 */
function useBox(): [(el: HTMLDivElement | null) => void, number, number] {
  // A callback ref, not a ref object: the full-screen layout swaps the plot's
  // container once it knows the screen's width, and an observer set up once on
  // mount would keep measuring the one that was thrown away.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 480, h: 0 });
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size.w, size.h];
}

/** True from 800px up — where the full-screen graph puts its editor beside the plot. */
function useWideScreen(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 800px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

function GraphEditor({ spec, onChange, theme: t }: { spec: GraphSpec; onChange: (s: GraphSpec) => void; theme: AppTheme }) {
  const tr = useTranslate();
  const pad = useKeypadTarget();
  const fnNames = spec.functions.map((f) => f.name);
  const setFn = (i: number, expr: string) =>
    onChange({ ...spec, functions: spec.functions.map((g, j) => (j === i ? { ...g, expr } : g)) });
  return (
    <div style={{ marginBottom: 10 }}>
      <Keypad calc={false} onKey={pad.insert} theme={t} />
      <div style={{ display: "grid", gap: 8 }}>
        {spec.functions.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: PALETTE[i % PALETTE.length], flex: "none" }} />
            <span style={{ fontStyle: "italic", fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>{f.name === "y" ? "y =" : `${f.name}(x) =`}</span>
            <input
              value={f.expr}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`${f.name}(x)`}
              {...pad.bind((v) => setFn(i, v))}
              onChange={(e) => setFn(i, e.target.value)}
              style={field(t)}
            />
            <RemoveButton
              theme={t}
              onClick={() =>
                // Its areas and tangents go with it: they would point at nothing.
                onChange({
                  ...spec,
                  functions: spec.functions.filter((_, j) => j !== i),
                  areas: spec.areas.filter((a) => a.f !== f.name && a.g !== f.name),
                  tangents: spec.tangents.filter((x) => x.f !== f.name),
                })
              }
            />
          </div>
        ))}
        {spec.points.map((p, i) => {
          const setPoint = (patch: Partial<typeof p>) =>
            onChange({ ...spec, points: spec.points.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
          return (
            <div key={`p${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, minWidth: 16 }}>{p.name}</span>
              <span>(</span>
              <input value={p.x} aria-label={`${p.name} x`} {...pad.bind((v) => setPoint({ x: v }))} onChange={(e) => setPoint({ x: e.target.value })} style={{ ...field(t), maxWidth: 90 }} />
              <span>;</span>
              <input value={p.y} aria-label={`${p.name} y`} {...pad.bind((v) => setPoint({ y: v }))} onChange={(e) => setPoint({ y: e.target.value })} style={{ ...field(t), maxWidth: 90 }} />
              <span>)</span>
              <RemoveButton theme={t} onClick={() => onChange({ ...spec, points: spec.points.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
        {spec.areas.map((ar, i) => {
          const setArea = (patch: Partial<typeof ar>) => onChange({ ...spec, areas: spec.areas.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
          return (
            <div key={`a${i}`} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: colourFor(spec, ar.f), opacity: 0.5, flex: "none" }} />
              <span style={{ fontSize: "0.9em" }}>{tr("math.area.label")}</span>
              <select aria-label={tr("math.area.label")} value={ar.f} onChange={(e) => setArea({ f: e.target.value })} style={{ ...field(t), flex: "none" }}>
                {fnNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.9em" }}>↔</span>
              <select
                aria-label={tr("math.area.and")}
                value={ar.g ?? ""}
                onChange={(e) => setArea({ g: e.target.value || null })}
                style={{ ...field(t), flex: "none" }}
              >
                <option value="">{tr("math.area.axis")}</option>
                {fnNames
                  .filter((n) => n !== ar.f)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
              <span style={{ fontSize: "0.9em" }}>{tr("math.area.from")}</span>
              <input value={ar.a} aria-label={tr("math.area.from")} {...pad.bind((v) => setArea({ a: v }))} onChange={(e) => setArea({ a: e.target.value })} style={{ ...field(t), maxWidth: 70 }} />
              <span style={{ fontSize: "0.9em" }}>{tr("math.area.to")}</span>
              <input value={ar.b} aria-label={tr("math.area.to")} {...pad.bind((v) => setArea({ b: v }))} onChange={(e) => setArea({ b: e.target.value })} style={{ ...field(t), maxWidth: 70 }} />
              <RemoveButton theme={t} onClick={() => onChange({ ...spec, areas: spec.areas.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
        {spec.tangents.map((tg, i) => {
          const setTangent = (patch: Partial<typeof tg>) =>
            onChange({ ...spec, tangents: spec.tangents.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
          return (
            <div key={`t${i}`} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span aria-hidden style={{ width: 14, borderTop: `2px dashed ${colourFor(spec, tg.f)}`, flex: "none" }} />
              <span style={{ fontSize: "0.9em" }}>{tr("math.tangent.label")}</span>
              <select aria-label={tr("math.tangent.label")} value={tg.f} onChange={(e) => setTangent({ f: e.target.value })} style={{ ...field(t), flex: "none" }}>
                {fnNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.9em" }}>{tr("math.tangent.at")}</span>
              <input value={tg.at} aria-label={tr("math.tangent.at")} {...pad.bind((v) => setTangent({ at: v }))} onChange={(e) => setTangent({ at: e.target.value })} style={{ ...field(t), maxWidth: 70 }} />
              <RemoveButton theme={t} onClick={() => onChange({ ...spec, tangents: spec.tangents.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {spec.functions.length < 6 && (
          <button type="button" style={button(t)} onClick={() => onChange({ ...spec, functions: [...spec.functions, { name: nextFunctionName(fnNames), expr: "" }] })}>
            {tr("math.addFunction")}
          </button>
        )}
        {spec.points.length < 12 && (
          <button
            type="button"
            style={button(t)}
            onClick={() => onChange({ ...spec, points: [...spec.points, { name: nextPointName(spec.points.map((p) => p.name)), x: "1", y: "1" }] })}
          >
            {tr("math.addPoint")}
          </button>
        )}
        {spec.functions.length > 0 && spec.areas.length < 3 && (
          <button type="button" style={button(t)} onClick={() => onChange({ ...spec, areas: [...spec.areas, { f: fnNames[0], g: null, a: "0", b: "1" }] })}>
            {tr("math.addArea")}
          </button>
        )}
        {spec.functions.length > 0 && spec.tangents.length < 3 && (
          <button type="button" style={button(t)} onClick={() => onChange({ ...spec, tangents: [...spec.tangents, { f: fnNames[0], at: "1" }] })}>
            {tr("math.addTangent")}
          </button>
        )}
      </div>
    </div>
  );
}

function GraphTool({
  spec,
  editing,
  full,
  onChange,
  engine,
  theme: t,
}: {
  spec: GraphSpec;
  editing: boolean;
  /** The dedicated full-screen view: editor beside the plot, plot as large as the screen allows. */
  full: boolean;
  onChange: (s: GraphSpec) => void;
  engine: Engine;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  const comma = useDecimalComma();
  const wideScreen = useWideScreen();
  // Several graphs can share a page; each clips to its own area.
  const clipId = `plot-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [box, boxW, boxH] = useBox();
  const W = Math.max(240, full ? boxW : Math.min(640, boxW));
  const H = full && boxH > 200 ? boxH : Math.round(W * 0.62);
  const [values, setValues] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(1);

  // Sliders: the ones the block declares, plus one for every other letter the
  // functions use — a student who types "a·x²" gets an `a` without asking.
  const sliders = useMemo(() => {
    const declared = spec.sliders;
    const auto = engine
      .graphParameters(spec)
      .filter((n) => !declared.some((s) => s.name === n))
      .map((name) => ({ name, value: 1, min: -10, max: 10 }));
    return [...declared, ...auto];
  }, [engine, spec]);

  // The window keeps the screen's proportions in full screen, so a circle is
  // not drawn as an egg on a wide monitor.
  const baseX = spec.x ?? (full && H > 0 ? [-10 * Math.max(1, W / H / 1.6), 10 * Math.max(1, W / H / 1.6)] : [-10, 10]);
  const cx = (baseX[0] + baseX[1]) / 2;
  const hx = ((baseX[1] - baseX[0]) / 2) * zoom;
  const xWin: [number, number] = [cx - hx, cx + hx];

  const sampled = useMemo(() => {
    const current = Object.fromEntries(sliders.map((s) => [s.name, values[s.name] ?? s.value]));
    return engine.sampleGraph({ ...spec, functions: spec.functions.filter((f) => f.expr.trim()) }, current, xWin, full ? 800 : 400);
    // xWin is derived from spec + zoom + size, all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, spec, sliders, values, zoom, full, W, H]);

  let yWin: [number, number];
  if (spec.y) {
    const cy = (spec.y[0] + spec.y[1]) / 2;
    const hy = ((spec.y[1] - spec.y[0]) / 2) * zoom;
    yWin = [cy - hy, cy + hy];
  } else {
    yWin = autoRange([...sampled.curves.flatMap((c) => c.points.map((p) => p[1])), ...sampled.points.map((p) => p.y)]);
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
  const xStep = niceStep(xWin[1] - xWin[0], full ? Math.max(8, Math.round(W / 90)) : 8);
  const yStep = niceStep(ySpan, full ? Math.max(6, Math.round(H / 70)) : 6);
  const ticks = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 && out.length < 60; v += step) {
      out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    }
    return out;
  };
  const fmt = (v: number) => {
    const s = String(Number(v.toPrecision(6))).replace("-", "−");
    return comma ? s.replace(".", ",") : s;
  };
  // The axes sit at zero when zero is in view, else along the nearest edge.
  const ax = Math.min(H, Math.max(0, sy(0)));
  const ay = Math.min(W, Math.max(0, sx(0)));
  const label = tr("math.graphOf", { list: spec.functions.map((f) => `${f.name}(x) = ${f.expr}`).join(", ") });
  const colourOf = (name: string) => colourFor(spec, name);
  const names = engine.graphNames(spec);
  const curveErrors = sampled.curves.filter((c) => c.error);

  // The zoom sits on the plot it zooms, in its corner, not on a row below it.
  const zoomControls = (
    <span style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
      {zoom !== 1 && (
        <button type="button" style={overlayButton(t)} onClick={() => setZoom(1)}>
          {tr("math.resetView")}
        </button>
      )}
      <button type="button" style={{ ...overlayButton(t), width: 30 }} aria-label={tr("math.zoomIn")} title={tr("math.zoomIn")} onClick={() => setZoom((z) => z / 2)}>
        +
      </button>
      <button type="button" style={{ ...overlayButton(t), width: 30 }} aria-label={tr("math.zoomOut")} title={tr("math.zoomOut")} onClick={() => setZoom((z) => z * 2)}>
        −
      </button>
    </span>
  );

  const plot = (
    <div
      ref={box}
      style={{
        position: "relative",
        borderRadius: 12,
        border: `1px solid ${t.cardBorder}`,
        background: t.dark ? "rgba(255,255,255,0.02)" : "#fff",
        overflow: "hidden",
        ...(full ? { flex: 1, minHeight: 280, minWidth: 0 } : {}),
      }}
    >
      {zoomControls}
      {W > 0 && H > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={full ? W : undefined} height={full ? H : undefined} role="img" aria-label={label} style={full ? { display: "block" } : { width: "100%", height: "auto", display: "block" }}>
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
          <g fontSize={full ? 13 : 11} fill={t.muted}>
            {ticks(xWin[0], xWin[1], xStep)
              .filter((v) => v !== 0)
              .map((v) => (
                <text key={`lx${v}`} x={sx(v) + 2} y={Math.min(H - 3, ax + 14)}>
                  {fmt(v)}
                </text>
              ))}
            {ticks(yWin[0], yWin[1], yStep)
              .filter((v) => v !== 0)
              .map((v) => (
                <text key={`ly${v}`} x={Math.min(W - 34, ay + 4)} y={sy(v) - 3}>
                  {fmt(v)}
                </text>
              ))}
          </g>
          <g clipPath={`url(#${clipId})`}>
            {/* Areas under the curves, so the curve stays drawn on top of its own shading. */}
            {sampled.areas.map((ar, i) =>
              ar.outline.length > 2 ? (
                <path
                  key={`area${i}`}
                  d={`${ar.outline.map(([x, y], k) => `${k ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join("")}Z`}
                  fill={colourOf(ar.f)}
                  fillOpacity={0.22}
                  stroke="none"
                />
              ) : null,
            )}
            {sampled.curves.map((c, i) => (
              <path key={c.name + i} d={path(c.points)} fill="none" stroke={colourOf(c.name)} strokeWidth={full ? 2.6 : 2.2} />
            ))}
            {sampled.tangents.map((tg, i) => (
              <g key={`tan${i}`}>
                <line
                  x1={sx(xWin[0])}
                  y1={sy(tg.slope * xWin[0] + tg.intercept)}
                  x2={sx(xWin[1])}
                  y2={sy(tg.slope * xWin[1] + tg.intercept)}
                  stroke={colourOf(tg.f)}
                  strokeWidth={full ? 1.8 : 1.5}
                  strokeDasharray="6 4"
                />
                <circle cx={sx(tg.x0)} cy={sy(tg.y0)} r={full ? 4.5 : 3.5} fill={colourOf(tg.f)} />
              </g>
            ))}
            {sampled.points.map((p) => (
              <g key={p.name}>
                <circle cx={sx(p.x)} cy={sy(p.y)} r={full ? 5 : 4} fill={t.text} />
                <text x={sx(p.x) + 7} y={sy(p.y) - 7} fontSize={full ? 15 : 13} fill={t.text} fontWeight={700}>
                  {p.name}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );

  const controls = (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 6, alignItems: "center" }}>
        {!editing &&
          spec.functions.map((f, i) => {
            const html = engine.functionHtml(f.name, f.expr, comma, names);
            return (
              <span key={f.name + i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: PALETTE[i % PALETTE.length] }} />
                {html ? <Tex html={html} /> : <span>{f.expr}</span>}
              </span>
            );
          })}
      </div>

      {/* The numbers the shading and the dashed lines stand for. */}
      {(sampled.areas.length > 0 || sampled.tangents.length > 0) && (
        <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
          {sampled.areas.map((ar, i) => (
            <span key={`al${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: colourOf(ar.f), opacity: 0.45, flex: "none" }} />
              <Tex html={engine.areaHtml(ar, comma)} />
            </span>
          ))}
          {sampled.tangents.map((tg, i) => (
            <span key={`tl${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ width: 14, borderTop: `2px dashed ${colourOf(tg.f)}`, flex: "none" }} />
              <span style={{ fontSize: "0.9em", color: t.muted }}>
                {tr("math.tangent.label")} {tg.f} ({tr("math.tangent.at")} {fmt(tg.x0)})
              </span>
              <Tex html={engine.tangentHtml(tg, comma)} />
            </span>
          ))}
        </div>
      )}
      {(sampled.areas.length < spec.areas.length || sampled.tangents.length < spec.tangents.length) && (
        <div style={{ marginTop: 6, fontSize: "0.85em", color: ERROR }}>{tr("math.area.cant")}</div>
      )}

      {sliders.map((s) => {
        const v = values[s.name] ?? s.value;
        return (
          <label key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ minWidth: 64, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
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

      {curveErrors.map((c) => (
        <div key={c.name} style={{ marginTop: 6, fontSize: "0.85em", color: ERROR }}>
          {c.name === "y" ? "y" : `${c.name}(x)`} : {tr("math.cantRead")}
        </div>
      ))}
    </>
  );

  if (full) {
    // A dedicated screen: on a wide one the editor is a column beside the plot;
    // on a phone the plot comes first and the editor scrolls under it.
    return wideScreen ? (
      <div style={{ display: "flex", gap: 20, height: "100%", minHeight: 0 }}>
        <div style={{ width: 380, flex: "none", overflowY: "auto", paddingRight: 4 }}>
          {editing && <GraphEditor spec={spec} onChange={onChange} theme={t} />}
          {controls}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex" }}>{plot}</div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowY: "auto" }}>
        <div style={{ height: "55vh", flex: "none", display: "flex" }}>{plot}</div>
        {controls}
        <div style={{ marginTop: 12 }}>{editing && <GraphEditor spec={spec} onChange={onChange} theme={t} />}</div>
      </div>
    );
  }

  return (
    <>
      {editing && <GraphEditor spec={spec} onChange={onChange} theme={t} />}
      {plot}
      {controls}
    </>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────

function LineErrors({ errors }: { errors: LineError[] }) {
  const tr = useTranslate();
  if (!errors.length) return null;
  return (
    <div style={{ marginTop: 6, fontSize: "0.82em", color: ERROR }}>
      {errors.map((e, i) => (
        <div key={i}>{tr("math.lineError", { line: e.line, text: e.text })}</div>
      ))}
    </div>
  );
}

/**
 * Where a tool is shown:
 *  - `inline`: a block inside a Raya reply — read-only until "Edit";
 *  - `panel`: the Maths panel on the right — editor open, compact;
 *  - `full`: the dedicated full-screen view — editor open, as large as the screen.
 */
type Mode = "inline" | "panel" | "full";

/**
 * A standalone use of the tool (the Maths panel) rather than a block in a
 * reply: `start` is what the learner left last time, and every change is
 * reported so the panel can keep it.
 */
export type Bench = { start: string; note: string; onChange: (src: string) => void };

function HeaderButton({ onClick, label, children, theme: t }: { onClick: () => void; label: string; children: ReactNode; theme: AppTheme }) {
  return (
    <button type="button" style={button(t)} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function LoadedTool({
  lang,
  src,
  start,
  mode,
  standalone = false,
  note,
  onChange,
  onFullscreen,
  onOpenInPanel,
  engine,
  theme: t,
}: {
  lang: MathBlockLang;
  /** The original — Raya's block or the panel's example. Reset goes back to it. */
  src: string;
  /** What to show now (the learner's last version). */
  start: string;
  mode: Mode;
  /** The learner's own tool (the Maths panel), not a block in a reply. */
  standalone?: boolean;
  note?: string;
  onChange: (src: string) => void;
  onFullscreen?: () => void;
  onOpenInPanel?: () => void;
  engine: Engine;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  const [editing, setEditing] = useState(mode !== "inline");
  const [spec, setSpec] = useState(() => parseGraph(start));
  const [lines, setLines] = useState(() => {
    const l = parseCalc(start).lines;
    return l.length ? l : [""];
  });
  // Lines of the ORIGINAL block that could not be read — the editor never
  // produces one, so these only come from what Raya wrote.
  const sourceErrors = useMemo(() => (lang === "graph" ? parseGraph(src).errors : []), [lang, src]);

  const changed =
    lang === "graph"
      ? graphToSource(spec) !== graphToSource(parseGraph(src))
      : lines.filter((l) => l.trim()).join("\n") !== parseCalc(src).lines.join("\n");
  const reset = () => {
    setSpec(parseGraph(src));
    const l = parseCalc(src).lines;
    setLines(l.length ? l : [""]);
    onChange(src);
  };

  const full = mode === "full";
  const body =
    lang === "graph" ? (
      <GraphTool
        spec={spec}
        editing={editing}
        full={full}
        engine={engine}
        theme={t}
        onChange={(s) => {
          setSpec(s);
          onChange(graphToSource(s));
        }}
      />
    ) : (
      <CalcTool
        lines={lines}
        editing={editing}
        standalone={standalone}
        engine={engine}
        theme={t}
        onChange={(l) => {
          setLines(l);
          onChange(l.join("\n"));
        }}
      />
    );

  const toolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
      {!full && <strong style={{ fontSize: "0.85em", flex: 1, opacity: 0.8 }}>{tr(lang === "graph" ? "math.graph" : "math.calc")}</strong>}
      {full && <span style={{ flex: 1 }} />}
      {changed && (
        <button type="button" style={button(t)} onClick={reset}>
          {tr("math.reset")}
        </button>
      )}
      {mode === "inline" && (
        <button type="button" style={button(t)} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          {editing ? tr("math.done") : tr("math.edit")}
        </button>
      )}
      {onOpenInPanel && (
        <HeaderButton theme={t} label={tr("math.openInPanel")} onClick={onOpenInPanel}>
          ⇥
        </HeaderButton>
      )}
      {onFullscreen && (
        <HeaderButton theme={t} label={tr("math.fullscreen")} onClick={onFullscreen}>
          ⛶
        </HeaderButton>
      )}
    </div>
  );

  if (full) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontSize: lang === "calc" ? 18 : 16 }}>
        {toolbar}
        <div style={{ fontSize: "0.82em", color: t.muted, marginBottom: 6 }}>{tr(lang === "graph" ? "math.graphHint" : "math.writeHint")}</div>
        <div style={lang === "graph" ? { flex: 1, minHeight: 0 } : { flex: 1, minHeight: 0, overflowY: "auto", width: "100%", maxWidth: 820, margin: "0 auto" }}>{body}</div>
        {!changed && <LineErrors errors={sourceErrors} />}
      </div>
    );
  }

  if (mode === "panel") {
    // The panel is already the frame, and its tabs already name the tool: no
    // card inside the card, no second "Calculator" heading — the hint, the
    // actions on its right, then the tool.
    return (
      <div style={{ color: t.text }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: "0.86em", color: t.muted, lineHeight: 1.4 }}>{tr(lang === "graph" ? "math.graphHint" : "math.writeHint")}</div>
          {changed && (
            <button type="button" style={{ ...button(t), flex: "none" }} onClick={reset}>
              {tr("math.reset")}
            </button>
          )}
          {onFullscreen && (
            <HeaderButton theme={t} label={tr("math.fullscreen")} onClick={onFullscreen}>
              ⛶
            </HeaderButton>
          )}
        </div>
        {body}
        {!changed && <LineErrors errors={sourceErrors} />}
        {note && <div style={{ fontSize: "0.78em", color: t.muted, marginTop: 12 }}>{note}</div>}
      </div>
    );
  }

  return (
    <div style={frame(t)}>
      {toolbar}
      {editing && <div style={{ fontSize: "0.82em", color: t.muted, marginBottom: 2 }}>{tr(lang === "graph" ? "math.graphHint" : "math.writeHint")}</div>}
      {body}
      {!changed && <LineErrors errors={sourceErrors} />}
      {note && <div style={{ fontSize: "0.78em", color: t.muted, marginTop: 10 }}>{note}</div>}
    </div>
  );
}

/**
 * The dedicated full-screen view of a tool. Portalled to <body>: on a phone the
 * Maths panel is a drawer moved with a CSS transform, and `position: fixed`
 * inside a transformed parent is fixed to the parent, not the screen.
 *
 * Getting out is never more than one move away: the labelled button in the
 * corner, or Escape.
 */
function MathFullscreen({ lang, children, onExit, theme: t }: { lang: MathBlockLang; children: ReactNode; onExit: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onExit]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang === "graph" ? "math.graph" : "math.calc")}
      className={t.dark ? "chat-welcome-bg is-dark" : "chat-welcome-bg"}
      style={{ position: "fixed", inset: 0, zIndex: 70, color: t.text, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          background: t.cardBg,
          borderBottom: `1px solid ${t.cardBorder}`,
        }}
      >
        <strong style={{ flex: 1, fontSize: 17 }}>{tr(lang === "graph" ? "math.graph" : "math.calc")}</strong>
        <span className="math-esc-hint" style={{ fontSize: 13, color: t.muted }}>
          {tr("math.escHint")}
        </span>
        <button
          type="button"
          onClick={onExit}
          autoFocus
          style={{ ...button(t), display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", fontSize: 15, fontWeight: 600, background: t.cardBg2 }}
        >
          <span aria-hidden>✕</span>
          {tr("math.exitFullscreen")}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "16px 18px", boxSizing: "border-box" }}>{children}</div>
    </div>,
    document.body,
  );
}

function Loading({ text, theme: t }: { text: string; theme: AppTheme }) {
  return <div style={{ ...frame(t), fontSize: "0.85em", color: t.muted }}>{text}</div>;
}

/**
 * One tool, wherever it is shown. Owns the learner's current version so the
 * inline/panel view and the full-screen view are the same work: what is typed
 * in full screen is there when they come back out.
 */
function WithEngine({ lang, src, bench, mode, theme: t }: { lang: MathBlockLang; src: string; bench?: Bench; mode: Mode; theme: AppTheme }) {
  const tr = useTranslate();
  const engine = useEngine();
  const dock = useMathsDock();
  const [current, setCurrent] = useState(bench?.start ?? src);
  const [full, setFull] = useState(false);
  // Bumped on the way out of full screen so the inline view re-reads `current`.
  const [version, setVersion] = useState(0);

  if (engine === "failed") {
    // The source is still worth showing: it is readable maths on its own.
    return (
      <div style={frame(t)}>
        <div style={{ fontSize: "0.82em", color: t.muted, marginBottom: 6 }}>{tr("math.loadFailed")}</div>
        <pre style={{ margin: 0, fontSize: "0.9em", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{src}</pre>
      </div>
    );
  }
  if (engine === "loading") return <Loading text={tr("math.loading")} theme={t} />;

  const change = (next: string) => {
    setCurrent(next);
    bench?.onChange(next);
  };
  const exitFull = () => {
    setFull(false);
    setVersion((v) => v + 1);
  };

  return (
    <>
      <LoadedTool
        key={version}
        lang={lang}
        src={src}
        start={current}
        mode={mode}
        standalone={Boolean(bench)}
        note={bench?.note}
        onChange={change}
        onFullscreen={() => setFull(true)}
        // From a reply into the panel, where it can be kept and worked on.
        onOpenInPanel={mode === "inline" && dock ? () => dock.open(lang, current) : undefined}
        engine={engine}
        theme={t}
      />
      {full && (
        <MathFullscreen lang={lang} onExit={exitFull} theme={t}>
          <LoadedTool lang={lang} src={src} start={current} mode="full" standalone={Boolean(bench)} onChange={change} engine={engine} theme={t} />
        </MathFullscreen>
      )}
    </>
  );
}

/**
 * A maths block inside a reply. `open` while the closing fence has not
 * streamed in yet: a half-written function is not worth plotting.
 */
export function MathBlock({ lang, src, open, theme }: { lang: MathBlockLang; src: string; open?: boolean; theme: AppTheme }): ReactNode {
  const tr = useTranslate();
  if (open) return <Loading text={tr("math.preparing")} theme={theme} />;
  return <WithEngine lang={lang} src={src} mode="inline" theme={theme} />;
}

/** The same tool outside a reply — the Maths panel. See `Bench`. */
export function MathBench({ lang, example, bench, theme }: { lang: MathBlockLang; example: string; bench: Bench; theme: AppTheme }) {
  return <WithEngine lang={lang} src={example} bench={bench} mode="panel" theme={theme} />;
}
