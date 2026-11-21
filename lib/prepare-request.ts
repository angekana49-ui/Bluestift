/**
 * The ```prepare block: Raya for Schools proposing class material the teacher
 * asked for — an exam, an exercise set, a worksheet or a quiz — which the chat
 * shows as a card with a "Create in Prepare" button
 * (components/chat/prepare-request-card.tsx).
 *
 * The staff-side mirror of lib/tool-request.ts, and deliberately NOT the same
 * block: a teacher's account already opens the solo Tools page with its four
 * generators, so re-teaching ```create here would duplicate that surface.
 * ```prepare runs the Prepare route instead (grounded in the class's real
 * gaps), lands in the Prepare library, and can be assigned to a class.
 *
 * Nothing is created by the block itself. The teacher presses the button, and
 * only then does the Prepare route run, with its quota and its checks. A reply
 * can carry an instruction to the rest of the app without the app ever acting
 * on a model's say-so.
 *
 *   ```prepare
 *   kind: quiz
 *   topic: Les fractions, 5e
 *   from: topic
 *   count: 10
 *   ```
 *
 * Pure and dependency-free: it runs on every streamed chunk.
 */

export const PREPARE_REQUEST_LANG = "prepare";

export type PrepareKind = "exam" | "exercise" | "worksheet" | "quiz";

export type PrepareRequest = {
  kind: PrepareKind;
  /** Always given: the card's subtitle, and the topic line of the generation. */
  topic: string;
  /**
   * What it is built from besides the class gaps (which always ground it when
   * a class is picked): the thread it was asked in, or just the topic. Topic
   * is the default — a staff thread is analytics chatter, not study material,
   * so it only feeds the generation when Raya says it holds what matters.
   */
  from: "conversation" | "topic";
  /** 1-20, default 8 — same clamp as the Prepare tab. */
  count: number;
};

export function isPrepareRequestLang(lang: string | null): boolean {
  return lang === PREPARE_REQUEST_LANG;
}

/** Every way the model (or a teacher's language) may name a kind. */
const KINDS: [RegExp, PrepareKind][] = [
  [/^(?:exam|exams?|examen|ex[aá]menes|pr[üü]fung|klausur)$/i, "exam"],
  [/^(?:exercise|exercices?|exercice|ejercicios?|devoirs?|hausaufgaben?|[üu]bungen?)$/i, "exercise"],
  [/^(?:worksheet|fiche|fiches?(?: de cours)?|fichas?|arbeitsbl[äa]tt(?:er)?)$/i, "worksheet"],
  [/^(?:quiz|quizz|qcm|test|cuestionario|prueba)$/i, "quiz"],
];

/** The request a block describes, or null when it does not name a kind and a topic. */
export function parsePrepareRequest(src: string): PrepareRequest | null {
  const fields: Record<string, string> = {};
  for (const line of src.split(/\r?\n/)) {
    const m = /^\s*([a-z_]+)\s*:\s*(.+?)\s*$/i.exec(line);
    if (m) fields[m[1].toLowerCase()] = m[2];
  }
  const kindName = (fields.kind ?? fields.type ?? "").trim();
  const kind = KINDS.find(([re]) => re.test(kindName))?.[1];
  const topic = (fields.topic ?? fields.subject ?? fields.sujet ?? "").replace(/^["'«“]\s*|\s*["'»”]$/g, "").trim().slice(0, 200);
  if (!kind || topic.length < 2) return null;
  const from = /^(?:conversation|discussion|conversa|hilo|gespr[äa]ch|chat)$/i.test((fields.from ?? "").trim())
    ? "conversation"
    : "topic";
  const count = Math.min(Math.max(parseInt((fields.count ?? "").trim(), 10) || 8, 1), 20);
  return { kind, topic, from, count };
}
