/**
 * A small, dependency-free Markdown parser for Raya's replies.
 *
 * Why not a library: this parses text that ARRIVES ONE CHUNK AT A TIME (the
 * chat streams), on devices and connections where every kilobyte of bundle is
 * a real cost. So it is (a) tiny, (b) pure and synchronous, and (c) LENIENT —
 * a half-finished `**bold` or an unclosed ``` fence mid-stream must still
 * render as readable text, never swallow the rest of the reply.
 *
 * Scope is what a tutor actually writes: headings, emphasis, code, lists,
 * tables, quotes, and maths. It is deliberately NOT CommonMark: no HTML
 * passthrough (which would be an injection surface for model output), no
 * reference links, no nested lists.
 *
 * `lib/doc-format.ts` stays as it is — it serves the PDF/TXT exporters, a
 * different medium with different constraints.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "math"; v: string };

export type Align = "left" | "center" | "right";

export type Block =
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; start: number; items: Inline[][] }
  /** `open`: the closing fence has not arrived yet (the reply is still streaming). */
  | { t: "code"; lang: string | null; v: string; open?: boolean }
  | { t: "quote"; c: Inline[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][]; align: Align[] }
  | { t: "mathBlock"; v: string }
  | { t: "hr" };

// ── Inline ────────────────────────────────────────────────────────────────

/**
 * Is `$…$` here really maths, or is it money? "$5 and $12" must stay text.
 * Rule: the content carries LaTeX punctuation or an equation sign, or it has
 * no space at all. Models do write "$ x^2 + 1 $" with spaces inside the
 * delimiters; that is maths all the same.
 */
function looksLikeMath(body: string): boolean {
  if (!body.trim()) return false;
  if (/[\\^_{}=<>]/.test(body)) return true;
  return !/\s/.test(body);
}

const ESCAPABLE = "\\`*_{}[]()#+-.!$>~|";

/** Parse one line (or table cell) of inline markup. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  let i = 0;

  const flush = () => {
    if (text) {
      out.push({ t: "text", v: text });
      text = "";
    }
  };
  /** Find a closing delimiter; -1 when this run is unterminated (streaming). */
  const closer = (mark: string, from: number) => src.indexOf(mark, from);

  while (i < src.length) {
    const ch = src[i];

    // Inline maths in \( … \) form. Checked BEFORE the escape rule below,
    // which would otherwise swallow the opening delimiter as an escaped "(".
    if (ch === "\\" && src[i + 1] === "(") {
      const end = src.indexOf("\\)", i + 2);
      if (end > i) {
        flush();
        out.push({ t: "math", v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // Backslash escape — the only way to type a literal * or $.
    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }

    // Inline code first: everything inside a code span is literal.
    if (ch === "`") {
      const end = closer("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // $$…$$ in the middle of a sentence: maths, set inline.
    if (ch === "$" && src[i + 1] === "$") {
      const end = src.indexOf("$$", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "math", v: src.slice(i + 2, end).trim() });
        i = end + 2;
        continue;
      }
    }

    // Inline maths: $…$ or \(…\).
    if (ch === "$") {
      const end = closer("$", i + 1);
      if (end > i) {
        const body = src.slice(i + 1, end);
        if (looksLikeMath(body)) {
          flush();
          out.push({ t: "math", v: body.trim() });
          i = end + 1;
          continue;
        }
      }
    }
    // Bold, italic, strikethrough. Longest delimiter first so ** wins over *.
    const runs: [string, "strong" | "em" | "del"][] = [
      ["***", "strong"],
      ["**", "strong"],
      ["~~", "del"],
      ["*", "em"],
      ["__", "strong"],
      ["_", "em"],
    ];
    let matched = false;
    for (const [mark, type] of runs) {
      if (!src.startsWith(mark, i)) continue;
      // `_` only delimits at a word boundary, so snake_case_names survive.
      if (mark === "_" && /\w/.test(src[i - 1] ?? "")) continue;
      const end = closer(mark, i + mark.length);
      if (end < 0) continue; // unterminated: treat as literal text
      const inner = src.slice(i + mark.length, end);
      if (!inner) continue;
      flush();
      out.push({ t: type, c: parseInline(inner) });
      i = end + mark.length;
      matched = true;
      break;
    }
    if (matched) continue;

    // [label](href) — http(s) and mailto only; anything else stays as text so a
    // model can't emit a javascript: URL into the thread.
    if (ch === "[") {
      const close = src.indexOf("]", i);
      if (close > i && src[close + 1] === "(") {
        const paren = src.indexOf(")", close + 2);
        if (paren > close) {
          const href = src.slice(close + 2, paren).trim();
          if (/^(https?:\/\/|mailto:)/i.test(href)) {
            flush();
            out.push({ t: "link", href, c: parseInline(src.slice(i + 1, close)) });
            i = paren + 1;
            continue;
          }
        }
      }
    }

    text += ch;
    i++;
  }
  flush();
  return out;
}

// ── Blocks ────────────────────────────────────────────────────────────────

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function alignOf(sep: string): Align[] {
  return splitRow(sep).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

/** Markdown → blocks. Never throws; unterminated constructs render as-is. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ t: "p", c: parseInline(para.join(" ").trim()) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      continue;
    }

    // Fenced code. An unclosed fence (still streaming) takes the rest.
    const fence = /^\s*```(\w+)?\s*$/.exec(line);
    if (fence) {
      flushPara();
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) body.push(lines[j++]);
      blocks.push({
        t: "code",
        lang: fence[1] ?? null,
        v: body.join("\n"),
        ...(j >= lines.length ? { open: true } : {}),
      });
      i = j;
      continue;
    }

    // Display maths: $$…$$ or \[…\], on one line or spanning several, with
    // the formula allowed to start on the opener's line and end on the
    // closer's ("$$\begin{cases} … \end{cases}$$" — how models write a system).
    // An unclosed one (still streaming) takes the rest.
    const opener = /^\s*(\$\$|\\\[)(.*)$/.exec(line);
    if (opener) {
      flushPara();
      const closeMark = opener[1] === "$$" ? "$$" : "\\]";
      const body: string[] = [];
      let rest = opener[2];
      let j = i;
      let after = "";
      for (;;) {
        const at = rest.indexOf(closeMark);
        if (at >= 0) {
          body.push(rest.slice(0, at));
          after = rest.slice(at + closeMark.length).trim();
          break;
        }
        body.push(rest);
        if (++j >= lines.length) break;
        rest = lines[j];
      }
      const v = body.join("\n").trim();
      if (v) blocks.push({ t: "mathBlock", v });
      // "$$x = 2$$." — the full stop is not worth a paragraph of its own.
      if (after && !/^[.,;:!?]+$/.test(after)) blocks.push({ t: "p", c: parseInline(after) });
      i = j;
      continue;
    }
    // A bare environment with no dollars around it: \begin{pmatrix} … \end{pmatrix}.
    const env = /^\s*\\begin\{([a-zA-Z*]+)\}/.exec(line);
    if (env) {
      flushPara();
      const end = `\\end{${env[1]}}`;
      const body: string[] = [];
      let j = i;
      while (j < lines.length) {
        body.push(lines[j]);
        if (lines[j].includes(end)) break;
        j++;
      }
      blocks.push({ t: "mathBlock", v: body.join("\n").trim() });
      i = Math.min(j, lines.length - 1);
      continue;
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushPara();
      blocks.push({ t: "hr" });
      continue;
    }

    const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ t: "h", level, c: parseInline(heading[2].trim()) });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const body: string[] = [];
      let j = i;
      while (j < lines.length && /^\s*>\s?/.test(lines[j])) {
        body.push(lines[j].replace(/^\s*>\s?/, ""));
        j++;
      }
      blocks.push({ t: "quote", c: parseInline(body.join(" ").trim()) });
      i = j - 1;
      continue;
    }

    // Table: a header row followed by a |---|---| separator.
    if (trimmed.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushPara();
      const align = alignOf(lines[i + 1]);
      const head = splitRow(line).map(parseInline);
      const rows: Inline[][][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().includes("|")) {
        rows.push(splitRow(lines[j]).map(parseInline));
        j++;
      }
      blocks.push({ t: "table", head, rows, align });
      i = j - 1;
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = Boolean(ordered);
      const start = ordered ? Number(ordered[1]) : 1;
      const items: Inline[][] = [];
      let j = i;
      while (j < lines.length) {
        const b = BULLET.exec(lines[j]);
        const o = ORDERED.exec(lines[j]);
        if (isOrdered ? !o : !b) break;
        items.push(parseInline((isOrdered ? o![2] : b![1]).trim()));
        j++;
      }
      blocks.push({ t: "list", ordered: isOrdered, start, items });
      i = j - 1;
      continue;
    }

    para.push(trimmed);
  }

  flushPara();
  return blocks;
}

/** Cheap pre-check: is it worth parsing at all? */
export function hasMarkup(src: string): boolean {
  return /[*_`#>|$\\[]|^\s*\d+[.)]\s|\n\s*[-*+]\s/m.test(src);
}
