/**
 * The two interactive blocks Raya can write — ```graph and ```calc — read from
 * their source text.
 *
 * Pure and dependency-free on purpose: this is the part that decides what a
 * block MEANS, and it runs on every streamed chunk, so it must be cheap and
 * testable without a browser. Evaluating the expressions is math.js's job, in
 * lib/math-engine.ts, loaded only once a block is actually on screen.
 *
 * Strict rather than clever: a line it does not recognise becomes an error the
 * learner can see and fix in the editor, never a guess. The syntax is the one
 * the prompt teaches (MATH_TOOLS in lib/raya/prompt.ts).
 */

export const MATH_BLOCK_LANGS = ["graph", "calc"] as const;
export type MathBlockLang = (typeof MATH_BLOCK_LANGS)[number];

export function isMathBlockLang(lang: string | null): lang is MathBlockLang {
  return lang === "graph" || lang === "calc";
}

const MAX_LINES = 40;
const MAX_LINE = 300;
const MAX_FUNCTIONS = 6;
const MAX_SLIDERS = 8;
const MAX_POINTS = 12;

export type LineError = { line: number; text: string };

export type GraphSpec = {
  functions: { name: string; expr: string }[];
  /** Sliders: a number the learner can drag between min and max. */
  sliders: { name: string; value: number; min: number; max: number }[];
  /** Fixed values, in order (`k = 2`, `m = a + 1`). */
  constants: { name: string; expr: string }[];
  points: { name: string; x: string; y: string }[];
  x: [number, number] | null;
  y: [number, number] | null;
  errors: LineError[];
};

const NUM = "(-?\\d+(?:\\.\\d+)?)";
const NAME = "([A-Za-z][A-Za-z0-9_]*)";
const RANGE = new RegExp(`^([xy])\\s*:\\s*${NUM}\\s*\\.\\.\\s*${NUM}$`);
const SLIDER = new RegExp(`^${NAME}\\s*=\\s*${NUM}\\s*\\(\\s*${NUM}\\s*\\.\\.\\s*${NUM}\\s*\\)$`);
const FUNC = new RegExp(`^${NAME}\\s*\\(\\s*x\\s*\\)\\s*=\\s*(.+)$`);
const Y_EQ = /^y\s*=\s*(.+)$/;
const POINT = new RegExp(`^${NAME}\\s*=\\s*\\(\\s*([^,()]+(?:\\([^()]*\\)[^,()]*)*)\\s*,\\s*(.+)\\s*\\)$`);
const CONST = new RegExp(`^${NAME}\\s*=\\s*(.+)$`);

/** The lines that carry something: trimmed, comments and blanks dropped, capped. */
function meaningful(src: string): { n: number; text: string }[] {
  return src
    .split(/\r?\n/)
    .map((text, i) => ({ n: i + 1, text: text.trim() }))
    .filter((l) => l.text && !l.text.startsWith("#") && !l.text.startsWith("//"))
    .slice(0, MAX_LINES);
}

/** A window from two numbers, in order, never empty. */
function span2(a: number, b: number): [number, number] | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return a < b ? [a, b] : [b, a];
}

export function parseGraph(src: string): GraphSpec {
  const spec: GraphSpec = { functions: [], sliders: [], constants: [], points: [], x: null, y: null, errors: [] };
  for (const { n, text } of meaningful(src)) {
    if (text.length > MAX_LINE) {
      spec.errors.push({ line: n, text });
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = RANGE.exec(text))) {
      const w = span2(Number(m[2]), Number(m[3]));
      if (!w) spec.errors.push({ line: n, text });
      else if (m[1] === "x") spec.x = w;
      else spec.y = w;
    } else if ((m = SLIDER.exec(text))) {
      const range = span2(Number(m[3]), Number(m[4]));
      if (!range || spec.sliders.length >= MAX_SLIDERS) {
        spec.errors.push({ line: n, text });
        continue;
      }
      const value = Math.min(range[1], Math.max(range[0], Number(m[2])));
      spec.sliders.push({ name: m[1], value, min: range[0], max: range[1] });
    } else if ((m = FUNC.exec(text)) || (m = Y_EQ.exec(text))) {
      if (spec.functions.length >= MAX_FUNCTIONS) {
        spec.errors.push({ line: n, text });
        continue;
      }
      const [name, expr] = m.length === 3 ? [m[1], m[2]] : ["y", m[1]];
      spec.functions.push({ name, expr: expr.trim() });
    } else if ((m = POINT.exec(text)) && /^[A-Z]/.test(m[1])) {
      // Capitalised names are points ("A = (1, 2)"), as on a blackboard; a
      // lower-case name with a pair is a constant mistake worth flagging.
      if (spec.points.length >= MAX_POINTS) {
        spec.errors.push({ line: n, text });
        continue;
      }
      spec.points.push({ name: m[1], x: m[2].trim(), y: m[3].trim() });
    } else if ((m = CONST.exec(text)) && m[1] !== "x" && m[1] !== "y") {
      spec.constants.push({ name: m[1], expr: m[2].trim() });
    } else {
      spec.errors.push({ line: n, text });
    }
  }
  return spec;
}

/** The calculator's lines, in order. Evaluation keeps a shared scope across them. */
export function parseCalc(src: string): { lines: string[]; errors: LineError[] } {
  const lines: string[] = [];
  const errors: LineError[] = [];
  for (const { n, text } of meaningful(src)) {
    if (text.length > MAX_LINE) errors.push({ line: n, text });
    else lines.push(text);
  }
  return { lines, errors };
}

/**
 * Round a span to a "nice" tick step: 1, 2 or 5 times a power of ten, giving
 * roughly `target` ticks across it.
 */
export function niceStep(span: number, target = 8): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/**
 * A y-window for sampled values when the block did not give one: the bulk of
 * the finite values (so an asymptote does not flatten everything else), padded,
 * and never a zero-height band.
 */
export function autoRange(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return [-5, 5];
  const at = (q: number) => finite[Math.min(finite.length - 1, Math.max(0, Math.round(q * (finite.length - 1))))];
  let lo = at(0.02);
  let hi = at(0.98);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}
