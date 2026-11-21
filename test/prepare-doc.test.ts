import { describe, expect, it } from "vitest";

import { lookup } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { composePrepareMarkdown, normalizePrepareQuestion } from "@/lib/prepare-doc";

/**
 * The Prepare document composer: each kind must read as its own thing — an
 * exam carries points and a marking scheme, a worksheet recaps then drills.
 * Four kinds rendering as "Questions + Answer key" read as four quizzes.
 */

const tr = (key: MessageKey, vars?: Record<string, string | number>) => lookup("en", key, vars);
const trFr = (key: MessageKey, vars?: Record<string, string | number>) => lookup("fr", key, vars);

describe("normalizePrepareQuestion", () => {
  it("drops items without a prompt", () => {
    expect(normalizePrepareQuestion(null)).toBeNull();
    expect(normalizePrepareQuestion({})).toBeNull();
    expect(normalizePrepareQuestion({ prompt: "   " })).toBeNull();
  });

  it("keeps open items (no choices) and trims + caps fields", () => {
    const q = normalizePrepareQuestion({ prompt: "  Solve $x+1=2$.  ", answer: "x = 1" });
    expect(q).toEqual({ prompt: "Solve $x+1=2$.", answer: "x = 1" });
    expect(normalizePrepareQuestion({ prompt: "a".repeat(2000) })?.prompt).toHaveLength(1000);
  });

  it("filters blank choices and caps them at six", () => {
    const q = normalizePrepareQuestion({
      prompt: "Pick one.",
      choices: ["a", "", "  ", "b", "c", "d", "e", "f", "g"],
    });
    expect(q?.choices).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("coerces points to an integer between 1 and 100, drops garbage", () => {
    expect(normalizePrepareQuestion({ prompt: "p", points: 3.7 })?.points).toBe(3);
    expect(normalizePrepareQuestion({ prompt: "p", points: 0 })?.points).toBe(1);
    expect(normalizePrepareQuestion({ prompt: "p", points: 200 })?.points).toBe(100);
    expect(normalizePrepareQuestion({ prompt: "p", points: "lots" })?.points).toBeUndefined();
  });
});

describe("composePrepareMarkdown", () => {
  it("quiz reads as a quiz: lettered choices + answer key", async () => {
    const md = await composePrepareMarkdown(
      "quiz",
      "Fractions quiz",
      "",
      [{ prompt: "1/2 + 1/4?", choices: ["1/6", "3/4"], answer: "3/4" }],
      tr,
    );
    expect(md).toContain("## Questions");
    expect(md).toContain("- A. 1/6");
    expect(md).toContain("## Answer key");
    expect(md).toContain("1. 3/4");
  });

  it("exam carries points, a total and a marking scheme", async () => {
    const md = await composePrepareMarkdown(
      "exam",
      "Midterm",
      "Answer all questions.",
      [
        { prompt: "Define photosynthesis.", answer: "Plants convert light…", points: 8 },
        { prompt: "2 + 2?", choices: ["3", "4"], answer: "4", points: 12 },
      ],
      tr,
    );
    expect(md).toContain("## Exam");
    expect(md).toContain("1. (8 pts) Define photosynthesis.");
    expect(md).toContain("Total: 20 points");
    expect(md).toContain("## Marking scheme");
    expect(md).toContain("2. (12 pts) 4");
  });

  it("exercise is progressive open items with solutions, never choices", async () => {
    const md = await composePrepareMarkdown(
      "exercise",
      "Distributivity",
      "",
      [{ prompt: "Expand 2(x+3).", answer: "2x + 6" }],
      tr,
    );
    expect(md).toContain("## Exercises");
    expect(md).toContain("## Solutions");
    expect(md).not.toContain("- A.");
    expect(md).not.toContain("Answer key");
  });

  it("worksheet recaps the rule (instructions) then drills with answers", async () => {
    const md = await composePrepareMarkdown(
      "worksheet",
      "Fractions",
      "Reminder: to add fractions, find a common denominator.",
      [{ prompt: "1/3 + 1/6?", answer: "1/2" }],
      tr,
    );
    expect(md).toContain("common denominator");
    expect(md).toContain("## Practice");
    expect(md).toContain("## Answers");
  });

  it("omits the key entirely when nothing has an answer", async () => {
    const md = await composePrepareMarkdown("quiz", "T", "", [{ prompt: "Open?" }], tr);
    expect(md).toContain("## Questions");
    expect(md).not.toContain("## Answer key");
  });

  it("localizes headers — a French teacher gets French", async () => {
    const md = await composePrepareMarkdown(
      "exam",
      "Contrôle",
      "",
      [{ prompt: "Définir la photosynthèse.", answer: "…", points: 5 }],
      trFr,
    );
    expect(md).toContain("## Examen");
    expect(md).toContain("(5 pts)");
    expect(md).toContain("Total : 5 points");
    expect(md).toContain("## Barème");
  });
});
