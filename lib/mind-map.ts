/**
 * A generated mind map's shape, shared by the generator (the route), the
 * player and the export.
 *
 * Owner, 2026-10-06: "trop courte, assez peu illustrative, assez peu de
 * steps". The first version was a title and 4-7 branches of bare 2-word
 * labels — a table of contents, not a map you can revise from. A branch now
 * carries an emoji that pictures it, a one-line gist, and points that each
 * say WHAT the thing is (a definition, an example, a formula, a date), and the
 * branches come in the order to learn them: the route the player draws.
 *
 * Maps stored before this (children as plain strings, no gist) still open:
 * `normalizeMindMap` reads both.
 */

export type MindMapPoint = { label: string; detail?: string };
export type MindMapBranch = { label: string; emoji?: string; gist?: string; children: MindMapPoint[] };
export type MindMap = { title: string; overview?: string; branches: MindMapBranch[] };

/** What the generator asks for. Kept here so the test can hold it to its numbers. */
export const MIND_MAP_PROMPT =
  "You are a mind-map generator for a student revising. From the study material, produce a RICH mind map in the SAME language as the material. " +
  "A central title and a one-sentence overview of the whole subject. Then 6 to 9 main branches, ordered as a learning path (what to understand first comes first). " +
  "Each branch has: a short label (2-5 words); ONE emoji that pictures it; a one-sentence gist (max 20 words); and 3 to 5 points. " +
  "Each point has a short label (2-6 words) and a detail (max 18 words) that teaches something concrete: a definition, an example, a formula, a date, a cause or a consequence — never a restatement of the label. " +
  "Cover the whole material, not just its start. Any formula goes in LaTeX between $...$. Return a JSON object shaped exactly as: " +
  '{"title":"...","overview":"...","branches":[{"label":"...","emoji":"🔬","gist":"...","children":[{"label":"...","detail":"..."}]}]}';

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * One emoji (or a short emoji sequence), never words: a model asked for a
 * picture sometimes writes "science" instead, and a word in the marker is
 * worse than none.
 */
function emojiOf(v: unknown): string | undefined {
  const s = str(v, 16);
  if (!s || /[\p{L}\p{N}]/u.test(s.replace(/\p{Extended_Pictographic}|️|‍/gu, ""))) return undefined;
  return /\p{Extended_Pictographic}/u.test(s) ? s : undefined;
}

/** A stored or freshly generated map, whatever its age, in the current shape. */
export function normalizeMindMap(raw: unknown, fallbackTitle = ""): MindMap {
  const o = (raw ?? {}) as Record<string, unknown>;
  const branches = (Array.isArray(o.branches) ? o.branches : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && typeof (b as { label?: unknown }).label === "string")
    .map((b) => ({
      label: str(b.label, 80),
      emoji: emojiOf(b.emoji),
      gist: str(b.gist, 240) || undefined,
      children: (Array.isArray(b.children) ? b.children : [])
        .map((c): MindMapPoint | null => {
          if (typeof c === "string") return c.trim() ? { label: str(c, 120) } : null;
          if (c && typeof c === "object" && typeof (c as { label?: unknown }).label === "string") {
            const p = c as Record<string, unknown>;
            return { label: str(p.label, 120), detail: str(p.detail, 240) || undefined };
          }
          return null;
        })
        .filter((c): c is MindMapPoint => !!c && !!c.label),
    }))
    .filter((b) => b.label);
  return { title: str(o.title, 120) || fallbackTitle, overview: str(o.overview, 300) || undefined, branches };
}

/** The map as the branded document's Markdown body (TXT / PDF export). */
export function mindMapToMd(m: MindMap): string {
  const head = `# ${m.title}${m.overview ? `\n\n${m.overview}` : ""}`;
  const branches = m.branches
    .map((b, i) => {
      const title = `## ${i + 1}. ${b.emoji ? `${b.emoji} ` : ""}${b.label}`;
      const gist = b.gist ? `\n${b.gist}` : "";
      const points = b.children.map((c) => `- **${c.label}**${c.detail ? ` — ${c.detail}` : ""}`).join("\n");
      return `${title}${gist}\n${points}`;
    })
    .join("\n\n");
  return `${head}\n\n${branches}`;
}
