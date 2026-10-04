import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoRange, graphToSource, niceStep, parseCalc, parseGraph } from "@/lib/math-blocks";
import { graphParameters, runCalc, sampleGraph } from "@/lib/math-engine";
import { normalizeMath, readLine } from "@/lib/math-input";
import { parseMarkdown } from "@/lib/markdown";
import { buildRayaMessages } from "@/lib/raya/prompt";

/**
 * The graph and calculator blocks Raya writes into a reply — the free stand-in
 * for MATLAB and GeoGebra. The syntax tested here is the one the prompt
 * teaches; if they drift apart, Raya writes blocks the app cannot read.
 */

describe("reading a graph block", () => {
  it("reads functions, sliders, points, constants and the window", () => {
    const spec = parseGraph(
      ["f(x) = x^2 - 3", "y = 2*x", "a = 2 (-5..5)", "k = a + 1", "A = (1, -2)", "x: -5..5", "y: 8..-2", "# a comment"].join("\n"),
    );
    expect(spec.functions).toEqual([
      { name: "f", expr: "x^2 - 3" },
      { name: "y", expr: "2*x" },
    ]);
    expect(spec.sliders).toEqual([{ name: "a", value: 2, min: -5, max: 5 }]);
    expect(spec.constants).toEqual([{ name: "k", expr: "a + 1" }]);
    expect(spec.points).toEqual([{ name: "A", x: "1", y: "-2" }]);
    expect(spec.x).toEqual([-5, 5]);
    expect(spec.y).toEqual([-2, 8]);
    expect(spec.errors).toEqual([]);
  });

  it("shows what it cannot read instead of guessing", () => {
    const spec = parseGraph("f(x) = x\nplot sin please\nx: 3..3");
    expect(spec.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("keeps a slider's start inside its range", () => {
    expect(parseGraph("a = 50 (0..10)").sliders[0].value).toBe(10);
  });

  it("is bounded, whatever the model writes", () => {
    const many = Array.from({ length: 30 }, (_, i) => `f${i}(x) = x + ${i}`).join("\n");
    expect(parseGraph(many).functions.length).toBeLessThanOrEqual(6);
    expect(parseCalc(Array(100).fill("1+1").join("\n")).lines.length).toBeLessThanOrEqual(40);
  });
});

describe("the engine", () => {
  it("calculates exactly, keeping one scope across lines", () => {
    const rows = runCalc(["a = 3", "b = 4", "sqrt(a^2 + b^2)", "0.1 + 0.2", "det([1, 2; 3, 4])"]);
    expect(rows.map((r) => r.result)).toEqual(["3", "4", "5", "0.3", "-2"]);
  });

  it("does the CAS work a student would reach for MATLAB for", () => {
    const [d, s, u] = runCalc(['derivative("x^3 + 2x", "x")', 'simplify("2x + 3x")', "5 cm to inch"]);
    expect(d.result).toBe("3 * x ^ 2 + 2");
    expect(s.result).toBe("5 * x");
    expect(u.result).toMatch(/^1\.9685\d* inch$/);
  });

  it("reports a bad line as that line's error, and carries on", () => {
    const rows = runCalc(["1 +", "2 * 3"]);
    expect(rows[0].error).toBeTruthy();
    expect(rows[1].result).toBe("6");
  });

  it("cannot reach JavaScript or change the shared instance", () => {
    const rows = runCalc(["[1].constructor", 'import({pi: 3}, {override: true})', 'createUnit("foo")', "pi"]);
    expect(rows.slice(0, 3).every((r) => r.error)).toBe(true);
    expect(rows[3].result).toMatch(/^3\.14159/);
  });

  it("samples curves, leaves gaps where a function is undefined, and lets one call another", () => {
    const spec = parseGraph("f(x) = sqrt(x)\ng(x) = f(x) + a\na = 1 (0..5)");
    const out = sampleGraph(spec, { a: 2 }, [-4, 4], 8);
    const [f, g] = out.curves;
    expect(f.points[0][1]).toBeNaN(); // √-4: a gap, not a crash
    expect(f.points[8][1]).toBe(2);
    expect(g.points[8][1]).toBe(4); // f(4) + a, with the slider's value
  });

  it("places points from expressions", () => {
    const out = sampleGraph(parseGraph("S = (a, a^2)\na = 3 (0..5)"), { a: 3 }, [-5, 5]);
    expect(out.points).toEqual([{ name: "S", x: 3, y: 9 }]);
  });
});

describe("school notation", () => {
  it("reads what a student writes on paper", () => {
    expect(normalizeMath("x² − 3")).toBe("x^2 - 3");
    expect(normalizeMath("x⁻¹")).toBe("x^(-1)");
    expect(normalizeMath("√(a² + b²)")).toBe("sqrt(a^2 + b^2)");
    expect(normalizeMath("√16 + √x")).toBe("sqrt(16) + sqrt(x)");
    expect(normalizeMath("3,5 × 4 ÷ 2")).toBe("3.5 * 4 / 2");
    expect(normalizeMath("2π")).toBe("2 pi");
    expect(runCalc(["r = 2", "2πr"])[1].result).toMatch(/^12.566/);
    expect(normalizeMath("|x − 2|")).toBe("abs(x - 2)");
    expect(normalizeMath("racine(9)")).toBe("sqrt(9)");
  });

  it("keeps school logarithms: log is base 10, ln is natural", () => {
    const [log, ln] = runCalc(["log(100)", "ln(e)"]);
    expect(log.result).toBe("2");
    expect(ln.result).toBe("1");
  });

  it("leaves the commas of a matrix alone", () => {
    expect(normalizeMath("det([1,2;3,4])")).toBe("det([1,2;3,4])");
  });

  it("understands the words in all four languages", () => {
    for (const line of ["dérivée de x³", "derivative of x^3", "derivada de x^3", "Ableitung von x^3", "d/dx(x^3)"]) {
      expect(readLine(line).kind, line).toBe("derivative");
      expect(runCalc([line])[0].result, line).toBe("3 * x ^ 2");
    }
    for (const line of ["résoudre 2x + 3 = 7", "solve 2x+3=7", "resolver 2x + 3 = 7", "löse 2x + 3 = 7", "2x + 3 = 7"]) {
      expect(readLine(line).kind, line).toBe("solve");
      expect(runCalc([line])[0].result, line).toBe("x=2");
    }
    expect(readLine("simplifier 2x + 3x").kind).toBe("simplify");
  });

  it("tells an equation from a definition", () => {
    expect(readLine("a = 3").kind).toBe("expr");
    expect(readLine("f(x) = x²").kind).toBe("expr");
    expect(readLine("2x + 3 = 7").kind).toBe("solve");
  });
});

describe("solving", () => {
  it("is exact for the equations of school", () => {
    expect(runCalc(["x² − 5x + 6 = 0"])[0].result).toBe("x=2, x=3");
    expect(runCalc(["3x = 1"])[0].result).toBe("x=1/3");
    const none = runCalc(["x² + 1 = 0"])[0];
    expect(none.note).toBe("noSolution");
    expect(runCalc(["2x = 2x"])[0].note).toBe("everyValue");
  });

  it("uses values defined above it", () => {
    expect(runCalc(["a = 4", "a·x = 2"])[1].result).toBe("x=0.5");
  });

  it("falls back to approximate roots, and says so", () => {
    const row = runCalc(["cos(x) = x"])[0];
    expect(row.note).toBe("approx");
    expect(row.result).toMatch(/^x=0\.73908/);
  });

  it("is not fooled by a pole", () => {
    const row = runCalc(["1/x = 0"])[0];
    expect(row.note).toBe("noSolution");
  });
});

describe("what the learner sees", () => {
  it("is typeset, never code", () => {
    const [d] = runCalc(["dérivée de x³ + 2x"]);
    expect(d.inputHtml).toContain("katex");
    expect(d.resultHtml).toContain("katex");
    // KaTeX's annotation carries the LaTeX: a real d/dx, not "derivative(".
    expect(d.inputHtml).toContain("\\frac{d}{dx}");
    expect(d.inputHtml).not.toContain("derivative");
  });

  it("writes 3x², not 3·x², and keeps the dot between two numbers", () => {
    const [d, p] = runCalc(["dérivée de x³", "3 × 4"]);
    expect(d.resultHtml).not.toContain("⋅");
    expect(p.inputHtml).toContain("⋅");
  });

  it("shows 3,5 to a reader who writes 3,5", () => {
    const [row] = runCalc(["3,5 + 1"], true);
    expect(row.result).toBe("4.5"); // the value itself is a number, not a string
    expect(row.resultHtml).toMatch(/4<span class="mpunct">,<\/span>5|4,5/);
    expect(runCalc(["3,5 + 1"], false)[0].resultHtml).toContain("4.5");
  });

  it("shows a fraction when it says more than the decimals", () => {
    expect(runCalc(["1/3"])[0].result).toBe("1/3");
    expect(runCalc(["3/4"])[0].result).toBe("0.75");
  });
});

describe("graphs as a student builds them", () => {
  it("makes a slider for every letter that is not x", () => {
    const spec = parseGraph(["f(x) = a·x² + b", "g(x) = f(x) + pi"].join("\n"));
    expect(graphParameters(spec)).toEqual(["a", "b"]);
  });

  it("plots school notation", () => {
    const out = sampleGraph(parseGraph("f(x) = x² − 3"), {}, [0, 2], 2);
    expect(out.curves[0].points.map((p) => p[1])).toEqual([-3, -2, 1]);
  });

  it("reads points written the school way, decimal commas included", () => {
    expect(parseGraph("A = (3,5 ; 2)").points).toEqual([{ name: "A", x: "3,5", y: "2" }]);
    const out = sampleGraph(parseGraph("A = (3,5 ; 2)"), {}, [-5, 5]);
    expect(out.points).toEqual([{ name: "A", x: 3.5, y: 2 }]);
  });

  it("saves and reloads to the same graph", () => {
    const spec = parseGraph(["f(x) = x² − 3", "g(x) = a·x + 1", "a = 2 (-5..5)", "A = (1 ; -2)", "x: -5..5"].join("\n"));
    expect(parseGraph(graphToSource(spec))).toEqual(spec);
  });
});

describe("axes", () => {
  it("picks round tick steps", () => {
    expect(niceStep(20)).toBe(2);
    expect(niceStep(1)).toBeCloseTo(0.1);
    expect(niceStep(700)).toBe(100);
  });

  it("is not flattened by an asymptote", () => {
    const values = Array.from({ length: 200 }, (_, i) => (i === 100 ? 1e9 : Math.sin(i / 10)));
    const [lo, hi] = autoRange(values);
    expect(hi).toBeLessThan(10);
    expect(lo).toBeGreaterThan(-10);
  });
});

describe("wiring", () => {
  it("knows when a block is still streaming in", () => {
    const [open] = parseMarkdown("```graph\nf(x) = x");
    expect(open).toMatchObject({ t: "code", lang: "graph", open: true });
    const [done] = parseMarkdown("```graph\nf(x) = x\n```");
    expect(done).not.toHaveProperty("open");
  });

  it("renders the blocks as tools, and loads math.js only on demand", () => {
    const rich = readFileSync(join(process.cwd(), "components/chat/rich-text.tsx"), "utf8");
    expect(rich).toContain("isMathBlockLang(b.lang)");
    const tools = readFileSync(join(process.cwd(), "components/chat/math-tools.tsx"), "utf8");
    expect(tools).toContain('import("@/lib/math-engine")');
    // A static import would put math.js in every chat page's bundle.
    expect(tools).not.toMatch(/^import [^;]*from "@\/lib\/math-engine"/m);
    expect(tools).not.toMatch(/from "mathjs"/);
  });

  it("teaches Raya the same syntax the parser reads", () => {
    const system = buildRayaMessages([], null)[0].content;
    const graph = /```graph\n([\s\S]*?)```/.exec(system)![1];
    const calc = /```calc\n([\s\S]*?)```/.exec(system)![1];
    expect(parseGraph(graph).errors).toEqual([]);
    expect(parseGraph(graph).functions.length).toBeGreaterThan(0);
    expect(runCalc(parseCalc(calc).lines).every((r) => !r.error)).toBe(true);
  });
});

describe("the Tools page workbench", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("is picked from the Tools cards, not buried at the bottom of the page", () => {
    const tools = read("components/tools.tsx");
    expect(tools).toContain('{ id: "graph", labelKey: "tools.tool.graph", ready: true }');
    expect(tools).toContain('{ id: "calc", labelKey: "tools.tool.calc", ready: true }');
    expect(tools).toContain("<MathPanel lang={mathTool} />");
    expect(read("app/tools/page.tsx")).not.toContain("MathStudio");
  });

  it("forgets the learner's work on sign-out, under the same key it saves it", () => {
    const key = /MATH_STUDIO_KEY = "([^"]+)"/;
    const saved = key.exec(read("components/math-studio.tsx"))![1];
    const wiped = key.exec(read("lib/net/local-data.ts"))![1];
    expect(wiped).toBe(saved);
    expect(read("lib/net/local-data.ts")).toContain("localStorage.removeItem(MATH_STUDIO_KEY)");
  });

  it("opens on examples that work", () => {
    const src = read("components/math-studio.tsx");
    const graph = /graph: \[([\s\S]*?)\]\.join/.exec(src)![1];
    const lines = [...graph.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("\n");
    expect(parseGraph(lines).errors).toEqual([]);
  });
});
