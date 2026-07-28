import { describe, it, expect } from "vitest";
import { parseMarkdown, parseInline, type Block, type Inline } from "@/lib/markdown";
import { parseLatex, latexToText } from "@/lib/latex";

/**
 * The chat renderer parses text that arrives one chunk at a time, straight from
 * a model. Two properties matter more than completeness: half-written markup
 * must stay readable, and nothing the model emits may become markup we didn't
 * intend (HTML, javascript: links, or a price turning into a formula).
 */

const text = (v: string): Inline => ({ t: "text", v });

describe("inline markdown", () => {
  it("parses bold, italics, strikethrough and code", () => {
    expect(parseInline("**a**")).toEqual([{ t: "strong", c: [text("a")] }]);
    expect(parseInline("*a*")).toEqual([{ t: "em", c: [text("a")] }]);
    expect(parseInline("~~a~~")).toEqual([{ t: "del", c: [text("a")] }]);
    expect(parseInline("`a`")).toEqual([{ t: "code", v: "a" }]);
  });

  it("prefers ** over * so bold never becomes nested italics", () => {
    expect(parseInline("**bold**")).toEqual([{ t: "strong", c: [text("bold")] }]);
  });

  it("leaves an UNTERMINATED run as literal text (mid-stream)", () => {
    expect(parseInline("**not closed yet")).toEqual([text("**not closed yet")]);
    expect(parseInline("`open code")).toEqual([text("`open code")]);
  });

  it("keeps underscores inside identifiers", () => {
    expect(parseInline("user_id and file_name")).toEqual([text("user_id and file_name")]);
  });

  it("treats code spans as literal — no markup inside", () => {
    expect(parseInline("`**x**`")).toEqual([{ t: "code", v: "**x**" }]);
  });

  it("honours backslash escapes", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([text("*not italic*")]);
  });

  describe("maths vs money", () => {
    it("reads $x^2$ as maths", () => {
      expect(parseInline("$x^2$")).toEqual([{ t: "math", v: "x^2" }]);
    });

    it("does NOT turn prices into maths", () => {
      expect(parseInline("It costs $5 and $12 total")).toEqual([
        text("It costs $5 and $12 total"),
      ]);
    });

    it("accepts spaced maths when it carries LaTeX punctuation", () => {
      expect(parseInline("$a + \\frac{1}{2}$")).toEqual([
        { t: "math", v: "a + \\frac{1}{2}" },
      ]);
    });

    it("supports \\( … \\) delimiters", () => {
      expect(parseInline("\\(x\\)")).toEqual([{ t: "math", v: "x" }]);
    });
  });

  describe("links", () => {
    it("accepts http(s) and mailto", () => {
      expect(parseInline("[a](https://x.dev)")).toEqual([
        { t: "link", href: "https://x.dev", c: [text("a")] },
      ]);
    });

    it("REFUSES a javascript: url — it stays inert text", () => {
      const out = parseInline("[click](javascript:alert(1))");
      expect(out.some((n) => n.t === "link")).toBe(false);
    });
  });
});

describe("block markdown", () => {
  const kinds = (bs: Block[]) => bs.map((b) => b.t);

  it("parses headings, paragraphs and rules", () => {
    expect(kinds(parseMarkdown("# Title\n\nBody text\n\n---"))).toEqual(["h", "p", "hr"]);
  });

  it("groups consecutive bullets into one list", () => {
    const [b] = parseMarkdown("- one\n- two\n- three");
    expect(b).toMatchObject({ t: "list", ordered: false });
    expect(b.t === "list" && b.items).toHaveLength(3);
  });

  it("keeps an ordered list's starting number", () => {
    const [b] = parseMarkdown("3. three\n4. four");
    expect(b).toMatchObject({ t: "list", ordered: true, start: 3 });
  });

  it("parses a table with its column alignment", () => {
    const [b] = parseMarkdown("| a | b |\n| :-- | --: |\n| 1 | 2 |");
    expect(b).toMatchObject({ t: "table", align: ["left", "right"] });
    expect(b.t === "table" && b.rows).toHaveLength(1);
  });

  it("parses a fenced code block and keeps its language", () => {
    const [b] = parseMarkdown("```python\nx = 1\n\ny = 2\n```");
    expect(b).toMatchObject({ t: "code", lang: "python", v: "x = 1\n\ny = 2" });
  });

  it("renders an UNCLOSED fence as code (still streaming)", () => {
    const [b] = parseMarkdown("```\nhalf a snippet");
    expect(b).toMatchObject({ t: "code", v: "half a snippet" });
  });

  it("parses display maths, on one line or several", () => {
    expect(parseMarkdown("$$a^2$$")).toEqual([{ t: "mathBlock", v: "a^2" }]);
    expect(parseMarkdown("$$\na^2\n$$")).toEqual([{ t: "mathBlock", v: "a^2" }]);
  });

  it("never emits raw HTML from the model", () => {
    const blocks = parseMarkdown("<script>alert(1)</script>");
    expect(blocks).toEqual([{ t: "p", c: [text("<script>alert(1)</script>")] }]);
  });

  it("survives an empty string", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});

/**
 * The LaTeX subset. Its contract is coverage of school-level notation AND
 * graceful failure: a student must never be shown a raw backslash.
 */
describe("latex subset", () => {
  const flat = (src: string) => latexToText(parseLatex(src));

  it("maps Greek letters and operators to Unicode", () => {
    expect(flat("\\alpha + \\beta \\times \\pi")).toBe("α + β × π");
    expect(flat("x \\leq y \\neq z")).toBe("x ≤ y ≠ z");
  });

  it("parses powers and indices", () => {
    expect(parseLatex("x^2")).toEqual([
      { t: "sym", v: "x" },
      { t: "sup", c: [{ t: "sym", v: "2" }] },
    ]);
    expect(flat("a_{i+1}")).toBe("a_i+1");
  });

  it("parses fractions and roots", () => {
    expect(flat("\\frac{a}{b}")).toBe("(a)/(b)");
    expect(flat("\\sqrt{x+1}")).toBe("√(x+1)");
    expect(flat("\\sqrt[3]{x}")).toBe("√(x)"); // index dropped, radicand kept
  });

  it("unwraps text-like commands", () => {
    expect(flat("\\text{hello}")).toBe("hello");
    expect(flat("\\mathrm{d}x")).toBe("dx");
  });

  it("drops an UNKNOWN command but keeps its argument", () => {
    expect(flat("\\underbrace{x+y}")).toBe("x+y");
  });

  it("never leaks a backslash into the output", () => {
    for (const src of ["\\foo", "\\begin{aligned}x\\end{aligned}", "\\\\", "\\qquad"]) {
      expect(flat(src)).not.toContain("\\");
    }
  });

  it("handles nested groups", () => {
    expect(flat("\\frac{\\alpha}{\\sqrt{2}}")).toBe("(α)/(√(2))");
  });

  it("survives malformed input without throwing", () => {
    expect(() => parseLatex("\\frac{a")).not.toThrow();
    expect(() => parseLatex("^{{{")).not.toThrow();
    expect(() => parseLatex("")).not.toThrow();
  });
});
