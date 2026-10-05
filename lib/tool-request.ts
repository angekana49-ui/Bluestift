/**
 * The ```create block: Raya proposing a study tool the learner asked for — a
 * quiz, a summary, flashcards or a mind map — which the chat shows as a card
 * with a "Create in Tools" button (components/chat/tool-request-card.tsx).
 *
 * Nothing is created by the block itself. The learner presses the button, and
 * only then does the Tools route run, with its quota and its checks. That is
 * the whole design: a reply can carry an instruction to the rest of the app
 * without the app ever acting on a model's say-so.
 *
 *   ```create
 *   tool: quiz
 *   from: conversation
 *   topic: Les dérivées, niveau 1re
 *   ```
 *
 * Pure and dependency-free: it runs on every streamed chunk.
 */

export const TOOL_REQUEST_LANG = "create";

export type ToolKind = "quiz" | "summary" | "flashcards" | "mind_map";

export type ToolRequest = {
  tool: ToolKind;
  /** What it is built from: what was just studied, or a subject (its Wikipedia article). */
  from: "conversation" | "topic";
  /** Always given: the card's subtitle, and the source when `from` is topic or no conversation is at hand. */
  topic: string;
};

export function isToolRequestLang(lang: string | null): boolean {
  return lang === TOOL_REQUEST_LANG;
}

/** Every way the model (or a learner's language) may name a tool. */
const TOOLS: [RegExp, ToolKind][] = [
  [/^(?:quiz|qcm|quizz|test|cuestionario|prueba)$/i, "quiz"],
  [/^(?:summary|r[ée]sum[ée]|resumen|zusammenfassung|synth[eè]se)$/i, "summary"],
  [/^(?:flashcards?|fiches?|fiches de r[ée]vision|tarjetas|karteikarten)$/i, "flashcards"],
  [/^(?:mind[_ -]?map|carte mentale|mapa mental|mindmap)$/i, "mind_map"],
];

/** The request a block describes, or null when it does not name a tool and a topic. */
export function parseToolRequest(src: string): ToolRequest | null {
  const fields: Record<string, string> = {};
  for (const line of src.split(/\r?\n/)) {
    const m = /^\s*([a-z_]+)\s*:\s*(.+?)\s*$/i.exec(line);
    if (m) fields[m[1].toLowerCase()] = m[2];
  }
  const toolName = (fields.tool ?? fields.type ?? "").trim();
  const tool = TOOLS.find(([re]) => re.test(toolName))?.[1];
  const topic = (fields.topic ?? fields.subject ?? fields.sujet ?? "").replace(/^["'«“]\s*|\s*["'»”]$/g, "").trim().slice(0, 120);
  if (!tool || topic.length < 2) return null;
  const from = /^(?:topic|sujet|subject|tema|thema)$/i.test((fields.from ?? "").trim()) ? "topic" : "conversation";
  return { tool, from, topic };
}
