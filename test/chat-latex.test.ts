import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderMathHtml } from "@/lib/katex-render";
import { FORMATTING_RULES } from "@/lib/raya/prompt";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").replace(/\r/g, "");

/**
 * Owner, 2026-10-06: "Raya a toujours du mal à rédiger ou du moins à afficher
 * ces éléments dans un format compréhensible pour tous". The chat typeset with
 * a school-level subset that could not show a system, a matrix or a limit.
 */
describe("Raya's maths, typeset", () => {
  it("renders what the subset could not", () => {
    for (const tex of [
      "\\begin{cases} x + y = 3 \\\\ x - y = 1 \\end{cases}",
      "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
      "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
      "\\vec{u} \\cdot \\vec{v}",
      "\\begin{aligned} 2x + 3 &= 7 \\\\ x &= 2 \\end{aligned}",
      "x \\in \\R",
    ]) {
      expect([tex, renderMathHtml(tex, true).includes("katex-error")]).toEqual([tex, false]);
    }
  });

  it("is KaTeX in the chat, loaded on the first formula, with the subset as stand-in", () => {
    const rich = read("components/chat/rich-text.tsx");
    expect(rich).toContain('import("@/lib/katex-render")');
    expect(rich).not.toMatch(/^import .*katex/m); // never in the chat's own bundle
    expect(rich).toContain('if (html == null) return <FallbackMath src={src} block={block} />;');
  });

  it("tells Raya to write all maths in LaTeX, systems and matrices included", () => {
    expect(FORMATTING_RULES).toContain("Maths is ALWAYS LaTeX");
    expect(FORMATTING_RULES).toContain("\\begin{cases}");
    expect(FORMATTING_RULES).not.toContain("will not display");
  });
});
