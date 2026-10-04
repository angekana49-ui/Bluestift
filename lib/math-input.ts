/**
 * Maths as a student writes it, turned into what math.js reads.
 *
 * The tools used to take math.js syntax as-is: `derivative("x^3", "x")`,
 * `sqrt(a^2 + b^2)`, `*` for every product. That is a programmer's notation,
 * and a collégien or a first-year student who has never used MATLAB reads it as
 * noise. So the learner writes the way they would on paper — x², √(…), 3,5,
 * 2x, "dérivée de x³", "2x + 3 = 7" — and this module translates.
 *
 * Pure and dependency-free (it runs on every keystroke, and the tests pin it).
 * Lenient in what it accepts, in all four interface languages, because a
 * student who has to remember our syntax is a student who stops using the tool.
 */

/** Superscript digits as students paste or type them (x², x⁻¹). */
const SUPER: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

/** Word-functions, every language mapped to the math.js name. */
const WORD_FUNCTIONS: [RegExp, string][] = [
  [/\b(?:racine|ra[ií]z|wurzel|root)\s*\(/gi, "sqrt("],
  // log is base 10 at school, ln is natural — math.js has it the other way.
  [/\blog\s*\(/gi, "log10("],
  [/\bln\s*\(/gi, "log("],
];

/** Decimal commas (3,5) — only outside [ ] where a comma separates matrix cells. */
function decimalCommas(s: string): string {
  let depth = 0;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") depth = Math.max(0, depth - 1);
    if (c === "," && depth === 0 && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "")) out += ".";
    else out += c;
  }
  return out;
}

/** Symbol-level translation: the notation, not the meaning. */
export function normalizeMath(input: string): string {
  let s = input.trim();
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙⋅]/g, "*")
    .replace(/÷/g, "/")
    // Spaced, or "2πr" reads as one variable called "pir".
    .replace(/π/g, " pi ")
    .replace(/∞/g, "Infinity")
    .replace(/°/g, " deg");
  // x² → x^2, x⁻¹ → x^(-1)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => {
    const v = [...m].map((c) => SUPER[c]).join("");
    return v.startsWith("-") ? `^(${v})` : `^${v}`;
  });
  s = decimalCommas(s);
  // √(…) → sqrt(…); √16 / √x → sqrt(16) / sqrt(x)
  s = s.replace(/√\s*\(/g, "sqrt(").replace(/√\s*([0-9.]+|[A-Za-z]\w*)/g, "sqrt($1)");
  for (const [re, to] of WORD_FUNCTIONS) s = s.replace(re, to);
  // |x - 2| → abs(x - 2)  (one level; nested bars are rare at school)
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");
  return s.replace(/ {2,}/g, " ").trim();
}

export type MathLine =
  | { kind: "expr"; src: string }
  | { kind: "derivative"; inner: string; v: string | null }
  | { kind: "simplify"; inner: string }
  | { kind: "solve"; lhs: string; rhs: string; v: string | null };

const DERIVATIVE = /^(?:d[ée]riv[ée]e?s?|derivative|derivada|ableitung|d\/d([a-z]))\s*(?:de |of |von |der )?\s*/i;
const SIMPLIFY = /^(?:simplifi(?:er|e)|simplify|simplificar|vereinfache)\s*(?:de |of |von )?\s*/i;
const SOLVE = /^(?:r[ée]soudre|r[ée]sous|solve|resolver|resuelve|l[öo]se|loese)\s*/i;

/** Drop ONE pair of parentheses wrapping the whole string, if it is one pair. */
function unwrap(s: string): string {
  const t = s.trim();
  if (!t.startsWith("(") || !t.endsWith(")")) return t;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") depth++;
    else if (t[i] === ")") depth--;
    if (depth === 0 && i < t.length - 1) return t; // "(a)+(b)": not one pair
  }
  return t.slice(1, -1).trim();
}

/** `"x^3", "x"` — the math.js way of writing a derivative's arguments. */
function quotedArgs(s: string): { inner: string; v: string | null } | null {
  const m = /^"([^"]+)"\s*(?:,\s*"([a-zA-Z])")?$/.exec(s.trim());
  return m ? { inner: m[1], v: m[2] ?? null } : null;
}

/** A name being given a value (`a = 3`, `f(x) = x²`) rather than an equation. */
const ASSIGNMENT = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(\(\s*[A-Za-z]\s*\))?\s*=(?!=)/;

/** Functions a student uses but never defines: "cos(x) = x" is an equation. */
const KNOWN_FUNCTIONS = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "log", "ln", "exp", "abs", "log10"]);

function isAssignment(s: string): boolean {
  const m = ASSIGNMENT.exec(s);
  return m != null && !KNOWN_FUNCTIONS.has(m[1].toLowerCase());
}

/**
 * What one calculator line asks for. Words are recognised in the four
 * interface languages; a bare equation ("2x + 3 = 7") is a request to solve it.
 */
export function readLine(raw: string): MathLine {
  const line = raw.trim();

  let m = DERIVATIVE.exec(line);
  if (m && line.length > m[0].length) {
    const rest = unwrap(line.slice(m[0].length));
    const q = quotedArgs(rest);
    return { kind: "derivative", inner: normalizeMath(q ? q.inner : rest), v: (q?.v ?? m[1] ?? null) };
  }
  m = SIMPLIFY.exec(line);
  if (m && line.length > m[0].length) {
    const rest = unwrap(line.slice(m[0].length));
    return { kind: "simplify", inner: normalizeMath(quotedArgs(rest)?.inner ?? rest) };
  }
  m = SOLVE.exec(line);
  const body = m ? unwrap(line.slice(m[0].length)) : line;
  const eq = body.split("=");
  const isEquation = eq.length === 2 && !body.includes("==") && !/[<>]=/.test(body) && eq[1].trim() !== "";
  if (m || (isEquation && !isAssignment(body))) {
    const [lhs, rhs] = isEquation ? eq : [body, "0"];
    return { kind: "solve", lhs: normalizeMath(lhs), rhs: normalizeMath(rhs), v: null };
  }
  return { kind: "expr", src: normalizeMath(line) };
}
