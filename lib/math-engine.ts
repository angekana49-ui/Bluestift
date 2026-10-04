import { all, create, type MathNode } from "mathjs";
import { renderMathHtml } from "@/lib/katex-render";
import type { GraphSpec } from "@/lib/math-blocks";
import { normalizeMath, readLine, type MathLine } from "@/lib/math-input";

/**
 * math.js and KaTeX, set up for the graph and calculator tools.
 *
 * Imported ONLY through a dynamic `import()` in components/chat/math-tools.tsx,
 * so this weight is paid by a learner who actually has a tool on screen and by
 * nobody else.
 *
 * What the learner writes is read by lib/math-input.ts (x², √, 3,5, "dérivée
 * de …", "2x + 3 = 7"); what they get back is typeset with KaTeX, the way a
 * textbook prints it — never math.js's own `3 * x ^ 2 + 2`.
 *
 * The expressions are untrusted (they can come from model output, and through
 * it from an uploaded document). math.js's parser is sandboxed by design; on
 * top of that, the functions that would CHANGE the shared instance — `import`,
 * `createUnit`, `reviver` — are switched off, so one tool cannot redefine
 * what `sin` means for the next. `parse`/`simplify`/`derivative` stay: they
 * are what makes this a stand-in for a CAS.
 */
const math = create(all);
const off = (name: string) =>
  function disabled() {
    throw new Error(`${name} is not available here`);
  };
math.import({ import: off("import"), createUnit: off("createUnit"), reviver: off("reviver") }, { override: true });

// ── Typesetting ───────────────────────────────────────────────────────────

const TEX = { parenthesis: "auto", implicit: "hide" } as const;

function texOfNode(node: MathNode): string {
  return (
    node
      .toTex(TEX)
      // math.js writes an assignment as `:=`; at school it is `=`.
      .replace(/:=/g, "=")
      // …and 3·x² where a textbook writes 3x² (a number before a letter, a root,
      // a bracket). Between two numbers the dot stays: 3·4 is a product to read.
      .replace(/(\d)\s*\\cdot\s*(?=\{?\s*[a-zA-Z\\(])/g, "$1")
      // An implicit product is set with a space (`2~x`): a textbook writes 2x.
      .replace(/(\d)\s*~\s*(?=\{?\s*[a-zA-Z\\(])/g, "$1")
  );
}

function texOf(src: string): string {
  return texOfNode(math.parse(src));
}

/**
 * KaTeX HTML for a LaTeX string (never throws — see lib/katex-render.ts).
 * `comma`: the reader writes 3,5, not 3.5 (French, Spanish, German) — shown
 * the way they write it; `{,}` keeps KaTeX from spacing it like a list comma.
 */
export function html(tex: string, comma = false): string {
  return renderMathHtml(comma ? tex.replace(/(\d)\.(\d)/g, "$1{,}$2") : tex, false);
}

/** A number as a student reads it: 12, 0.75, 1/3 ≈ 0.3333, never 0.30000000000000004. */
function numberTex(v: number): { tex: string; text: string } {
  if (Number.isInteger(v) || !Number.isFinite(v)) return { tex: String(v), text: String(v) };
  const dec = String(Number(v.toPrecision(10)));
  for (let d = 2; d <= 100; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9) {
      // A simple fraction says more than its decimals (1/3, -5/4).
      // …but a short decimal says it better still (0.75, not 3/4 ≈ 0.75).
      if (dec.replace("-", "").length <= 6) return { tex: dec, text: dec };
      const sign = n < 0 ? "-" : "";
      return { tex: `${sign}\\frac{${Math.abs(n)}}{${d}} \\approx ${Number(v.toPrecision(6))}`, text: `${n}/${d}` };
    }
  }
  return { tex: dec, text: dec };
}

function valueTex(value: unknown): { tex: string; text: string } | null {
  if (value === undefined) return null;
  if (typeof value === "number") return numberTex(value);
  if (typeof value === "function") {
    // `f(x) = x²` evaluates to the function itself: its definition is the answer.
    const syntax = (value as { syntax?: string }).syntax;
    return syntax ? { tex: "\\checkmark", text: syntax } : null;
  }
  if (value && typeof value === "object" && "toTex" in value && typeof (value as MathNode).toTex === "function") {
    return { tex: texOfNode(value as MathNode), text: String(value) };
  }
  const text = math.format(value, { precision: 10 });
  try {
    return { tex: texOf(text), text };
  } catch {
    return { tex: `\\text{${text.replace(/[\\{}$&#^_%~]/g, "")}}`, text };
  }
}

const htmlOf = html;

// ── Symbols ───────────────────────────────────────────────────────────────

/** Letters in an expression that are neither math.js's (pi, sin) nor known here. */
function freeSymbols(node: MathNode, known: Set<string>): string[] {
  const out: string[] = [];
  node.traverse((n, _path, parent) => {
    const sym = n as MathNode & { isSymbolNode?: boolean; name?: string };
    if (!sym.isSymbolNode || !sym.name) return;
    const asCallee = parent && (parent as { isFunctionNode?: boolean; fn?: MathNode }).isFunctionNode && (parent as { fn?: MathNode }).fn === n;
    if (asCallee) return;
    const name = sym.name;
    if (known.has(name) || (math as unknown as Record<string, unknown>)[name] !== undefined) return;
    if (!out.includes(name)) out.push(name);
  });
  return out;
}

/** The variable a derivative or an equation is about: x when there is one. */
function variableOf(src: string, scope: Map<string, unknown>): string {
  try {
    const free = freeSymbols(math.parse(src), new Set(scope.keys()));
    return free.includes("x") ? "x" : free[0] ?? "x";
  } catch {
    return "x";
  }
}

// ── Solving ───────────────────────────────────────────────────────────────

export type Solution =
  | { kind: "roots"; roots: number[]; approx: boolean }
  | { kind: "none" }
  | { kind: "all" };

/**
 * Solve lhs = rhs for v. Exact for polynomials up to degree 2 (what most of
 * school is), numerically elsewhere — scanned across [-100, 100] and refined by
 * bisection, and flagged as approximate.
 */
export function solveEquation(lhs: string, rhs: string, v: string, scope: Map<string, unknown>): Solution {
  const diff = `(${lhs}) - (${rhs})`;
  const numbers = Object.fromEntries([...scope].filter(([, x]) => typeof x === "number")) as Record<string, number>;
  try {
    const r = math.rationalize(diff, numbers, true) as unknown as { coefficients: number[]; variables: string[] };
    const c = r.coefficients;
    if (r.variables.length <= 1 && c.length <= 3) {
      const [c0 = 0, c1 = 0, c2 = 0] = c;
      if (c2 !== 0) {
        const disc = c1 * c1 - 4 * c2 * c0;
        if (disc < 0) return { kind: "none" };
        const s = Math.sqrt(disc);
        const roots = [...new Set([(-c1 - s) / (2 * c2), (-c1 + s) / (2 * c2)])].sort((a, b) => a - b);
        return { kind: "roots", roots, approx: false };
      }
      if (c1 !== 0) return { kind: "roots", roots: [-c0 / c1], approx: false };
      return c0 === 0 ? { kind: "all" } : { kind: "none" };
    }
  } catch {
    // not a polynomial (sin, ln, …): numerical below
  }

  const code = math.compile(diff);
  const f = (x: number) => {
    const s = new Map(scope);
    s.set(v, x);
    const y = code.evaluate(s);
    return typeof y === "number" ? y : NaN;
  };
  const roots: number[] = [];
  const add = (x: number) => {
    if (roots.length < 8 && !roots.some((r) => Math.abs(r - x) < 1e-6)) roots.push(Number(x.toPrecision(10)));
  };
  const N = 4000;
  let px = -100;
  let py = f(px);
  for (let i = 1; i <= N; i++) {
    const x = -100 + (200 * i) / N;
    const y = f(x);
    if (Math.abs(y) < 1e-12) add(x);
    else if (Number.isFinite(py) && Number.isFinite(y) && py * y < 0) {
      let a = px;
      let b = x;
      let fa = py;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fa * fm <= 0) b = m;
        else {
          a = m;
          fa = fm;
        }
      }
      const root = (a + b) / 2;
      // A sign change across a pole (tan, 1/x) is not a root.
      if (Math.abs(f(root)) < 1e-6) add(root);
    }
    px = x;
    py = y;
  }
  return roots.length ? { kind: "roots", roots: roots.sort((a, b) => a - b), approx: true } : { kind: "none" };
}

// ── Calculator ────────────────────────────────────────────────────────────

export type CalcRow = {
  /** What the learner wrote, typeset (KaTeX HTML); empty when it cannot be read. */
  inputHtml: string;
  /** The answer, typeset; and as plain text for tests and screen readers. */
  resultHtml?: string;
  result?: string;
  /** For the UI to word in the learner's language. */
  note?: "noSolution" | "everyValue" | "approx";
  error?: string;
};

function rowFor(line: MathLine, scope: Map<string, unknown>, comma: boolean): CalcRow {
  const html = (tex: string) => htmlOf(tex, comma);
  switch (line.kind) {
    case "derivative": {
      const v = line.v ?? variableOf(line.inner, scope);
      const d = math.derivative(line.inner, v);
      const tex = texOfNode(d);
      return {
        inputHtml: html(`\\frac{d}{d${v}}\\left(${texOf(line.inner)}\\right)`),
        resultHtml: html(tex),
        result: d.toString(),
      };
    }
    case "simplify": {
      const s = math.simplify(line.inner);
      return { inputHtml: html(texOf(line.inner)), resultHtml: html(texOfNode(s)), result: s.toString() };
    }
    case "solve": {
      const v = variableOf(`(${line.lhs}) - (${line.rhs})`, scope);
      const inputHtml = html(`${texOf(line.lhs)} = ${texOf(line.rhs)}`);
      const sol = solveEquation(line.lhs, line.rhs, v, scope);
      if (sol.kind === "none") return { inputHtml, note: "noSolution", result: "none" };
      if (sol.kind === "all") return { inputHtml, note: "everyValue", result: "all" };
      const parts = sol.roots.map((r, i) => {
        const n = numberTex(r);
        const name = sol.roots.length > 1 ? `${v}_{${i + 1}}` : v;
        return { tex: `${name} ${sol.approx ? "\\approx" : "="} ${n.tex}`, text: `${v}=${n.text}` };
      });
      return {
        inputHtml,
        resultHtml: html(parts.map((p) => p.tex).join(",\\quad ")),
        result: parts.map((p) => p.text).join(", "),
        ...(sol.approx ? { note: "approx" as const } : {}),
      };
    }
    case "expr": {
      const inputHtml = html(texOf(line.src));
      const out = valueTex(math.evaluate(line.src, scope));
      return out ? { inputHtml, resultHtml: html(out.tex), result: out.text } : { inputHtml };
    }
  }
}

/** Evaluate the lines in order, sharing one scope, as a worksheet would. */
export function runCalc(lines: string[], comma = false): CalcRow[] {
  const scope = new Map<string, unknown>();
  return lines.map((raw) => {
    const line = readLine(raw);
    try {
      return rowFor(line, scope, comma);
    } catch (e) {
      let inputHtml = "";
      try {
        inputHtml = line.kind === "expr" ? html(texOf(line.src), comma) : "";
      } catch {
        // unreadable: the UI shows the raw text instead
      }
      return { inputHtml, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

// ── Graph ─────────────────────────────────────────────────────────────────

/** Typeset one function for the legend: f(x) = x² − 3. */
export function functionHtml(name: string, expr: string, comma = false): string {
  try {
    return html(`${name === "y" ? "y" : `${name}(x)`} = ${texOf(normalizeMath(expr))}`, comma);
  } catch {
    return "";
  }
}

/**
 * The parameters a graph needs sliders for: letters the functions use that are
 * not x, not defined in the block, and not math.js's own (pi, e). A student
 * who types "a·x² + b" gets an `a` and a `b` to drag, without declaring them.
 */
export function graphParameters(spec: GraphSpec): string[] {
  const known = new Set<string>(["x", ...spec.functions.map((f) => f.name), ...spec.sliders.map((s) => s.name), ...spec.constants.map((c) => c.name)]);
  const out: string[] = [];
  const exprs = [...spec.functions.map((f) => f.expr), ...spec.constants.map((c) => c.expr), ...spec.points.flatMap((p) => [p.x, p.y])];
  for (const e of exprs) {
    try {
      for (const name of freeSymbols(math.parse(normalizeMath(e)), known)) if (!out.includes(name)) out.push(name);
    } catch {
      // an unreadable function shows its own error
    }
  }
  return out;
}

export type Sampled = {
  curves: { name: string; expr: string; points: [number, number][]; error?: string }[];
  points: { name: string; x: number; y: number }[];
  errors: string[];
};

/**
 * Sample every function across the x-window for the current slider values.
 * Complex and undefined results are NaN — a gap in the curve, which is what
 * √x left of zero should look like.
 */
export function sampleGraph(
  spec: GraphSpec,
  sliders: Record<string, number>,
  [x0, x1]: [number, number],
  samples = 400,
): Sampled {
  const scope = new Map<string, unknown>(Object.entries(sliders));
  const errors: string[] = [];
  for (const c of spec.constants) {
    try {
      scope.set(c.name, math.evaluate(normalizeMath(c.expr), scope));
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);

  const curves = spec.functions.map((f) => {
    try {
      const code = math.compile(normalizeMath(f.expr));
      const pts: [number, number][] = [];
      for (let i = 0; i <= samples; i++) {
        const x = x0 + ((x1 - x0) * i) / samples;
        scope.set("x", x);
        let y = NaN;
        try {
          y = num(code.evaluate(scope));
        } catch {
          // a domain error at one x is a gap, not a broken curve
        }
        pts.push([x, y]);
      }
      // Other functions may refer to this one by name: g(x) = f(x) + 1.
      scope.delete("x");
      scope.set(f.name, (x: number) => {
        const s = new Map(scope);
        s.set("x", x);
        return num(code.evaluate(s));
      });
      return { name: f.name, expr: f.expr, points: pts };
    } catch (e) {
      return { name: f.name, expr: f.expr, points: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const points = spec.points.flatMap((p) => {
    try {
      const x = num(math.evaluate(normalizeMath(p.x), scope));
      const y = num(math.evaluate(normalizeMath(p.y), scope));
      return Number.isFinite(x) && Number.isFinite(y) ? [{ name: p.name, x, y }] : [];
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  });

  return { curves, points, errors };
}
