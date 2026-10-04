import { all, create } from "mathjs";
import type { GraphSpec } from "@/lib/math-blocks";

/**
 * math.js, set up for the chat's graph and calculator blocks.
 *
 * Imported ONLY through a dynamic `import()` in components/chat/math-tools.tsx,
 * so its weight is paid by a learner who actually has a block on screen and by
 * nobody else.
 *
 * The expressions come from model output — and through it, potentially from an
 * uploaded document — so they are untrusted. math.js's parser is sandboxed by
 * design (no property access to JS internals; `[1].constructor` is refused).
 * On top of that, the functions that would CHANGE the shared instance —
 * `import`, `createUnit`, `reviver` — are switched off, so one block cannot
 * redefine what `sin` means for the next. `parse`/`simplify`/`derivative`
 * stay: the last two are what makes this a stand-in for a CAS, and they need
 * the first.
 */
const math = create(all);
const off = (name: string) =>
  function disabled() {
    throw new Error(`${name} is not available here`);
  };
math.import({ import: off("import"), createUnit: off("createUnit"), reviver: off("reviver") }, { override: true });

/** A result as the learner should read it: exact-looking, never 0.30000000000000004. */
function show(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "function") {
    // `f(x) = x^2` evaluates to the function itself; its definition is the answer.
    const syntax = (value as { syntax?: string }).syntax;
    return syntax ?? "ƒ";
  }
  return math.format(value, { precision: 10 });
}

export type CalcRow = { expr: string; result?: string; error?: string };

/** Evaluate the lines in order, sharing one scope, as a session would. */
export function runCalc(lines: string[]): CalcRow[] {
  const scope = new Map<string, unknown>();
  return lines.map((expr) => {
    try {
      return { expr, result: show(math.evaluate(expr, scope)) };
    } catch (e) {
      return { expr, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

export type Sampled = {
  curves: { name: string; expr: string; points: [number, number][]; error?: string }[];
  points: { name: string; x: number; y: number }[];
  errors: string[];
};

/**
 * Sample every function across the x-window for the current slider values.
 * Complex and undefined results are NaN — a gap in the curve, which is what
 * √x left of zero should look like.
 */
export function sampleGraph(
  spec: GraphSpec,
  sliders: Record<string, number>,
  [x0, x1]: [number, number],
  samples = 400,
): Sampled {
  const scope = new Map<string, unknown>(Object.entries(sliders));
  const errors: string[] = [];
  for (const c of spec.constants) {
    try {
      scope.set(c.name, math.evaluate(c.expr, scope));
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);

  const curves = spec.functions.map((f) => {
    try {
      const code = math.compile(f.expr);
      const pts: [number, number][] = [];
      for (let i = 0; i <= samples; i++) {
        const x = x0 + ((x1 - x0) * i) / samples;
        scope.set("x", x);
        let y = NaN;
        try {
          y = num(code.evaluate(scope));
        } catch {
          // a domain error at one x is a gap, not a broken curve
        }
        pts.push([x, y]);
      }
      // Other functions may refer to this one by name: g(x) = f(x) + 1.
      scope.delete("x");
      scope.set(f.name, (x: number) => {
        const s = new Map(scope);
        s.set("x", x);
        return num(code.evaluate(s));
      });
      return { name: f.name, expr: f.expr, points: pts };
    } catch (e) {
      return { name: f.name, expr: f.expr, points: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const points = spec.points.flatMap((p) => {
    try {
      const x = num(math.evaluate(p.x, scope));
      const y = num(math.evaluate(p.y, scope));
      return Number.isFinite(x) && Number.isFinite(y) ? [{ name: p.name, x, y }] : [];
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  });

  return { curves, points, errors };
}
