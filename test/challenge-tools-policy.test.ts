import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Challenges and the Maths panel (owner's decision, 2026-10-05).
 *
 * The panel's calculator solves equations. It stays available during a test —
 * and the tests are written to need more than it can give — EXCEPT during a
 * "calcul rapide", where the calculation is the test and the panel is locked.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the quick-maths challenge", () => {
  const route = read("app/api/challenges/create/route.ts");

  it("exists, and is stored as its own format", () => {
    expect(route).toContain('["quiz", "exam", "skills", "quickcalc"].includes(kindRaw)');
    expect(route).toContain('kind === "quickcalc" ? "quickcalc"');
    expect(read("supabase/migrations/20261005120000_challenge_quickcalc.sql")).toContain("'quickcalc'::text");
  });

  it("is offered in self-tests and in rooms", () => {
    for (const f of ["components/solo-challenge.tsx", "components/room-challenges.tsx"]) {
      expect(read(f), f).toContain('{ id: "quickcalc", labelKey: "tools.selfTest.kind.quickcalc.label"');
    }
    for (const loc of ["en", "fr", "es", "de"]) {
      expect(read(`lib/i18n/${loc}.ts`), loc).toContain('"tools.selfTest.kind.quickcalc.label"');
    }
  });

  it("locks the Maths panel while it is taken, and only then", () => {
    for (const f of ["components/solo-challenge.tsx", "components/room-challenges.tsx"]) {
      const src = read(f);
      expect(src, f).toContain('useMathsLock(view === "take" && active?.format === "quickcalc");');
      expect(src, f).toContain('useMathsAboveOverlay(view === "take" && active != null && active.format !== "quickcalc");');
    }
    // The solo list must read the format, or the lock could never see it.
    expect(read("components/solo-challenge.tsx")).toContain("archived_at, scope, format");
  });
});

describe("the other challenges, written for a learner with a calculator", () => {
  const route = read("app/api/challenges/create/route.ts");
  const fn = route.slice(route.indexOf("function testSystem"), route.indexOf("/** The stored `format`"));

  it("never ask for what the calculator would answer, and aim a notch higher", () => {
    expect(route).toContain("never ask for a bare computation or for solving an equation that is already written out");
    expect(route).toContain("one notch above the material's own level");
    // Quiz, exam and skills carry the rule; quick maths does not.
    expect(fn.match(/\$\{WITH_TOOLS\}/g)?.length).toBe(3);
    const quick = fn.slice(fn.indexOf('kind === "quickcalc"'), fn.indexOf('kind === "exam"'));
    expect(quick).not.toContain("WITH_TOOLS");
  });
});

describe("the panel during a test", () => {
  const shell = read("components/raya/raya-shell.tsx");
  const dock = read("components/raya/maths-dock.tsx");

  it("floats above the test screen, which otherwise covers it", () => {
    expect(shell).toContain("maths.aboveOverlay && !maths.locked ?");
    expect(shell).toContain("<MathsOverlayDock");
    expect(dock).toMatch(/export function MathsOverlayDock[\s\S]*?createPortal\(/);
  });

  it("stays shut while locked, and does not pop back open after", () => {
    expect(dock).toContain("const tool = locked ? null : rawTool;");
    expect(dock).toMatch(/setLockedState\(on\);\s*if \(on\) setRawTool\(null\);/);
    expect(shell).toContain("locked={maths.locked}");
  });
});
