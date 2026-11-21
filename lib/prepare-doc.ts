import type { MessageKey } from "@/lib/i18n";

type Tr = (key: MessageKey, vars?: Record<string, string | number>) => string | Promise<string>;

/** One generated item, after the model's JSON has been normalized. */
export type PrepareQuestion = {
  prompt: string;
  choices?: string[];
  answer?: string;
  concept?: string;
  /** Exam points. Other kinds ignore it — it only renders on an exam. */
  points?: number;
};

/**
 * One raw model item → a usable question, or null when it has no prompt (an
 * empty item must never render as a numbered blank line). Lenient about
 * everything else: choices may be missing (open items), answers may be
 * missing (nothing to key), points are integers ≥ 1 or dropped.
 */
export function normalizePrepareQuestion(q: unknown): PrepareQuestion | null {
  if (!q || typeof q !== "object") return null;
  const r = q as { prompt?: unknown; choices?: unknown; answer?: unknown; concept?: unknown; points?: unknown };
  const prompt = typeof r.prompt === "string" ? r.prompt.trim().slice(0, 1000) : "";
  if (!prompt) return null;
  const out: PrepareQuestion = { prompt };
  if (Array.isArray(r.choices)) {
    const choices = r.choices
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim().slice(0, 500))
      .slice(0, 6);
    if (choices.length > 0) out.choices = choices;
  }
  if (typeof r.answer === "string" && r.answer.trim()) out.answer = r.answer.trim().slice(0, 1000);
  if (typeof r.concept === "string" && r.concept.trim()) out.concept = r.concept.trim().slice(0, 120);
  if (typeof r.points === "number" && Number.isFinite(r.points)) {
    const p = Math.min(Math.max(Math.floor(r.points), 1), 100);
    out.points = p;
  }
  return out;
}

/**
 * A generated resource as the Markdown document the teacher reads, downloads
 * and prints. Each kind has its own shape — a worksheet is a recap plus
 * practice, an exam carries points and a marking scheme — because four kinds
 * rendering as "Questions + Answer key" read as four quizzes.
 *
 * Headers are localized: the document is handed to francophone teachers as
 * often as anglophone ones, and "Answer key" is not a French word.
 */
export async function composePrepareMarkdown(
  kind: string,
  title: string,
  instructions: string,
  questions: PrepareQuestion[],
  tr: Tr,
): Promise<string> {
  const head = [`# ${title}`, "", instructions.trim()].join("\n");
  const letters = ["A", "B", "C", "D", "E", "F"];
  const pts = async (n: number | undefined) => (n ? ` (${await tr("school.prepare.doc.points", { n })})` : "");
  const renderChoices = (q: PrepareQuestion) => (q.choices?.length ? q.choices.map((c, j) => `   - ${letters[j] ?? "?"}. ${c}`) : []);
  // The key only renders when something has an answer — a key of "(open)"
  // placeholders helps nobody.
  const keyed = questions.filter((q) => q.answer);
  if (kind === "exam") {
    const lines: string[] = [];
    for (const [i, q] of questions.entries()) {
      const item = `${i + 1}.${await pts(q.points)} ${q.prompt}`;
      lines.push("", item, ...renderChoices(q));
    }
    const total = questions.reduce((s, q) => s + (q.points ?? 0), 0);
    const scheme: string[] = [];
    for (const q of keyed) {
      scheme.push(`${questions.indexOf(q) + 1}.${await pts(q.points)} ${q.answer}`);
    }
    return [
      head,
      "",
      `## ${await tr("school.prepare.doc.exam")}`,
      ...lines,
      ...(total > 0 ? ["", await tr("school.prepare.doc.totalPoints", { n: total })] : []),
      ...(scheme.length ? ["", `## ${await tr("school.prepare.doc.markingScheme")}`, ...scheme] : []),
    ].join("\n");
  }
  const itemsHeader =
    kind === "exercise"
      ? await tr("school.prepare.doc.exercises")
      : kind === "worksheet"
        ? await tr("school.prepare.doc.practice")
        : await tr("school.prepare.doc.questions");
  const keyHeader =
    kind === "exercise"
      ? await tr("school.prepare.doc.solutions")
      : kind === "worksheet"
        ? await tr("school.prepare.doc.answers")
        : await tr("school.prepare.doc.answerKey");
  const lines: string[] = [];
  questions.forEach((q, i) => {
    lines.push("", `${i + 1}. ${q.prompt}`, ...renderChoices(q));
  });
  const key = keyed.map((q) => `${questions.indexOf(q) + 1}. ${q.answer}`);
  return [head, "", `## ${itemsHeader}`, ...lines, ...(key.length ? ["", `## ${keyHeader}`, ...key] : [])].join("\n");
}
