/**
 * Maths as a student writes it, turned into what math.js reads.
 *
 * The tools used to take math.js syntax as-is: `derivative("x^3", "x")`,
 * `sqrt(a^2 + b^2)`, `*` for every product. That is a programmer's notation,
 * and a collégien or a first-year student who has never used MATLAB reads it as
 * noise. So the learner writes the way they would on paper — x², √(…), 3,5,
 * 2x, ax² + bx, sin x, arccos(0,5), x(x + 1), "dérivée de x³", "2x + 3 = 7" —
 * and this module translates.
 *
 * Pure and dependency-free (it runs on every keystroke, and the tests pin it).
 * Lenient in what it accepts, in all four interface languages, because a
 * student who has to remember our syntax is a student who stops using the tool.
 */

/** Superscript digits as students paste or type them (x², x⁻¹). */
const SUPER: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

/** Word-functions, every language and school habit mapped to the math.js name. */
const WORD_FUNCTIONS: [RegExp, string][] = [
  [/\b(?:racine\s+cubique|cube\s+root|ra[ií]z\s+c[uú]bica|kubikwurzel)\s*\(/gi, "cbrt("],
  [/\b(?:racine|ra[ií]z|wurzel|root)\s*\(/gi, "sqrt("],
  // arcsin as written in France, Spain and Germany; sen/tg in Spanish schools.
  // …and "arcos", the spelling that slips out as often as the right one.
  [/\barc?\s*(?:sin|sen)\b/gi, "asin"],
  [/\barc?\s*cos\b/gi, "acos"],
  [/\barc?\s*(?:tan|tg)\b/gi, "atan"],
  [/\basen\b/gi, "asin"],
  [/\bsen\b/gi, "sin"],
  [/\btg\b/gi, "tan"],
  [/\b(?:pgcd|ggt|mcd)\s*\(/gi, "gcd("],
  [/\b(?:ppcm|kgv|mcm)\s*\(/gi, "lcm("],
  // log is base 10 at school, ln is natural — math.js has it the other way.
  [/\blog\b(?!\s*_)/gi, "log10"],
  // log₂(8), log_2(8): a base written as an index.
  [/\blog\s*_\s*\{?\s*([0-9.]+|e)\s*\}?\s*\(([^()]*)\)/gi, "log($2, $1)"],
  [/\bln\b/gi, "log"],
];

/** Subscript digits (log₂). */
const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/**
 * Names math.js knows and a student may write — kept whole. Everything else
 * written as a run of letters is a product of one-letter variables, the way
 * it is on paper: "ax²" is a·x², "xy" is x·y, "2πr" is 2·π·r.
 */
export const FUNCTIONS = [
  "sin", "cos", "tan", "cot", "sec", "csc", "asin", "acos", "atan", "acot", "sinh", "cosh", "tanh",
  "sqrt", "cbrt", "nthRoot", "exp", "log", "log10", "log2", "abs", "floor", "ceil", "round", "sign",
  "min", "max", "mod", "gcd", "lcm", "factorial", "combinations", "permutations", "det", "inv", "transpose",
] as const;
const CONSTANTS = ["pi", "e", "Infinity", "deg", "rad", "to", "in"];
const BUILTIN = new Set<string>([...FUNCTIONS, ...CONSTANTS]);

/** Single letters that are functions when followed by "(", unless told otherwise: f(2) is f at 2, a(2) is a times 2. */
const DEFAULT_FUNCTION_LETTERS = ["f", "g", "h"];

export type NormalizeOptions = {
  /** Names the learner defined (a constant, a slider, `rayon = 3`): kept whole. */
  names?: Iterable<string>;
  /**
   * Names that are functions (the graph's f and g, a calculator's `aire(r) = …`):
   * `f(2)` is a call. Default f, g, h — the calculator passes the ones defined so
   * far instead, so `g = 9,81` then `m g (h + 1)` stays a product.
   */
  functions?: Iterable<string>;
  /** A unit math.js knows (cm, inch, kg): kept whole after a number or `to` — "5 cm to inch". */
  isUnit?: (name: string) => boolean;
};

/** Decimal commas (3,5) — only outside [ ] and ( , ) argument lists where a comma separates. */
function decimalCommas(s: string): string {
  let depth = 0;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") depth = Math.max(0, depth - 1);
    // "3,5" with no space is a decimal; "max(3, 5)" (a space) is two arguments.
    if (c === "," && depth === 0 && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "")) out += ".";
    else out += c;
  }
  return out;
}

/** "ax" → ["a", "x"]; "xsin" → ["x", "sin"]; "pir" → ["pi", "r"]. Longest known name first. */
function splitWord(w: string, known: Set<string>): string[] {
  const longNames = [...known].filter((k) => k.length > 1).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    const name = longNames.find((k) => w.startsWith(k, i));
    if (name) {
      out.push(name);
      i += name.length;
    } else {
      out.push(w[i]);
      i++;
    }
  }
  return out;
}

/** Every identifier, read the way a student meant it. */
function readNames(s: string, known: Set<string>, functions: Set<string>, isUnit?: (name: string) => boolean): string {
  // 1. Runs of letters → known names and one-letter variables.
  s = s.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w, at: number, all: string) => {
    // The exponent part of 1e5 is not a name.
    if (/^e\d/.test(w) && /\d/.test(all[at - 1] ?? "")) return w;
    if (known.has(w)) return w;
    // A unit after a number or a conversion: "5 cm", "5 cm to inch", "3kg".
    if (w.length > 1 && isUnit?.(w) && /(?:[0-9.)]\s*|\b(?:to|in)\s+)$/.test(all.slice(0, at))) return w;
    // A word of three letters or more right before a bracket is a function
    // the learner meant to call ("arcsinus(…)", "foo(2)"): kept whole, so they
    // are told that name is unknown instead of getting a product of letters.
    //   (Unless it hides a known one: "xsin(x)" is x·sin(x).)
    if (/^[A-Za-z]+$/.test(w)) {
      const parts = splitWord(w, known);
      const hidesKnown = parts.some((p) => p.length > 1);
      if (w.length >= 3 && !hidesKnown && /^\s*\(/.test(all.slice(at + w.length))) return w;
      return parts.join(" ");
    }
    // cos2x → cos 2x (handled as "cos" applied to "2x" below); x1, a_2 stay.
    const m = /^([A-Za-z]+)(\d.*)$/.exec(w);
    if (m && BUILTIN.has(m[1]) && FUNCTIONS.includes(m[1] as (typeof FUNCTIONS)[number])) return `${m[1]} ${m[2]}`;
    return w;
  });

  // 2. A function written without brackets: sin x, cos 2x, ln x², sin 30°.
  //    The argument is one term: a number, a letter, an exponent.
  //    Only the built-in ones: "f x" is more likely a typo than f applied to x.
  const fnAlt = [...FUNCTIONS].sort((a, b) => b.length - a.length).join("|");
  const bare = new RegExp(
    `\\b(${fnAlt})\\s+(?!\\()((?:\\d+(?:\\.\\d+)?)?\\s*(?:pi|[A-Za-z](?![A-Za-z0-9_(]))?(?:\\s*\\^\\s*(?:-?\\d+(?:\\.\\d+)?|[A-Za-z]|\\([^()]*\\)))?(?:\\s*deg\\b)?)`,
    "g",
  );
  s = s.replace(bare, (all, fn: string, arg: string) => (arg.trim() ? `${fn}(${arg.trim()})` : all));

  // 3. A letter before a bracket that is NOT a function is a product: x(x + 1).
  //    (2x(x + 1) too: a digit before the letter does not make it a name.)
  s = s.replace(/(^|[^A-Za-z_])([A-Za-z])\s*\(/g, (all, before: string, letter: string) =>
    functions.has(letter) ? all : `${before}${letter}*(`,
  );
  return s;
}

/** Symbol-level translation: the notation, not the meaning. */
export function normalizeMath(input: string, opts: NormalizeOptions = {}): string {
  let s = input.trim();
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙⋅]/g, "*")
    .replace(/÷/g, "/")
    // Spaced, or "2πr" reads as one variable called "pir".
    .replace(/π/g, " pi ")
    .replace(/∞/g, " Infinity ")
    .replace(/°/g, " deg")
    .replace(/[₀-₉]+/g, (m) => `_${[...m].map((c) => SUB[c]).join("")}`);
  // x² → x^2, x⁻¹ → x^(-1)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => {
    const v = [...m].map((c) => SUPER[c]).join("");
    return v.startsWith("-") ? `^(${v})` : `^${v}`;
  });
  s = decimalCommas(s);
  // ∛(…) → cbrt(…); √(…) → sqrt(…); √16 / √x → sqrt(16) / sqrt(x)
  s = s.replace(/∛\s*\(/g, "cbrt(").replace(/∛\s*([0-9.]+|[A-Za-z]\w*)/g, "cbrt($1)");
  s = s.replace(/√\s*\(/g, "sqrt(").replace(/√\s*([0-9.]+|[A-Za-z]\w*)/g, "sqrt($1)");
  for (const [re, to] of WORD_FUNCTIONS) s = s.replace(re, to);
  // |x - 2| → abs(x - 2)  (one level; nested bars are rare at school)
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");

  const functions = new Set<string>(opts.functions ?? DEFAULT_FUNCTION_LETTERS);
  const known = new Set<string>([...BUILTIN, ...(opts.names ?? []), ...functions]);
  s = readNames(s, known, functions, opts.isUnit);
  return s.replace(/ {2,}/g, " ").trim();
}

export type MathLine =
  | { kind: "expr"; src: string }
  | { kind: "derivative"; inner: string; v: string | null }
  | { kind: "simplify"; inner: string }
  | { kind: "solve"; lhs: string; rhs: string; v: string | null }
  | { kind: "integral"; inner: string; v: string | null; a: string; b: string }
  | { kind: "primitive"; inner: string; v: string | null }
  | { kind: "limit"; inner: string; v: string | null; at: string };

const OF = "(?:de |d['’]|of |von |der |del )?";
const DERIVATIVE = new RegExp(`^(?:d[ée]riv[ée]e?s?|derivative|derivada|ableitung|d\\/d([a-z]))\\s*${OF}\\s*`, "i");
const SIMPLIFY = new RegExp(`^(?:simplifi(?:er|e)|simplify|simplificar|vereinfache)\\s*${OF}\\s*`, "i");
const SOLVE = /^(?:r[ée]soudre|r[ée]sous|solve|resolver|resuelve|l[öo]se|loese)\s*/i;
const INTEGRAL = new RegExp(`^(?:int[ée]grale?|integral|integrale|∫)\\s*${OF}\\s*`, "i");
const PRIMITIVE = new RegExp(`^(?:primitive|antiderivative|primitiva|antiderivada|stammfunktion)\\s*${OF}\\s*`, "i");
const LIMIT = new RegExp(`^(?:limite|limit|l[ií]mite|grenzwert|lim)\\s*${OF}\\s*`, "i");

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

/** Split on commas that are not inside brackets: "x², 0, 1" → three parts. */
function topLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of s) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** `"x^3", "x"` — the math.js way of writing a derivative's arguments. */
function quotedArgs(s: string): { inner: string; v: string | null } | null {
  const m = /^"([^"]+)"\s*(?:,\s*"([a-zA-Z])")?$/.exec(s.trim());
  return m ? { inner: m[1], v: m[2] ?? null } : null;
}

const FROM = "(?:de|from|desde|von|entre|between|zwischen)";
const TO = "(?:à|a|to|hasta|bis|et|and|y|und)";

/**
 * The bounds of an interval, every way a student writes one: "0..2", "0 ; 2",
 * "[0 ; 2]", "de 0 à 2", "from 0 to 2", "von 0 bis 2". Returns the raw bound
 * texts (they may be expressions: π, 2π, -1/2).
 */
export function parseBounds(text: string): [string, string] | null {
  const t = text
    .trim()
    .replace(new RegExp(`^(?:${FROM}|sur|on|en|auf|über|in)\\s+`, "i"), "")
    .replace(/^\[\s*(.*?)\s*\]$/, "$1")
    .trim();
  let m = /^(.+?)\s*(?:\.\.|;)\s*(.+)$/.exec(t);
  if (!m) m = new RegExp(`^(.+?)\\s+${TO}\\s+(.+)$`, "i").exec(t);
  if (!m) {
    const parts = topLevelCommas(t);
    if (parts.length === 2 && parts.every(Boolean)) return [parts[0], parts[1]];
    return null;
  }
  return [m[1].trim(), m[2].trim()];
}

/** "x² de 0 à 1", "x² dx from 0 to 1", "(x², 0, 1)", "x² sur [0 ; 1]". */
function integralParts(rest: string): { inner: string; v: string | null; a: string; b: string } | null {
  const body = rest.trim();
  // The bracket form first: integral(x², 0, 1).
  const args = topLevelCommas(unwrap(body));
  if (args.length === 3 && args.every(Boolean)) {
    const d = /\s*d([a-z])$/.exec(args[0]);
    return { inner: d ? args[0].slice(0, d.index) : args[0], v: d?.[1] ?? null, a: args[1], b: args[2] };
  }
  const m =
    new RegExp(`^(.+?)\\s+(${FROM}\\s+.+)$`, "i").exec(body) ??
    new RegExp(`^(.+?)\\s+((?:sur|on|en|auf|über|in)?\\s*\\[.+\\])$`, "i").exec(body);
  if (!m) return null;
  const bounds = parseBounds(m[2]);
  if (!bounds) return null;
  let inner = m[1].trim();
  const d = /\s*d([a-z])$/.exec(inner);
  if (d) inner = inner.slice(0, d.index);
  return { inner: unwrap(inner), v: d?.[1] ?? null, a: bounds[0], b: bounds[1] };
}

/** "sin(x)/x quand x tend vers 0", "1/x en +∞", "x → 0 sin(x)/x", "(1/x, x, 0)". */
function limitParts(rest: string): { inner: string; v: string | null; at: string } | null {
  const body = rest.trim();
  let m = /^([a-z])\s*(?:→|->|tend vers|tends to)\s*(\S+)\s+(.+)$/i.exec(body);
  if (m) return { inner: unwrap(m[3]), v: m[1], at: m[2] };
  m =
    /^(.+?)\s*,?\s+(?:quand|lorsque|when|as|cuando|f[üu]r|for)\s+([a-z])\s*(?:tend vers|→|->|tends to|approaches|goes to|tiende a|gegen|geht gegen)\s*(.+)$/i.exec(
      body,
    );
  if (m) return { inner: unwrap(m[1]), v: m[2], at: m[3].trim() };
  m = /^(.+?)\s+(?:en|at|in|bei|à)\s+(\S+)$/i.exec(body);
  if (m) return { inner: unwrap(m[1]), v: null, at: m[2] };
  const args = topLevelCommas(unwrap(body));
  if (args.length === 3 && /^[a-z]$/.test(args[1])) return { inner: args[0], v: args[1], at: args[2] };
  if (args.length === 2 && args.every(Boolean)) return { inner: args[0], v: null, at: args[1] };
  return null;
}

/** A name being given a value (`a = 3`, `f(x) = x²`) rather than an equation. */
const ASSIGNMENT = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(\(\s*[A-Za-z]\s*\))?\s*=(?!=)/;

/** Functions a student uses but never defines: "cos(x) = x" is an equation. */
const KNOWN_FUNCTIONS = new Set([...FUNCTIONS, "ln", "arcsin", "arccos", "arctan"]);

/** The name a line defines, and whether it is a function: `f(x) = …` → f. */
export function definedName(raw: string): { name: string; fn: boolean } | null {
  const m = ASSIGNMENT.exec(raw);
  if (!m || KNOWN_FUNCTIONS.has(m[1].toLowerCase())) return null;
  return { name: m[1], fn: Boolean(m[2]) };
}

/**
 * What one calculator line asks for. Words are recognised in the four
 * interface languages; a bare equation ("2x + 3 = 7") is a request to solve it.
 * `opts` carries the names earlier lines defined, so they are read whole.
 */
export function readLine(raw: string, opts: NormalizeOptions = {}): MathLine {
  const line = raw.trim();
  const norm = (s: string) => normalizeMath(s, opts);

  let m = DERIVATIVE.exec(line);
  if (m && line.length > m[0].length) {
    const rest = unwrap(line.slice(m[0].length));
    const q = quotedArgs(rest);
    return { kind: "derivative", inner: norm(q ? q.inner : rest), v: q?.v ?? m[1] ?? null };
  }
  m = SIMPLIFY.exec(line);
  if (m && line.length > m[0].length) {
    const rest = unwrap(line.slice(m[0].length));
    return { kind: "simplify", inner: norm(quotedArgs(rest)?.inner ?? rest) };
  }
  m = PRIMITIVE.exec(line);
  if (m && line.length > m[0].length) {
    let rest = unwrap(line.slice(m[0].length));
    const d = /\s*d([a-z])$/.exec(rest);
    if (d) rest = rest.slice(0, d.index);
    return { kind: "primitive", inner: norm(unwrap(rest)), v: d?.[1] ?? null };
  }
  m = INTEGRAL.exec(line);
  if (m && line.length > m[0].length) {
    const p = integralParts(line.slice(m[0].length));
    if (p) return { kind: "integral", inner: norm(p.inner), v: p.v, a: norm(p.a), b: norm(p.b) };
    // No bounds: what they want is a primitive.
    let rest = unwrap(line.slice(m[0].length));
    const d = /\s*d([a-z])$/.exec(rest);
    if (d) rest = rest.slice(0, d.index);
    return { kind: "primitive", inner: norm(unwrap(rest)), v: d?.[1] ?? null };
  }
  m = LIMIT.exec(line);
  if (m && line.length > m[0].length) {
    const p = limitParts(line.slice(m[0].length));
    if (p) return { kind: "limit", inner: norm(p.inner), v: p.v, at: p.at };
  }
  m = SOLVE.exec(line);
  const body = m ? unwrap(line.slice(m[0].length)) : line;
  const eq = body.split("=");
  const isEquation = eq.length === 2 && !body.includes("==") && !/[<>]=/.test(body) && eq[1].trim() !== "";
  if (m || (isEquation && !definedName(body))) {
    const [lhs, rhs] = isEquation ? eq : [body, "0"];
    return { kind: "solve", lhs: norm(lhs), rhs: norm(rhs), v: null };
  }
  // A definition keeps its own name whole: `rayon = 3`, `aire(r) = π r²`.
  const def = definedName(line);
  if (def) {
    const eqAt = line.indexOf("=");
    const lhs = line.slice(0, eqAt).trim();
    const param = /\(\s*([A-Za-z])\s*\)/.exec(lhs)?.[1];
    const names = [...(opts.names ?? []), def.name, ...(param ? [param] : [])];
    const functions = [...(opts.functions ?? []), ...(def.fn ? [def.name] : [])];
    return { kind: "expr", src: `${lhs} = ${normalizeMath(line.slice(eqAt + 1), { names, functions })}` };
  }
  return { kind: "expr", src: norm(line) };
}

/** A limit's target as written ("0", "+∞", "-inf", "l'infini") → a math.js expression or ±Infinity. */
export function limitTarget(at: string): { value: string; side: "both" | "left" | "right" } {
  let t = at.trim().replace(/[.!]+$/, "");
  let side: "both" | "left" | "right" = "both";
  // 0⁺ / 0+ / 0^+ : from the right; 0⁻ / 0- : from the left.
  const s = /^(.+?)\s*\^?\s*([+⁺]|[-⁻−])$/.exec(t);
  if (s && !/^[+-]?\s*(?:∞|inf|infinity|l['’]infini|infini|unendlich|infinito)$/i.test(t)) {
    t = s[1];
    side = /[+⁺]/.test(s[2]) ? "right" : "left";
  }
  if (/^\+?\s*(?:∞|inf|infinity|l['’]infini|\+?infini|unendlich|infinito)$/i.test(t)) return { value: "Infinity", side };
  if (/^[-−]\s*(?:∞|inf|infinity|l['’]infini|infini|unendlich|infinito)$/i.test(t)) return { value: "-Infinity", side };
  return { value: normalizeMath(t), side };
}
