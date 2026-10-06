"use client";

import { netFetch } from "@/lib/net/client-fetch";
import { type BrandedDoc } from "@/lib/document";
import { parseDoc } from "@/lib/doc-format";
import { QuizPlayer, FlashcardsPlayer, ReaderView, MindMapView } from "@/components/study/focus-player";
import { DocumentActions } from "@/components/ui/doc-actions";
import { useTranslate } from "@/components/ui/locale";
import { normalizeMindMap, mindMapToMd, type MindMap } from "@/lib/mind-map";

/**
 * A generated study tool, opened full screen — the one renderer for a quiz, a
 * summary, flashcards or a mind map, wherever it was made. The Tools page and
 * the "Create in Tools" card in a Raya conversation both open this, so what a
 * learner gets from the chat is exactly what the Tools page would show them:
 * the same player, the same downloads, the same report to the Kernel.
 */

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
};
export type Flashcard = { front: string; back: string };
export type { MindMap, MindMapBranch } from "@/lib/mind-map";

/** What the full-screen focus player is showing. */
export type ActivePlayer =
  | { kind: "summary"; title: string; text: string }
  /** `outputId`: the stored quiz, so the result can be reported to the Kernel. */
  | { kind: "quiz"; title: string; questions: QuizQuestion[]; outputId?: string }
  | { kind: "flashcards"; title: string; cards: Flashcard[] }
  | { kind: "mind_map"; title: string; mindMap: MindMap };

/** A stored tool output (its type, id and content) as something to open. */
export function playerFor(toolType: string, id: string | undefined, content: unknown, title: string): ActivePlayer {
  const c = (content ?? {}) as Record<string, unknown>;
  if (toolType === "summary") return { kind: "summary", title, text: (c.text as string) ?? "" };
  if (toolType === "flashcards") return { kind: "flashcards", title, cards: (c.cards as Flashcard[]) ?? [] };
  if (toolType === "mind_map") {
    // Read through normalizeMindMap: maps stored before 2026-10-06 have bare string points.
    return { kind: "mind_map", title, mindMap: normalizeMindMap(c, title) };
  }
  return { kind: "quiz", title, questions: (c.questions as QuizQuestion[]) ?? [], outputId: id };
}

// Markdown composers → the branded document body (typeset by the exporter).
export function quizToMd(qs: QuizQuestion[]) {
  return qs
    .map((q, i) => {
      const opts = q.options
        .map((o, oi) => `- ${String.fromCharCode(65 + oi)}. ${o}${oi === q.correct_index ? " ✓" : ""}`)
        .join("\n");
      const ex = q.explanation ? `\nExplanation: ${q.explanation}` : "";
      return `## Question ${i + 1}\n${q.question}\n${opts}${ex}`;
    })
    .join("\n\n");
}

export function flashcardsToMd(cards: Flashcard[]) {
  return cards.map((c, i) => `## Card ${i + 1}\n**${c.front}**\n- ${c.back}`).join("\n\n");
}

export { mindMapToMd };

export function ToolPlayer({ player, onExit, studentName }: { player: ActivePlayer; onExit: () => void; studentName?: string }) {
  const tr = useTranslate();
  // Every tool export goes through the shared branded document (Raya logo,
  // title, footer attribution + thebluestift.com link).
  const doc = (title: string, body: string): BrandedDoc => ({
    brand: "raya",
    title,
    meta: new Date().toLocaleDateString(),
    audience: studentName || undefined,
    body,
  });
  // One row for every tool output: language, TXT, PDF, share. The language is
  // the point — a summary generated in English is downloadable in the four
  // shipped languages without regenerating it.
  const downloadActions = (d: BrandedDoc) => <DocumentActions doc={d} compact />;

  switch (player.kind) {
    case "quiz":
      return (
        <QuizPlayer
          title={player.title}
          mode="reveal"
          questions={player.questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correct_index,
            explanation: q.explanation,
          }))}
          onExit={onExit}
          // What the student picked goes to the Kernel (graded there against the
          // stored quiz, not this score) — a practice quiz is learning evidence.
          onFinished={(picks) => {
            if (!player.outputId) return;
            void netFetch(
              "/api/tools/quiz-result",
              { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outputId: player.outputId, picks }), keepalive: true },
              { timeoutMs: 10_000 },
            ).catch(() => {});
          }}
          actions={downloadActions(doc(player.title, quizToMd(player.questions)))}
        />
      );
    case "flashcards":
      return <FlashcardsPlayer title={player.title} cards={player.cards} onExit={onExit} actions={downloadActions(doc(player.title, flashcardsToMd(player.cards)))} />;
    case "summary":
      return (
        <ReaderView
          title={player.title}
          subtitle={tr("tools.pretty.summary")}
          blocks={parseDoc(player.text)}
          onExit={onExit}
          actions={downloadActions(doc(player.title, player.text))}
        />
      );
    case "mind_map":
      return <MindMapView title={player.title} mindMap={player.mindMap} onExit={onExit} actions={downloadActions(doc(player.title, mindMapToMd(player.mindMap)))} />;
  }
}
