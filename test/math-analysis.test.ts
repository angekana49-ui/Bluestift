import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { graphToSource, parseGraph } from "@/lib/math-blocks";
import { graphParameters, runCalc, sampleGraph } from "@/lib/math-engine";
import { normalizeMath, parseBounds, readLine } from "@/lib/math-input";
import { buildRayaMessages } from "@/lib/raya/prompt";

/**
 * The maths tools as a lycéen uses them: the notation of the exercise book
 * (arccos, sin x, ax², x(x + 1)), the analysis of the programme (integrals,
 * antiderivatives, limits), angles in degrees, and areas and tangents on a
 * graph — all computed on the device, never by a model.
 */

const calc = (...lines: string[]) => runCalc(lines);
const one = (line: string, opts?: Parameters<typeof runCalc>[2]) => runCalc([line], false, opts)[0];

describe("the exercise-book notation", () => {
  it("knows the inverse functions by their school names, and the usual slip", () => {
    expect(normalizeMath("arccos(0,5)")).toBe("acos(0.5)");
    expect(normalizeMath("arcos(0.5)")).toBe("acos(0.5)");
    expect(normalizeMath("arcsin 1")).toBe("asin(1)");
    expect(normalizeMath("arctan(1)")).toBe("atan(1)");
    expect(normalizeMath("arcsen(1)")).toBe("asin(1)");
    expect(one("arccos(0.5)").result).toBe("1.047197551");
  });

  it("applies a function written without brackets to the next term", () => {
    expect(normalizeMath("sin x")).toBe("sin(x)");
    expect(normalizeMath("cos2x")).toBe("cos(2x)");
    expect(normalizeMath("ln x")).toBe("log(x)");
    expect(normalizeMath("log x")).toBe("log10(x)");
    expect(normalizeMath("sin 30°")).toBe("sin(30 deg)");
  });

  it("reads letters side by side as a product, and a letter before a bracket too", () => {
    expect(normalizeMath("ax² + bx + c")).toBe("a x^2 + b x + c");
    expect(normalizeMath("xsin(x)")).toBe("x sin(x)");
    expect(normalizeMath("x(x+1)")).toBe("x*(x+1)");
    expect(normalizeMath("2x(x+1)")).toBe("2x*(x+1)");
    // …but the graph's own functions are called, not multiplied.
    expect(normalizeMath("f(2) + g(x)")).toBe("f(2) + g(x)");
    expect(calc("x(x+1) = 6")[0].result).toBe("x=-3, x=2");
  });

  it("keeps a name the learner defined whole", () => {
    const rows = calc("rayon = 3", "π rayon²");
    expect(rows[1].result).toBe("28.27433388");
    const fn = calc("aire(r) = π r²", "aire(1)");
    expect(fn[1].result).toBe("3.141592654");
  });

  it("knows roots, logs in any base, factorials, gcd in every language", () => {
    expect(one("∛27").result).toBe("3");
    expect(one("log₂(8)").result).toBe("3");
    expect(one("log_2(8)").result).toBe("3");
    expect(one("5!").result).toBe("120");
    expect(one("pgcd(12, 18)").result).toBe("6");
    expect(one("ppcm(4, 6)").result).toBe("12");
  });

  it("keeps units whole after a number", () => {
    expect(one("5 cm to inch").result).toContain("inch");
  });

  it("tidies an expression with letters instead of failing, using the values already given", () => {
    expect(one("2x + 3x").result).toBe("5 * x");
    expect(calc("a = 2", "a x² + 3x")[1].result).toBe("2 x ^ 2 + 3 x");
  });

  it("says what to fix: an unknown function, a missing bracket", () => {
    expect(one("foo(2)").problem).toEqual({ kind: "unknownFunction", name: "foo" });
    expect(one("(2 + 3").problem).toEqual({ kind: "brackets" });
  });
});

describe("angles in degrees", () => {
  it("computes trigonometry in degrees when asked, radians otherwise", () => {
    const deg = runCalc(["sin(30)", "cos(90)", "arccos(0,5)", "tan(45)"], true, { degrees: true });
    expect(deg.map((r) => r.result)).toEqual(["0.5", "0", "60", "1"]);
    expect(one("sin(30)").result).not.toBe("0.5");
    // An explicit unit wins either way.
    expect(one("sin(30°)").result).toBe("0.5");
  });

  it("is the learner's own choice in their panel, never applied to a block in a reply", () => {
    const tools = readFileSync(join(process.cwd(), "components/chat/math-tools.tsx"), "utf8");
    expect(tools).toContain("const [degrees, setDegrees] = useDegrees(standalone);");
    expect(tools).toContain("standalone={Boolean(bench)}");
  });
});

describe("analysis", () => {
  it("reads an integral every way it is written", () => {
    for (const line of ["intégrale de x² de 0 à 1", "integral of x^2 from 0 to 1", "∫(x², 0, 1)", "intégrale de x² dx sur [0 ; 1]", "Integral von x² von 0 bis 1", "integral de x² de 0 a 1"]) {
      expect(readLine(line)).toMatchObject({ kind: "integral", inner: "x^2", a: "0", b: "1" });
    }
    expect(parseBounds("de 0 à π")).toEqual(["0", "π"]);
    expect(parseBounds("[0 ; 2]")).toEqual(["0", "2"]);
  });

  it("computes definite integrals, exactly for a polynomial", () => {
    const poly = one("intégrale de x² de 0 à 1");
    expect(poly.result).toBe("1/3");
    expect(poly.note).toBeUndefined();
    expect(one("intégrale de 3x² + 1 de 0 à 2").result).toBe("10");
    const sin = one("intégrale de sin(x) de 0 à π");
    expect(sin.result).toBe("2");
    expect(sin.note).toBe("approx");
    expect(one("∫(1/x, 1, e)").result).toBe("1");
  });

  it("finds the antiderivatives of the school forms, checked by differentiating back", () => {
    expect(one("primitive de 3x² + 2x").result).toBe("x ^ 3 + x ^ 2 + C");
    expect(one("primitive de cos(2x)").result).toBe("sin(2 x) / 2 + C");
    expect(one("primitive de 1/x").result).toBe("log(abs(x)) + C");
    expect(one("primitive de e^(2x)").result).toContain("e ^ (2 x)");
    // No rule for a product of two functions: said, never guessed.
    expect(one("primitive de x e^x").note).toBe("noPrimitive");
  });

  it("estimates limits, says ±∞, and gives both sides when they differ", () => {
    expect(one("limite de sin(x)/x quand x tend vers 0").result).toBe("1");
    expect(one("lim x→0 (1-cos(x))/x²").result).toBe("0.5");
    expect(one("limite de (1 + 1/x)^x en +∞").result).toBe("2.718282");
    expect(one("limite de 1/x² en 0").result).toBe("+∞");
    expect(one("limite de ln(x) en 0+").result).toBe("-∞");
    const split = one("limite de 1/x en 0");
    expect(split.note).toBe("noLimit");
    expect(split.result).toBe("left -∞, right +∞");
    expect(one("limite de sin(x) en +∞").note).toBe("noLimit");
  });
});

describe("areas and tangents on a graph", () => {
  const spec = parseGraph("f(x) = x²\ng(x) = x\naire: f g 0..1\narea: f de 0 à 2\ntangente: f 1\ntangent g at 2");

  it("reads them in any language and writes them back", () => {
    expect(spec.errors).toEqual([]);
    expect(spec.areas).toEqual([
      { f: "f", g: "g", a: "0", b: "1" },
      { f: "f", g: null, a: "0", b: "2" },
    ]);
    expect(spec.tangents).toEqual([
      { f: "f", at: "1" },
      { f: "g", at: "2" },
    ]);
    expect(parseGraph(graphToSource(spec))).toMatchObject({ areas: spec.areas, tangents: spec.tangents });
  });

  it("computes the integral, the geometric area, and the tangent's equation", () => {
    const s = sampleGraph(spec, {}, [-5, 5]);
    expect(s.areas[0].integral).toBeCloseTo(-1 / 6, 9);
    expect(s.areas[0].area).toBeCloseTo(1 / 6, 9);
    expect(s.areas[1].integral).toBeCloseTo(8 / 3, 9);
    expect(s.tangents[0].slope).toBeCloseTo(2, 6);
    expect(s.tangents[0].intercept).toBeCloseTo(-1, 6);
  });

  it("gives a slider to a letter in a bound", () => {
    expect(graphParameters(parseGraph("f(x) = x²\narea: f 0..b"))).toEqual(["b"]);
  });

  it("does not take a connecting word for a second function", () => {
    expect(parseGraph("f(x) = x\naire: f de 0 à 2").areas).toEqual([{ f: "f", g: null, a: "0", b: "2" }]);
  });
});

describe("what Raya is told", () => {
  it("teaches the new lines and the analysis words", () => {
    const system = buildRayaMessages([], null)[0].content as string;
    expect(system).toContain("area: f 0..2");
    expect(system).toContain("tangent: f 1");
    expect(system).toContain("integral of");
    expect(system).toContain("limit of");
  });
});
