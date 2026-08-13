import { describe, expect, it } from "vitest";
import { audienceLines, resolveAudience } from "@/lib/raya/audience";

/** Fixed "today" so the arithmetic is stable whenever this suite runs. */
const NOW = new Date("2026-06-15T00:00:00Z");

describe("resolveAudience — the safety band", () => {
  it("comes from the birth year, never from the declared level", () => {
    // A 12-year-old who picked "university" during onboarding is still 12.
    const a = resolveAudience({ birthYear: 2013, schoolLevel: "university", now: NOW });
    expect(a.band).toBe("child");
    expect(a.stage).toBe("adult");
    expect(a.stageSource).toBe("declared");
  });

  it("is null when no year has been declared", () => {
    expect(resolveAudience({ birthYear: null, now: NOW }).band).toBeNull();
  });

  it("rounds down, so a student turning 13 this year is still a child", () => {
    expect(resolveAudience({ birthYear: 2013, now: NOW }).band).toBe("child");
    expect(resolveAudience({ birthYear: 2012, now: NOW }).band).toBe("teen");
  });
});

describe("resolveAudience — the teaching stage", () => {
  it("prefers the level the student picked themselves", () => {
    const a = resolveAudience({ birthYear: 2008, schoolLevel: "middle_school", now: NOW });
    expect(a.stage).toBe("lower_secondary");
    expect(a.stageSource).toBe("declared");
  });

  it("falls back to the birth year for 'other' and for unknown values", () => {
    for (const level of ["other", "apprenticeship", ""]) {
      const a = resolveAudience({ birthYear: 2012, schoolLevel: level, now: NOW });
      expect(a.stage).toBe("lower_secondary");
      expect(a.stageSource).toBe("estimated");
    }
  });

  it("estimates a stage across the whole range", () => {
    const stageOf = (birthYear: number) =>
      resolveAudience({ birthYear, now: NOW }).stage;
    expect(stageOf(2018)).toBe("primary"); // min age 7
    expect(stageOf(2014)).toBe("lower_secondary"); // min age 11
    expect(stageOf(2010)).toBe("upper_secondary"); // min age 15
    expect(stageOf(2007)).toBe("adult"); // min age 18
  });

  it("is null when there is nothing at all to go on", () => {
    const a = resolveAudience({ now: NOW });
    expect(a.stage).toBeNull();
    expect(a.stageSource).toBeNull();
  });
});

describe("audienceLines", () => {
  it("emits nothing when nothing is known", () => {
    expect(audienceLines(resolveAudience({ now: NOW }))).toEqual([]);
  });

  it("marks an estimated level as a floor, not a ceiling", () => {
    const [, level] = audienceLines(resolveAudience({ birthYear: 2014, now: NOW }));
    expect(level).toContain("FLOOR");
    expect(level).toContain("follow the student");
  });

  it("does not mark a declared level as an estimate", () => {
    const [, level] = audienceLines(
      resolveAudience({ birthYear: 2014, schoolLevel: "high_school", now: NOW }),
    );
    expect(level).toContain("chose this level themselves");
    expect(level).not.toContain("FLOOR");
  });

  it("never leaks the birth year or the age into the prompt", () => {
    const text = audienceLines(
      resolveAudience({ birthYear: 2013, schoolLevel: "middle_school", now: NOW }),
    ).join("\n");
    expect(text).not.toContain("2013");
    expect(text).not.toMatch(/\b12\b/);
  });

  it("names a child as a child, so the safety rules have something to bite on", () => {
    const [band] = audienceLines(resolveAudience({ birthYear: 2016, now: NOW }));
    expect(band).toContain('value="child"');
  });
});
