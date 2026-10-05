import { all, create, type MathNode } from "mathjs";
import { renderMathHtml } from "@/lib/katex-render";
import type { GraphSpec } from "@/lib/math-blocks";
import { definedName, limitTarget, normalizeMath, readLine, type MathLine, type NormalizeOptions } from "@/lib/math-input";

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

/** The way a French, Spanish or German textbook names the inverse functions. */
const SCHOOL_NAMES: Record<string, string> = { asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan" };

type TexOptions = { parenthesis: "auto"; implicit: "hide"; handler: (node: MathNode, options: object) => string | undefined };

const TEX: TexOptions = {
  parenthesis: "auto",
  implicit: "hide",
  handler(node, options) {
    const n = node as MathNode & { name?: string; fn?: { name?: string }; args?: MathNode[] };
    // A one-letter variable is a variable, never the unit math.js has by that
    // name (b is a bit, g a gram): set in italics like any other.
    if (n.type === "SymbolNode" && n.name && /^[A-Za-z]$/.test(n.name)) return n.name;
    if (n.type === "FunctionNode" && n.fn?.name && n.args?.length === 1) {
      const arg = n.args[0].toTex(options);
      if (SCHOOL_NAMES[n.fn.name]) return `${SCHOOL_NAMES[n.fn.name]}\\left(${arg}\\right)`;
      // exp(x) is written eˣ at school.
      if (n.fn.name === "exp") return `e^{${arg}}`;
    }
    return undefined;
  },
};

function texOfNode(node: MathNode): string {
  return (
    node
      .toTex(TEX)
      // math.js writes an assignment as `:=`; at school it is `=`.
      .replace(/:=/g, "=")
      // …and 3·x² where a textbook writes 3x² (a number or a fraction before a
      // letter, a root, a bracket). Between two numbers the dot stays: 3·4 is a
      // product to read.
      .replace(/([\d}])\s*\\cdot\s*(?=\{?\s*[a-zA-Z\\(])(?!\\frac)/g, "$1")
      // x·(x + 1) is x(x + 1) in a book.
      .replace(/([a-zA-Z])\s*\\cdot\s*(?=\\left\()/g, "$1")
      // An implicit product is set with a `~`: a textbook writes 2x and ax.
      .replace(/~/g, " ")
      // simplify writes x^{3/2}·2 over 3; a textbook puts the number first: ⅔x^{3/2}.
      .replace(/\\frac\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)\\cdot(\d+)\}\{(\d+)\}/g, "\\frac{$2}{$3}$1")
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

/**
 * A number as a student reads it: 12, 0.75, 1/3 ≈ 0.3333, never
 * 0.30000000000000004, and never 6.1e-17 for what is 0 (cos 90°).
 * `tol`: how close counts as exact — looser for a value that was itself
 * estimated (a limit, a slope).
 */
function numberTex(v: number, tol = 1e-9): { tex: string; text: string } {
  if (v === Infinity) return { tex: "+\\infty", text: "+∞" };
  if (v === -Infinity) return { tex: "-\\infty", text: "-∞" };
  if (Number.isFinite(v) && Math.abs(v) < 1e-12) v = 0;
  if (Number.isFinite(v) && Math.abs(v - Math.round(v)) < tol * Math.max(1, Math.abs(v))) v = Math.round(v);
  if (Number.isInteger(v) || !Number.isFinite(v)) return { tex: String(v), text: String(v) };
  const dec = String(Number(v.toPrecision(10)));
  for (let d = 2; d <= 100; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < tol) {
      // A simple fraction says more than its decimals (1/3, -5/4).
      // …but a short decimal says it better still (0.75, not 3/4 ≈ 0.75).
      const exact = String(Number((n / d).toPrecision(10)));
      if (exact.replace("-", "").length <= 6) return { tex: exact, text: exact };
      const sign = n < 0 ? "-" : "";
      return { tex: `${sign}\\frac{${Math.abs(n)}}{${d}} \\approx ${Number((n / d).toPrecision(6))}`, text: `${n}/${d}` };
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

// ── Analysis: integrals, antiderivatives, limits ──────────────────────────

/** Does this expression depend on `v`? (A function's own name is not a use of v.) */
function hasVar(node: MathNode, v: string): boolean {
  let found = false;
  node.traverse((n, _path, parent) => {
    const s = n as MathNode & { isSymbolNode?: boolean; name?: string };
    if (!s.isSymbolNode || s.name !== v) return;
    const asCallee = parent && (parent as { isFunctionNode?: boolean; fn?: MathNode }).isFunctionNode && (parent as { fn?: MathNode }).fn === n;
    if (!asCallee) found = true;
  });
  return found;
}

/** A number for a constant expression, or null when it carries a letter (a slider, k). */
function constValue(src: string, scope: Map<string, unknown>): number | null {
  try {
    const v = math.evaluate(src, new Map(scope));
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** 1/3 → "(1/3)", 2 → "2": a coefficient as math.js text, kept exact when it is a simple fraction. */
function coefText(c: number): string {
  if (Number.isInteger(c)) return String(c);
  for (let d = 2; d <= 1000; d++) {
    const n = Math.round(c * d);
    if (Math.abs(c * d - n) < 1e-9) return `(${n}/${d})`;
  }
  return `(${Number(c.toPrecision(12))})`;
}

/**
 * The antiderivative of `node` in `v`, as math.js text, or null when it is not
 * one of the forms a school course integrates by hand: sums, constant
 * multiples, powers (xⁿ, 1/x, √x), and sin, cos, tan, exp, ln, aˣ of a linear
 * argument. Never guessed: the caller checks the result by differentiating it.
 */
function antiderivative(node: MathNode, v: string, scope: Map<string, unknown>): string | null {
  const n = node as MathNode & { op?: string; fn?: string | { name?: string }; args?: MathNode[]; content?: MathNode; name?: string };
  const src = node.toString();
  if (!hasVar(node, v)) return `(${src}) * ${v}`;

  /** c · F, with the coefficient folded when it is a number. */
  const times = (c: string, F: string | null): string | null => {
    if (F == null) return null;
    const k = constValue(c, scope);
    if (k === 1) return F;
    if (k === -1) return `-(${F})`;
    return `${k != null ? coefText(k) : `(${c})`} * (${F})`;
  };
  /** The slope of a linear argument (2x + 1 → "2"), or null when it is not linear. */
  const slope = (arg: MathNode): string | null => {
    try {
      const d = math.derivative(arg, v);
      return hasVar(d, v) ? null : d.toString();
    } catch {
      return null;
    }
  };
  const over = (a: string, F: string) => times(`1 / (${a})`, F);

  if (n.type === "ParenthesisNode" && n.content) return antiderivative(n.content, v, scope);
  if (n.type === "SymbolNode") return n.name === v ? `(1/2) * ${v}^2` : null;

  if (n.type === "OperatorNode" && n.args) {
    const [a, b] = n.args;
    switch (n.fn) {
      case "add": {
        const A = antiderivative(a, v, scope);
        const B = antiderivative(b, v, scope);
        return A && B ? `${A} + ${B}` : null;
      }
      case "subtract": {
        const A = antiderivative(a, v, scope);
        const B = antiderivative(b, v, scope);
        return A && B ? `${A} - (${B})` : null;
      }
      case "unaryMinus": {
        const A = antiderivative(a, v, scope);
        return A ? `-(${A})` : null;
      }
      case "unaryPlus":
        return antiderivative(a, v, scope);
      case "multiply":
        if (!hasVar(a, v)) return times(a.toString(), antiderivative(b, v, scope));
        if (!hasVar(b, v)) return times(b.toString(), antiderivative(a, v, scope));
        return null;
      case "divide":
        if (!hasVar(b, v)) return times(`1 / (${b.toString()})`, antiderivative(a, v, scope));
        // c / (…) is c · (…)^(-1): 1/x, 1/(2x + 1), 3/x².
        if (!hasVar(a, v)) return times(a.toString(), antiderivative(math.parse(`(${b.toString()})^(-1)`), v, scope));
        return null;
      case "pow": {
        if (!hasVar(b, v)) {
          const s = slope(a);
          if (s == null) return null;
          const base = a.toString();
          const k = constValue(b.toString(), scope);
          if (k === -1) return over(s, `log(abs(${base}))`);
          if (k != null) return over(`(${s}) * ${k + 1}`, `(${base})^${coefText(k + 1)}`);
          return `(${base})^(${b.toString()} + 1) / ((${b.toString()} + 1) * (${s}))`;
        }
        if (!hasVar(a, v)) {
          const s = slope(b);
          if (s == null) return null;
          const base = a.toString();
          if (base === "e") return over(s, `e^(${b.toString()})`);
          // Kept as ln(a), not folded: 2ˣ/ln 2 is the answer, 1.4427·2ˣ is not.
          return times(`1 / (${s})`, `(${base})^(${b.toString()}) / log(${base})`);
        }
        return null;
      }
    }
    return null;
  }

  if (n.type === "FunctionNode" && n.args?.length === 1) {
    const name = typeof n.fn === "object" ? n.fn?.name : undefined;
    const arg = n.args[0];
    const s = slope(arg);
    if (s == null) return null;
    const L = arg.toString();
    switch (name) {
      case "sin":
        return over(s, `-cos(${L})`);
      case "cos":
        return over(s, `sin(${L})`);
      case "tan":
        return over(s, `-log(abs(cos(${L})))`);
      case "exp":
        return over(s, `exp(${L})`);
      case "sqrt":
        return over(`(${s}) * 3 / 2`, `(${L})^(3/2)`);
      case "cbrt":
        return over(`(${s}) * 4 / 3`, `(${L})^(4/3)`);
      case "log":
        return over(s, `(${L}) * log(${L}) - (${L})`);
    }
  }
  return null;
}

/**
 * F, checked: its derivative must give back the function at a handful of
 * points. A rule that slipped returns null — "no simple antiderivative" — rather
 * than a wrong answer on a student's screen.
 */
function checkedAntiderivative(inner: string, v: string, scope: Map<string, unknown>): MathNode | null {
  let raw: MathNode;
  try {
    const text = antiderivative(math.parse(inner), v, scope);
    if (!text) return null;
    raw = math.parse(text.replace(/\+\s*-/g, "- "));
  } catch {
    return null;
  }
  // The tidy form if it still checks out (it always should), else the raw one.
  return derivativeMatches(tidy(raw), inner, v, scope) ? tidy(raw) : derivativeMatches(raw, inner, v, scope) ? raw : null;
}

/** Rules on top of math.js's own, so a coefficient reads −cos(2x)/2 and not cos(2x)·−1/2. */
const TIDY_RULES = [...math.simplify.rules, "n1 * -1 / n2 -> -(n1 / n2)", "n * -1 -> -n", "-1 * n -> -n"];

/** An expression in the shape a teacher would write it. Unchanged if simplifying fails. */
function tidy(node: MathNode): MathNode {
  try {
    return math.simplify(node, TIDY_RULES as never);
  } catch {
    return node;
  }
}

/** Does F′ give back f at a handful of points? */
function derivativeMatches(F: MathNode, inner: string, v: string, scope: Map<string, unknown>): boolean {
  try {
    const dF = math.derivative(F, v).compile();
    const f = math.compile(inner);
    let checked = 0;
    for (const x of [0.37, 1.3, 2.1, -0.8, 3.7, -2.4]) {
      const s = new Map(scope);
      s.set(v, x);
      const a = dF.evaluate(s);
      const b = f.evaluate(s);
      if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(b))) return false;
      checked++;
    }
    return checked >= 2;
  } catch {
    return false;
  }
}

/** Adaptive Simpson on [a, b]. Throws when the function blows up inside. */
function integrate(f: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0;
  if (a > b) return -integrate(f, b, a);
  // An endpoint where f is undefined (1/√x at 0) is approached, not hit.
  const eps = (b - a) * 1e-10;
  const g = (x: number) => {
    let y = f(x);
    if (!Number.isFinite(y)) y = f(x === a ? a + eps : x === b ? b - eps : x);
    return y;
  };
  let budget = 200_000;
  const simpson = (fa: number, fm: number, fb: number, w: number) => (w / 6) * (fa + 4 * fm + fb);
  const rec = (lo: number, hi: number, flo: number, fmid: number, fhi: number, whole: number, tol: number, depth: number): number => {
    const mid = (lo + hi) / 2;
    const lm = (lo + mid) / 2;
    const rm = (mid + hi) / 2;
    const flm = g(lm);
    const frm = g(rm);
    budget -= 2;
    const left = simpson(flo, flm, fmid, mid - lo);
    const right = simpson(fmid, frm, fhi, hi - mid);
    if (!Number.isFinite(left + right)) throw new Error("diverges");
    if (depth <= 0 || budget <= 0 || Math.abs(left + right - whole) <= 15 * tol) return left + right + (left + right - whole) / 15;
    return rec(lo, mid, flo, flm, fmid, left, tol / 2, depth - 1) + rec(mid, hi, fmid, frm, fhi, right, tol / 2, depth - 1);
  };
  const fa = g(a);
  const fb = g(b);
  const fm = g((a + b) / 2);
  const whole = simpson(fa, fm, fb, b - a);
  // Split first: a single Simpson panel can miss a bump entirely.
  const parts = 16;
  let total = 0;
  for (let i = 0; i < parts; i++) {
    const lo = a + ((b - a) * i) / parts;
    const hi = a + ((b - a) * (i + 1)) / parts;
    const flo = g(lo);
    const fhi = g(hi);
    const fmid = g((lo + hi) / 2);
    total += rec(lo, hi, flo, fmid, fhi, simpson(flo, fmid, fhi, hi - lo), 1e-11, 40);
  }
  if (!Number.isFinite(total) || !Number.isFinite(whole)) throw new Error("diverges");
  if (Math.abs(total) > 1e12) throw new Error("diverges");
  return total;
}

/** x ↦ f(x) for an expression in v, with the worksheet's values. NaN where undefined. */
function numericFunction(src: string, v: string, scope: Map<string, unknown>): (x: number) => number {
  const code = math.compile(src);
  return (x: number) => {
    const s = new Map(scope);
    s.set(v, x);
    try {
      const y = code.evaluate(s);
      return typeof y === "number" ? y : NaN;
    } catch {
      return NaN;
    }
  };
}

/** Is this a polynomial in v (so its integral is exact, and its antiderivative continuous)? */
function isPolynomial(node: MathNode, v: string): boolean {
  let ok = true;
  node.traverse((n) => {
    const o = n as MathNode & { op?: string; args?: MathNode[]; fn?: unknown };
    if (n.type === "FunctionNode" && hasVar(n, v)) ok = false;
    if (n.type === "OperatorNode" && o.op === "/" && o.args && hasVar(o.args[1], v)) ok = false;
    if (n.type === "OperatorNode" && o.op === "^" && o.args) {
      const ex = o.args[1];
      if (hasVar(ex, v)) ok = false;
      else {
        const k = Number(ex.toString());
        if (hasVar(o.args[0], v) && !(Number.isInteger(k) && k >= 0)) ok = false;
      }
    }
  });
  return ok;
}

export type Limit = { kind: "value"; value: number } | { kind: "none" };

/**
 * A limit, estimated: the function is evaluated closer and closer to the
 * point (or further and further out) and the values are watched. It settles
 * → the limit; it keeps growing the same way → ±∞; anything else → none.
 */
function limitFrom(f: (x: number) => number, at: number, dir: 1 | -1): Limit {
  const xs = Number.isFinite(at)
    ? [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8].map((h) => at + dir * h)
    : [1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e10, 1e12].map((x) => (at > 0 ? x : -x));
  const ys = xs.map(f);
  if (ys.slice(-4).some((y) => Number.isNaN(y))) return { kind: "none" };
  const finite = ys.filter(Number.isFinite);
  const tail = ys.slice(-5);
  if (tail.every((y) => y === Infinity)) return { kind: "value", value: Infinity };
  if (tail.every((y) => y === -Infinity)) return { kind: "value", value: -Infinity };
  if (finite.length < 5) return { kind: "none" };

  // Growing the same way and not slowing down: ±∞ (1/x², ln x at 0⁺, x² out).
  const d = ys.slice(-5).map((y, i, a) => (i ? y - a[i - 1] : 0)).slice(1);
  const sameSign = d.every((x) => x > 0) || d.every((x) => x < 0);
  const notSlowing = d.every((x, i) => i === 0 || Math.abs(x) >= 0.5 * Math.abs(d[i - 1]));
  if (sameSign && notSlowing && Math.abs(ys[ys.length - 1]) > 10) return { kind: "value", value: d[0] > 0 ? Infinity : -Infinity };

  // Settling: the two closest neighbours (rounding noise makes the very last
  // ones worse, not better, for something like (1 − cos x)/x²).
  let best = -1;
  let gap = Infinity;
  for (let i = 2; i < ys.length; i++) {
    const g = Math.abs(ys[i] - ys[i - 1]);
    if (Number.isFinite(g) && g < gap) {
      gap = g;
      best = i;
    }
  }
  if (best < 0) return { kind: "none" };
  const value = ys[best];
  return gap <= 1e-5 * Math.max(1, Math.abs(value)) ? { kind: "value", value } : { kind: "none" };
}

/** A limit's value as TeX, rounded to what the estimate supports. */
function limitTex(l: Limit): { tex: string; text: string } {
  if (l.kind === "none") return { tex: "", text: "none" };
  const v = Number.isFinite(l.value) ? Number(l.value.toPrecision(7)) : l.value;
  return numberTex(v, 1e-6);
}

// ── Calculator ────────────────────────────────────────────────────────────

/** What went wrong on a line, for the UI to say in the learner's language. */
export type CalcProblem =
  | { kind: "unknownFunction"; name: string }
  | { kind: "unknownSymbol"; name: string }
  | { kind: "brackets" }
  | { kind: "diverges" }
  | { kind: "other" };

export type CalcRow = {
  /** What the learner wrote, typeset (KaTeX HTML); empty when it cannot be read. */
  inputHtml: string;
  /** The answer, typeset; and as plain text for tests and screen readers. */
  resultHtml?: string;
  result?: string;
  /** For the UI to word in the learner's language. */
  note?: "noSolution" | "everyValue" | "approx" | "noPrimitive" | "noLimit";
  error?: string;
  problem?: CalcProblem;
};

/** A math.js error message, read for what the learner should fix. */
function problemOf(message: string): CalcProblem {
  let m = /Undefined function (\w+)/.exec(message);
  if (m) return { kind: "unknownFunction", name: m[1] };
  m = /Undefined symbol (\w+)/.exec(message);
  if (m) return { kind: "unknownSymbol", name: m[1] };
  if (/Parenthesis|parenthes|Unexpected end|Unexpected (?:operator|type)|expected/i.test(message)) return { kind: "brackets" };
  if (/diverges/.test(message)) return { kind: "diverges" };
  return { kind: "other" };
}

export type CalcOptions = {
  /** Angles in degrees: sin(30) = 0.5, arccos(0.5) = 60 — the collège convention. */
  degrees?: boolean;
};

const RAD = Math.PI / 180;

/** sin, cos, tan and their inverses in degrees, for a worksheet in degree mode. */
function degreeFunctions(): [string, (x: unknown) => unknown][] {
  const num = (x: unknown): x is number => typeof x === "number";
  // A value with its own unit (30 deg, 1 rad) is already explicit.
  const direct = (name: "sin" | "cos" | "tan", f: (x: number) => number) =>
    [name, (x: unknown) => (num(x) ? f(x * RAD) : (math[name] as (x: unknown) => unknown)(x))] as [string, (x: unknown) => unknown];
  const inverse = (name: "asin" | "acos" | "atan", f: (x: number) => number) =>
    [name, (x: unknown) => (num(x) ? f(x) / RAD : NaN)] as [string, (x: unknown) => unknown];
  return [
    direct("sin", Math.sin),
    direct("cos", Math.cos),
    direct("tan", Math.tan),
    inverse("asin", Math.asin),
    inverse("acos", Math.acos),
    inverse("atan", Math.atan),
  ];
}

function rowFor(line: MathLine, scope: Map<string, unknown>, comma: boolean): CalcRow {
  const html = (tex: string) => htmlOf(tex, comma);
  switch (line.kind) {
    case "derivative": {
      const v = line.v ?? variableOf(line.inner, scope);
      const d = math.derivative(line.inner, v);
      const tex = texOfNode(d);
      return {
        inputHtml: html(`\\left(${texOf(line.inner)}\\right)'`),
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
    case "primitive": {
      const v = line.v ?? variableOf(line.inner, scope);
      const inputHtml = html(`\\int ${texOf(line.inner)}\\,d${v}`);
      const F = checkedAntiderivative(line.inner, v, scope);
      if (!F) return { inputHtml, note: "noPrimitive", result: "none" };
      return { inputHtml, resultHtml: html(`F(${v}) = ${texOfNode(F)} + C`), result: `${F.toString()} + C` };
    }
    case "integral": {
      const v = line.v ?? variableOf(line.inner, scope);
      const a = constValue(line.a, scope);
      const b = constValue(line.b, scope);
      const inputHtml = html(`\\int_{${texOf(line.a)}}^{${texOf(line.b)}} ${texOf(line.inner)}\\,d${v}`);
      if (a == null || b == null) return { inputHtml, problem: { kind: "other" }, error: "bounds" };
      const value = integrate(numericFunction(line.inner, v, scope), a, b);
      const exact = isPolynomial(math.parse(line.inner), v);
      const n = numberTex(value, exact ? 1e-9 : 1e-10);
      // For a polynomial, the working a student writes: [F(x)] from a to b.
      const F = exact ? checkedAntiderivative(line.inner, v, scope) : null;
      const steps = F ? `\\left[${texOfNode(F)}\\right]_{${texOf(line.a)}}^{${texOf(line.b)}} = ` : "";
      return {
        inputHtml,
        resultHtml: html(`${steps}${n.tex}`),
        result: n.text,
        ...(exact ? {} : { note: "approx" as const }),
      };
    }
    case "limit": {
      const v = line.v ?? variableOf(line.inner, scope);
      const target = limitTarget(line.at);
      const at = target.value === "Infinity" ? Infinity : target.value === "-Infinity" ? -Infinity : constValue(target.value, scope);
      const atTex = at === Infinity ? "+\\infty" : at === -Infinity ? "-\\infty" : texOf(target.value);
      const sideTex = target.side === "left" ? "^-" : target.side === "right" ? "^+" : "";
      const inputHtml = html(`\\lim_{${v} \\to ${atTex}${sideTex}} ${texOf(line.inner)}`);
      if (at == null) return { inputHtml, problem: { kind: "other" }, error: "target" };
      const f = numericFunction(line.inner, v, scope);
      // ±∞ has one side; a point has two, and they must agree.
      const right = at === -Infinity ? null : target.side === "left" ? null : limitFrom(f, at, 1);
      const left = at === Infinity ? null : target.side === "right" ? null : limitFrom(f, at, -1);
      const sides = [left, right].filter((l): l is Limit => l != null);
      const values = sides.map((l) => (l.kind === "value" ? l.value : null));
      // +∞ and −∞ do not agree (1/x at 0), however "close" Infinity says they are.
      const agree =
        values.every((x) => x != null) &&
        values.every(
          (x) => x === values[0] || (Number.isFinite(x) && Number.isFinite(values[0]) && Math.abs(x! - values[0]!) <= 1e-5 * Math.max(1, Math.abs(values[0]!))),
        );
      if (agree) {
        const n = limitTex(sides[0]);
        return { inputHtml, resultHtml: html(n.tex), result: n.text, note: "approx" };
      }
      // Two different one-sided limits (1/x at 0): say both — that IS the answer.
      if (left?.kind === "value" && right?.kind === "value") {
        const l = limitTex(left);
        const r = limitTex(right);
        return {
          inputHtml,
          resultHtml: html(`${atTex}^- : ${l.tex},\\quad ${atTex}^+ : ${r.tex}`),
          result: `left ${l.text}, right ${r.text}`,
          note: "noLimit",
        };
      }
      return { inputHtml, note: "noLimit", result: "none" };
    }
    case "expr": {
      const inputHtml = html(texOf(line.src));
      let value: unknown;
      try {
        value = math.evaluate(line.src, scope);
      } catch (e) {
        // A letter with no value (2x + 3x): not a mistake, an expression to
        // tidy — simplified when that changes something, else shown as written.
        if (!(e instanceof Error) || !/Undefined symbol/.test(e.message) || line.src.includes("=")) throw e;
        // With the values already given (a = 2 → 2x² + 3x).
        const known = Object.fromEntries([...scope].filter(([, x]) => typeof x === "number"));
        const s = tidy(math.simplify(line.src, known));
        const same = s.toString().replace(/\s/g, "") === math.parse(line.src).toString().replace(/\s/g, "");
        return same ? { inputHtml } : { inputHtml, resultHtml: html(texOfNode(s)), result: s.toString() };
      }
      const out = valueTex(value);
      return out ? { inputHtml, resultHtml: html(out.tex), result: out.text } : { inputHtml };
    }
  }
}

/** Evaluate the lines in order, sharing one scope, as a worksheet would. */
export function runCalc(lines: string[], comma = false, opts: CalcOptions = {}): CalcRow[] {
  const scope = new Map<string, unknown>(opts.degrees ? degreeFunctions() : []);
  // Names the earlier lines defined, so `rayon` and `aire(r)` are read whole.
  const names: string[] = [];
  const functions: string[] = [];
  const isUnit = (name: string) => {
    try {
      return math.Unit.isValuelessUnit(name);
    } catch {
      return false;
    }
  };
  return lines.map((raw) => {
    const line = readLine(raw, { names, functions, isUnit });
    const def = definedName(raw);
    if (def) (def.fn ? functions : names).push(def.name);
    try {
      return rowFor(line, scope, comma);
    } catch (e) {
      let inputHtml = "";
      try {
        inputHtml = line.kind === "expr" ? html(texOf(line.src), comma) : "";
      } catch {
        // unreadable: the UI shows the raw text instead
      }
      const error = e instanceof Error ? e.message : String(e);
      return { inputHtml, error, problem: problemOf(error) };
    }
  });
}

// ── Graph ─────────────────────────────────────────────────────────────────

/**
 * How a graph's expressions are read: its own names whole (a slider called
 * `amp`), its functions callable (`g(x) = f(x) + 1`), any other run of letters
 * a product (`ax²` is a·x²).
 */
export function graphNames(spec: GraphSpec): NormalizeOptions {
  return {
    names: [...spec.sliders.map((s) => s.name), ...spec.constants.map((c) => c.name)],
    functions: spec.functions.map((f) => f.name),
  };
}

/** Typeset one function for the legend: f(x) = x² − 3. */
export function functionHtml(name: string, expr: string, comma = false, opts?: NormalizeOptions): string {
  try {
    return html(`${name === "y" ? "y" : `${name}(x)`} = ${texOf(normalizeMath(expr, opts))}`, comma);
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
  const opts = graphNames(spec);
  const out: string[] = [];
  const exprs = [
    ...spec.functions.map((f) => f.expr),
    ...spec.constants.map((c) => c.expr),
    ...spec.points.flatMap((p) => [p.x, p.y]),
    ...spec.areas.flatMap((a) => [a.a, a.b]),
    ...spec.tangents.map((t) => t.at),
  ];
  for (const e of exprs) {
    try {
      for (const name of freeSymbols(math.parse(normalizeMath(e, opts)), known)) if (!out.includes(name)) out.push(name);
    } catch {
      // an unreadable function shows its own error
    }
  }
  return out;
}

export type SampledArea = {
  f: string;
  g: string | null;
  a: number;
  b: number;
  /** The outline to fill: along f from a to b, then back along g (or the axis). */
  outline: [number, number][];
  /** ∫ₐᵇ (f − g): signed — what the calculator gives. */
  integral: number;
  /** The geometric area: ∫ₐᵇ |f − g|. Differs from the integral when the curves cross. */
  area: number;
};

export type SampledTangent = { f: string; x0: number; y0: number; slope: number; intercept: number };

export type Sampled = {
  curves: { name: string; expr: string; points: [number, number][]; error?: string }[];
  points: { name: string; x: number; y: number }[];
  areas: SampledArea[];
  tangents: SampledTangent[];
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
  const opts = graphNames(spec);
  const norm = (s: string) => normalizeMath(s, opts);
  const scope = new Map<string, unknown>(Object.entries(sliders));
  const errors: string[] = [];
  for (const c of spec.constants) {
    try {
      scope.set(c.name, math.evaluate(norm(c.expr), scope));
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);
  /** The plotted functions, by name, as numbers in → numbers out (NaN where undefined). */
  const fns = new Map<string, (x: number) => number>();

  const curves = spec.functions.map((f) => {
    try {
      const code = math.compile(norm(f.expr));
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
      const fn = (x: number) => {
        const s = new Map(scope);
        s.set("x", x);
        try {
          return num(code.evaluate(s));
        } catch {
          return NaN;
        }
      };
      scope.set(f.name, fn);
      fns.set(f.name, fn);
      return { name: f.name, expr: f.expr, points: pts };
    } catch (e) {
      return { name: f.name, expr: f.expr, points: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const value = (src: string) => num(math.evaluate(norm(src), scope));

  const points = spec.points.flatMap((p) => {
    try {
      const x = value(p.x);
      const y = value(p.y);
      return Number.isFinite(x) && Number.isFinite(y) ? [{ name: p.name, x, y }] : [];
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  });

  const areas = spec.areas.flatMap((ar): SampledArea[] => {
    const f = fns.get(ar.f);
    const g = ar.g ? fns.get(ar.g) : () => 0;
    try {
      if (!f || !g) throw new Error(`Undefined function ${!f ? ar.f : ar.g}`);
      const a = value(ar.a);
      const b = value(ar.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("bounds");
      const diff = (x: number) => f(x) - g(x);
      const integral = integrate(diff, a, b);
      const area = Math.abs(integrate((x) => Math.abs(diff(x)), a, b));
      const n = 160;
      const top: [number, number][] = [];
      const bottom: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        const yf = f(x);
        const yg = g(x);
        if (Number.isFinite(yf) && Number.isFinite(yg)) {
          top.push([x, yf]);
          bottom.push([x, yg]);
        }
      }
      return [{ f: ar.f, g: ar.g, a, b, outline: [...top, ...bottom.reverse()], integral, area }];
    } catch (e) {
      errors.push(`${ar.f}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  });

  const tangents = spec.tangents.flatMap((t): SampledTangent[] => {
    const f = fns.get(t.f);
    try {
      if (!f) throw new Error(`Undefined function ${t.f}`);
      const x = value(t.at);
      const y = f(x);
      // A central difference, small against the scale of x.
      const h = 1e-5 * Math.max(1, Math.abs(x));
      const slope = (f(x + h) - f(x - h)) / (2 * h);
      if (![x, y, slope].every(Number.isFinite)) throw new Error("no tangent");
      return [{ f: t.f, x0: x, y0: y, slope, intercept: y - slope * x }];
    } catch (e) {
      errors.push(`${t.f}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  });

  return { curves, points, areas, tangents, errors };
}

/** The legend line of a shaded area: ∫₀² f(x) dx = 8/3, and the area when they differ. */
export function areaHtml(ar: SampledArea, comma = false): string {
  const fx = ar.g ? `\\left(${ar.f}(x) - ${ar.g}(x)\\right)` : `${ar.f}(x)`;
  const bound = (v: number) => numberTex(v, 1e-9).tex.replace(/ \\approx.*$/, "");
  // "=" when the value landed on a whole number or a simple fraction (8/3), "≈" otherwise.
  const valueOf = (v: number) => {
    const n = numberTex(v, 1e-7);
    const exact = /^-?\d+(?:\/\d+)?$/.test(n.text) || /^-?\d+\.\d{1,4}$/.test(n.text);
    return `${exact ? "=" : "\\approx"} ${n.tex.replace(/ \\approx.*$/, "")}`;
  };
  let tex = `\\int_{${bound(ar.a)}}^{${bound(ar.b)}} ${fx}\\,dx ${valueOf(ar.integral)}`;
  if (Math.abs(ar.area - Math.abs(ar.integral)) > 1e-6 * Math.max(1, ar.area)) {
    tex += `,\\quad \\mathcal{A} ${valueOf(ar.area)}`;
  }
  return html(tex, comma);
}

/** The tangent's equation, the way it is written in class: y = 2x − 1. */
export function tangentHtml(t: SampledTangent, comma = false): string {
  const m = Number(t.slope.toPrecision(8));
  const p = Number(t.intercept.toPrecision(8));
  const mt = numberTex(m, 1e-6).tex.replace(/ \\approx.*$/, "");
  const pt = numberTex(Math.abs(p), 1e-6).tex.replace(/ \\approx.*$/, "");
  const slopePart = Math.abs(m) < 1e-9 ? "" : m === 1 ? "x" : m === -1 ? "-x" : `${mt}x`;
  const constPart = Math.abs(p) < 1e-9 ? "" : `${slopePart ? (p < 0 ? " - " : " + ") : p < 0 ? "-" : ""}${pt}`;
  return html(`y = ${slopePart}${constPart}` + (slopePart || constPart ? "" : "0"), comma);
}
