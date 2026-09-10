import { describe, it, expect } from "vitest";
import { parseDoc, splitInline, mapInlineMath, latexToUnicode } from "@/lib/doc-format";

/**
 * The LaTeX/KaTeX support added to the shared document formatting: a display
 * block ($$...$$) parses out of the Markdown, an inline formula ($...$) splits
 * out of a line of prose, and — because the SAME product renders reports that
 * quote a school's fees in the SAME body a formula might appear in — a
 * currency amount must never be mistaken for one.
 */
describe("parseDoc: display math blocks", () => {
  it("parses a fenced $$ block spanning multiple lines", () => {
    const md = "# Title\n\n$$\nE = mc^2\n$$\n\nAfter.";
    const blocks = parseDoc(md);
    expect(blocks).toEqual([
      { type: "h1", text: "Title" },
      { type: "math", text: "E = mc^2" },
      { type: "p", text: "After." },
    ]);
  });

  it("parses a single-line $$...$$ block", () => {
    const blocks = parseDoc("$$a^2 + b^2 = c^2$$");
    expect(blocks).toEqual([{ type: "math", text: "a^2 + b^2 = c^2" }]);
  });

  it("leaves ordinary paragraphs, headings and lists untouched", () => {
    const md = "## Highlights\n- Fees are 50000 XAF\nA normal paragraph.";
    expect(parseDoc(md)).toEqual([
      { type: "h2", text: "Highlights" },
      { type: "li", text: "Fees are 50000 XAF" },
      { type: "p", text: "A normal paragraph." },
    ]);
  });

  it("never opens a math block on an unfenced $$ mid-sentence (no such input from this app's prompts, but stays inert)", () => {
    // A lone, unclosed $$ collects to the end of the document rather than
    // eating nothing — see the comment in parseDoc for why that's the safer
    // failure than silently dropping the rest of the report.
    const blocks = parseDoc("Before.\n\n$$\nx^2");
    expect(blocks).toEqual([
      { type: "p", text: "Before." },
      { type: "math", text: "x^2" },
    ]);
  });
});

describe("splitInline: inline math ($...$) vs. plain prose", () => {
  it("recognizes a tight inline formula", () => {
    expect(splitInline("The energy is $E=mc^2$ here.")).toEqual([
      { text: "The energy is ", bold: false },
      { text: "E=mc^2", bold: false, math: true },
      { text: " here.", bold: false },
    ]);
  });

  it("does NOT treat two currency amounts on one line as a formula spanning them", () => {
    // This is the exact collision a school performance report can contain:
    // fee figures in the same body a formula might also appear in.
    const spans = splitInline("It costs $50 to $100 depending on the plan.");
    expect(spans.every((s) => !s.math)).toBe(true);
    expect(spans.map((s) => s.text).join("")).toBe("It costs $50 to $100 depending on the plan.");
  });

  it("still treats a $-wrapped expression as math even next to a bold run", () => {
    const spans = splitInline("**Result:** $x^2$ is positive.");
    expect(spans).toEqual([
      { text: "Result:", bold: true },
      { text: " ", bold: false },
      { text: "x^2", bold: false, math: true },
      { text: " is positive.", bold: false },
    ]);
  });

  it("rejects an empty or whitespace-padded $...$ as math", () => {
    expect(splitInline("A stray $$ pair.").every((s) => !s.math)).toBe(true);
    expect(splitInline("Spaced: $ x $ here.").every((s) => !s.math)).toBe(true);
  });
});

describe("mapInlineMath", () => {
  it("converts only the math spans, leaving the rest of the line alone", () => {
    const out = mapInlineMath("Cost: $50. Formula: $a/b$.", (tex) => `[${tex}]`);
    expect(out).toBe("Cost: $50. Formula: [a/b].");
  });
});

describe("latexToUnicode", () => {
  it("renders a fraction as (num)/(den)", () => {
    expect(latexToUnicode("\\frac{a}{b}")).toBe("(a)/(b)");
  });

  it("renders superscripts and subscripts it has glyphs for", () => {
    expect(latexToUnicode("x^2")).toBe("x²");
    expect(latexToUnicode("H_2O")).toBe("H₂O");
    expect(latexToUnicode("x^{10}")).toBe("x¹⁰");
  });

  it("falls back to ^(...) for a superscript with no Unicode glyph", () => {
    expect(latexToUnicode("x^{ab}")).toBe("x^(ab)");
  });

  it("renders a square root and an nth root", () => {
    expect(latexToUnicode("\\sqrt{2}")).toBe("√(2)");
    expect(latexToUnicode("\\sqrt[3]{8}")).toBe("3√(8)");
  });

  it("maps Greek letters and common operators/relations", () => {
    expect(latexToUnicode("\\alpha + \\beta")).toBe("α + β");
    expect(latexToUnicode("a \\times b \\leq c")).toBe("a × b ≤ c");
    expect(latexToUnicode("\\infty")).toBe("∞");
  });

  it("unwraps \\text{...} to its plain content", () => {
    expect(latexToUnicode("v_{\\text{max}}")).toBe("v_(max)");
  });

  it("degrades an unrecognized command to its bare name rather than vanishing", () => {
    expect(latexToUnicode("\\nosuchcommand{x}")).toContain("nosuchcommand");
  });
});
