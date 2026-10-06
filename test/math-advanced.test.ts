import { describe, expect, it } from "vitest";
import { normalizeMath, readLine } from "@/lib/math-input";
import { runCalc } from "@/lib/math-engine";
import { lookup, type MessageKey } from "@/lib/i18n";

/**
 * Past the lycée: hyperbolic functions, integrals said with their variable,
 * double and triple integrals, partial and second derivatives, Σ and Π — the
 * owner's "it's not there yet" list, 2026-10-06.
 */

const one = (line: string) => runCalc([line], false)[0];
/** The result as a number — it may come back as a fraction (1/6). */
const num = (line: string) => {
  const r = one(line).result ?? "";
  const m = /^(-?\d+)\/(\d+)$/.exec(r);
  return m ? Number(m[1]) / Number(m[2]) : Number(r);
};

describe("hyperbolic functions and other notations", () => {
  it("reads sh, ch, th and their inverses in every school's spelling", () => {
    expect(normalizeMath("sh(x)")).toBe("sinh(x)");
    expect(normalizeMath("ch x")).toBe("cosh(x)");
    expect(normalizeMath("argsh(1)")).toBe("asinh(1)");
    expect(normalizeMath("arcosh(2)")).toBe("acosh(2)");
    expect(normalizeMath("artanh(0,5)")).toBe("atanh(0.5)");
    expect(normalizeMath("senh(x)")).toBe("sinh(x)");
    // c·h is still a product where it is not a function.
    expect(normalizeMath("ch")).toBe("c h");
  });

  it("computes them, and prints the ISO names", () => {
    expect(num("ch(0)")).toBe(1);
    expect(num("argsh(0)")).toBe(0);
    expect(one("arsinh(1)").inputHtml).toContain("arsinh");
  });

  it("knows the integer part, rounding up, binomials", () => {
    expect(num("⌊3,7⌋")).toBe(3);
    expect(num("⌈3,2⌉")).toBe(4);
    expect(num("binom(5, 2)")).toBe(10);
    expect(one("binom(5, 2)").inputHtml).toContain("mfrac"); // \binom is set as a stacked pair
  });

  it("finds the antiderivative of a hyperbolic function", () => {
    expect(one("primitive de ch(2x)").result).toMatch(/sinh\(2 x\) \/ 2|sinh\(2 x\) \* \(1 \/ 2\)|0\.5/);
  });
});

describe("integrals and their variable", () => {
  it("integrates in the variable named by dx, dy or in words", () => {
    expect(readLine("intégrale de x*y dy de 0 à 1")).toMatchObject({ kind: "integral", v: "y" });
    expect(readLine("intégrale de x y par rapport à y de 0 à 2")).toMatchObject({ kind: "integral", v: "y" });
    expect(readLine("integral of t^2 with respect to t from 0 to 3")).toMatchObject({ kind: "integral", v: "t" });
  });

  it("keeps the other letters as letters: ∫₀¹ x·y dy = x/2", () => {
    const r = one("intégrale de x*y dy de 0 à 1");
    expect(r.error).toBeUndefined();
    expect(r.result?.replace(/\s/g, "")).toMatch(/^(x\/2|0\.5\*?x|1\/2\*?x)$/);
    expect(r.inputHtml).toContain("dy");
    // x·y typeset as a product — it used to come out as the unknown command \cdoty.
    expect(r.inputHtml).not.toContain("cdoty");
    expect(r.inputHtml).not.toContain("katex-error");
  });

  it("still gives a number when the other letters have values", () => {
    expect(runCalc(["a = 2", "intégrale de a*x dx de 0 à 1"])[1].result).toBe("1");
  });
});

describe("double and triple integrals", () => {
  it("reads the differentials and matches the bounds to them", () => {
    expect(readLine("intégrale double de x*y dx dy, x de 0 à 1, y de 0 à 2")).toEqual({
      kind: "multiIntegral",
      inner: "x*y",
      dims: [
        { v: "x", a: "0", b: "1" },
        { v: "y", a: "0", b: "2" },
      ],
    });
    expect(readLine("∬ x y dx dy sur [0;1]×[0;2]")).toMatchObject({ kind: "multiIntegral", dims: [{ v: "x" }, { v: "y" }] });
    // Two differentials make it double even without the word.
    expect(readLine("intégrale de x dy dx, y de 0 à x, x de 0 à 1")).toMatchObject({ kind: "multiIntegral" });
  });

  it("computes a rectangle, a triangle and a cube", () => {
    expect(num("intégrale double de x*y dx dy, x de 0 à 1, y de 0 à 2")).toBe(1);
    // ∫₀¹ ∫₀ˣ y dy dx = 1/6 (a triangle: the inner bound depends on x).
    expect(num("intégrale de y dy dx, y de 0 à x, x de 0 à 1")).toBeCloseTo(1 / 6, 9);
    expect(num("intégrale triple de x+y+z dx dy dz, x de 0 à 1, y de 0 à 1, z de 0 à 1")).toBe(1.5);
    expect(one("∬ x y dx dy sur [0;1]×[0;2]").inputHtml).toContain("dx");
  });

  it("integrates in the order the bounds need, whatever order dx dy came in", () => {
    // y's bound uses x, so y goes inside even though dx was written first: the triangle.
    expect(num("intégrale double de x*y dx dy, x de 0 à 1, y de 0 à x")).toBeCloseTo(1 / 8, 9);
  });

  it("estimates a non-polynomial one and says so", () => {
    const r = one("intégrale double de exp(-x^2-y^2) dx dy, x de -3 à 3, y de -3 à 3");
    expect(Number(r.result)).toBeCloseTo(Math.PI, 3);
    expect(r.note).toBe("approx");
  });
});

describe("derivatives past the first", () => {
  it("takes the second derivative", () => {
    expect(one("dérivée seconde de x^3").result?.replace(/[\s*]/g, "")).toBe("6x");
    expect(one("dérivée seconde de x^3").inputHtml).toContain("′′");
  });

  it("takes a partial derivative, and writes it with ∂", () => {
    const r = one("dérivée partielle de x^2*y par rapport à y");
    expect(r.result?.replace(/\s/g, "")).toBe("x^2");
    expect(r.inputHtml).toContain("∂");
    // With x and y both there, even a plain "dérivée … par rapport à x" is ∂.
    expect(one("dérivée de x^2*y par rapport à x").inputHtml).toContain("∂");
    // …but ax² is still (ax²)′: a is a constant, not a variable.
    expect(one("dérivée de a x^2").inputHtml).not.toContain("∂");
  });
});

describe("the keypad's sentences", () => {
  it("are read as what they say, in every language", () => {
    const expected: [string, string][] = [
      ["math.tpl.integral", "integral"],
      ["math.tpl.second", "derivative"],
      ["math.tpl.partial", "derivative"],
      ["math.tpl.double", "multiIntegral"],
      ["math.tpl.triple", "multiIntegral"],
      ["math.tpl.sum", "series"],
      ["math.tpl.product", "series"],
      ["math.tpl.primitive", "primitive"],
      ["math.tpl.limit", "limit"],
    ];
    for (const locale of ["en", "fr", "es", "de"] as const) {
      for (const [key, kind] of expected) {
        const sentence = lookup(locale, key as MessageKey).replace("{}", "x*y + k");
        expect([locale, key, readLine(sentence).kind]).toEqual([locale, key, kind]);
      }
    }
  });

  it("compute, not just parse", () => {
    for (const locale of ["en", "fr", "es", "de"] as const) {
      const row = runCalc([lookup(locale, "math.tpl.double").replace("{}", "x*y")])[0];
      expect([locale, row.result]).toEqual([locale, "0.25"]);
    }
  });
});

describe("sums and products", () => {
  it("adds up a finite sum and multiplies a product", () => {
    expect(num("somme de k² pour k de 1 à 10")).toBe(385);
    expect(num("sum of k for k from 1 to 100")).toBe(5050);
    expect(num("produit de k pour k de 1 à 5")).toBe(120);
    expect(one("somme de k² pour k de 1 à 10").inputHtml).toContain("∑");
  });

  it("estimates a convergent series to +∞ and refuses a divergent one", () => {
    const r = one("somme de 1/k² pour k de 1 à +∞");
    expect(Number(r.result)).toBeCloseTo(Math.PI ** 2 / 6, 5);
    expect(r.note).toBe("approx");
    expect(one("somme de 1/k pour k de 1 à +∞").problem?.kind).toBe("diverges");
  });
});
