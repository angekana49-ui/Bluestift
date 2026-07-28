/**
 * A LaTeX SUBSET → renderable tree, dependency-free.
 *
 * The honest framing: this is not KaTeX. KaTeX is ~280KB of JS plus ~100KB of
 * fonts, which on the 2G/3G connections this product targets is ten seconds
 * before a student can read one fraction. So this covers what a tutor actually
 * writes at school level — fractions, powers, indices, roots, Greek letters,
 * the common operators and relations — using Unicode and a little CSS.
 *
 * Its other job is to FAIL GRACEFULLY. An unknown command renders its argument
 * as plain text (`\underbrace{x+y}` → "x+y") rather than showing the student a
 * backslash. Raw LaTeX source is never displayed.
 *
 * If full LaTeX is ever needed (matrices, aligned environments, integrals with
 * limits), the upgrade is to lazy-load KaTeX for messages containing maths —
 * the node tree below is deliberately the only thing the renderer depends on.
 */

export type MathNode =
  | { t: "sym"; v: string }
  | { t: "sup"; c: MathNode[] }
  | { t: "sub"; c: MathNode[] }
  | { t: "frac"; num: MathNode[]; den: MathNode[] }
  | { t: "sqrt"; c: MathNode[] }
  | { t: "row"; c: MathNode[] };

/** Single-token LaTeX commands → their Unicode character. */
const SYMBOLS: Record<string, string> = {
  // Greek (lower)
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  // Greek (upper)
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  // Operators & relations
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓", ast: "∗",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", sim: "∼", propto: "∝", cong: "≅",
  ll: "≪", gg: "≫",
  // Arrows
  rightarrow: "→", to: "→", leftarrow: "←", gets: "←",
  Rightarrow: "⇒", Leftarrow: "⇐", leftrightarrow: "↔", Leftrightarrow: "⇔",
  mapsto: "↦",
  // Sets & logic
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃",
  supseteq: "⊇", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅",
  forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨",
  mathbb_R: "ℝ", mathbb_N: "ℕ", mathbb_Z: "ℤ", mathbb_Q: "ℚ", mathbb_C: "ℂ",
  // Big operators & calculus
  sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮",
  partial: "∂", nabla: "∇", infty: "∞", lim: "lim",
  // Misc
  degree: "°", circ: "∘", angle: "∠", perp: "⊥", parallel: "∥",
  dots: "…", ldots: "…", cdots: "⋯", quad: " ", qquad: "  ",
  ",": " ", ";": " ", "!": "", " ": " ",
  percent: "%", "%": "%", "&": "&", _: "_", "#": "#", "{": "{", "}": "}", $: "$",
};

/** Commands whose sole argument is just text: \text{…}, \mathrm{…}, … */
const TEXT_LIKE = new Set([
  "text", "textrm", "textit", "textbf", "mathrm", "mathit", "mathbf",
  "mathsf", "mathtt", "operatorname", "left", "right", "displaystyle",
  "limits", "boldsymbol", "bm",
]);

/** Function names that should read upright: \sin → "sin". */
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "log", "ln", "exp", "det", "dim", "max", "min",
  "gcd", "lcm", "deg", "arg", "sup", "inf",
]);

type Cursor = { s: string; i: number };

function skipSpace(c: Cursor): void {
  while (c.i < c.s.length && /\s/.test(c.s[c.i])) c.i++;
}

/** Read `{...}` (balanced) or a single token, and parse it as a group. */
function readGroup(c: Cursor): MathNode[] {
  skipSpace(c);
  if (c.i >= c.s.length) return [];
  if (c.s[c.i] === "{") {
    let depth = 0;
    const start = ++c.i;
    while (c.i < c.s.length) {
      const ch = c.s[c.i];
      if (ch === "\\") {
        c.i += 2;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        if (depth === 0) break;
        depth--;
      }
      c.i++;
    }
    const body = c.s.slice(start, c.i);
    c.i++; // past '}'
    return parseNodes(body);
  }
  // A bare command, e.g. x^\alpha
  if (c.s[c.i] === "\\") {
    const m = /^\\([a-zA-Z]+|.)/.exec(c.s.slice(c.i));
    if (m) {
      c.i += m[0].length;
      return parseNodes(m[0]);
    }
  }
  return [{ t: "sym", v: c.s[c.i++] }];
}

function parseNodes(src: string): MathNode[] {
  const c: Cursor = { s: src, i: 0 };
  const out: MathNode[] = [];

  while (c.i < c.s.length) {
    const ch = c.s[c.i];

    if (ch === "^" || ch === "_") {
      c.i++;
      const body = readGroup(c);
      out.push({ t: ch === "^" ? "sup" : "sub", c: body });
      continue;
    }

    if (ch === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(c.s.slice(c.i));
      if (!m) {
        c.i++;
        continue;
      }
      const name = m[1];
      c.i += m[0].length;

      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const num = readGroup(c);
        const den = readGroup(c);
        out.push({ t: "frac", num, den });
        continue;
      }
      if (name === "sqrt") {
        // \sqrt[n]{x}: the index is dropped (rare at this level) but the
        // radicand is never lost.
        skipSpace(c);
        if (c.s[c.i] === "[") {
          const close = c.s.indexOf("]", c.i);
          if (close > 0) c.i = close + 1;
        }
        out.push({ t: "sqrt", c: readGroup(c) });
        continue;
      }
      if (name === "mathbb") {
        const g = readGroup(c);
        const letter = g.length === 1 && g[0].t === "sym" ? g[0].v : "";
        const sym = SYMBOLS[`mathbb_${letter}`];
        out.push(sym ? { t: "sym", v: sym } : { t: "row", c: g });
        continue;
      }
      if (TEXT_LIKE.has(name)) {
        // \left( / \right) carry a delimiter rather than a group.
        if (name === "left" || name === "right") {
          skipSpace(c);
          const d = c.s[c.i];
          if (d && d !== "." ) out.push({ t: "sym", v: d === "\\" ? "" : d });
          c.i++;
          continue;
        }
        out.push({ t: "row", c: readGroup(c) });
        continue;
      }
      if (FUNCTIONS.has(name)) {
        out.push({ t: "sym", v: name });
        continue;
      }
      const sym = SYMBOLS[name];
      if (sym !== undefined) {
        out.push({ t: "sym", v: sym });
        continue;
      }
      // Unknown command: keep its argument, drop the command. The student sees
      // maths, never a stray backslash.
      const arg = readGroup(c);
      if (arg.length) out.push({ t: "row", c: arg });
      continue;
    }

    if (ch === "{" || ch === "}") {
      c.i++;
      continue;
    }

    out.push({ t: "sym", v: ch });
    c.i++;
  }

  return out;
}

/** Parse a LaTeX fragment into a renderable tree. Never throws. */
export function parseLatex(src: string): MathNode[] {
  try {
    return parseNodes(src);
  } catch {
    return [{ t: "sym", v: src }];
  }
}

/** Flatten to plain text — used for copy/export and as the a11y label. */
export function latexToText(nodes: MathNode[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "sym":
          return n.v;
        case "sup":
          return `^${latexToText(n.c)}`;
        case "sub":
          return `_${latexToText(n.c)}`;
        case "frac":
          return `(${latexToText(n.num)})/(${latexToText(n.den)})`;
        case "sqrt":
          return `√(${latexToText(n.c)})`;
        case "row":
          return latexToText(n.c);
      }
    })
    .join("");
}
