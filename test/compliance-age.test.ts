import { describe, expect, it } from "vitest";
import {
  ageBand,
  allowsOptionalProcessing,
  evaluateAccess,
  isPlausibleBirthYear,
  minimumAge,
} from "@/lib/compliance/age";

/**
 * These rules decide whether a child can use the product at all, so they are
 * asserted rather than trusted. The bias under test is one-directional: it is
 * always safe to treat a student as younger than they are, and never safe to
 * treat them as older.
 */

const NOW = new Date("2026-08-13T00:00:00Z");

describe("minimumAge", () => {
  it("assumes this year's birthday has not happened yet", () => {
    // Born in 2013: 13 by the end of 2026, but could still be 12 today.
    expect(minimumAge(2013, NOW)).toBe(12);
  });
});

describe("ageBand", () => {
  it("keeps a student on the wrong side of 13 until the year after", () => {
    expect(ageBand(2013, NOW)).toBe("child"); // may still be 12
    expect(ageBand(2012, NOW)).toBe("teen"); // 13 at the youngest
  });

  it("keeps a student a minor until 18 is certain", () => {
    expect(ageBand(2008, NOW)).toBe("teen"); // may still be 17
    expect(ageBand(2007, NOW)).toBe("adult"); // 18 at the youngest
  });

  it("returns null rather than guessing when nothing is declared", () => {
    expect(ageBand(null, NOW)).toBeNull();
    expect(ageBand(undefined, NOW)).toBeNull();
  });

  it("refuses implausible years instead of banding them", () => {
    expect(ageBand(1600, NOW)).toBeNull();
    expect(ageBand(2030, NOW)).toBeNull(); // the future
    expect(ageBand(2026.5, NOW)).toBeNull();
    expect(isPlausibleBirthYear(2026, NOW)).toBe(true);
  });
});

describe("allowsOptionalProcessing", () => {
  it("withholds analytics and training from every minor", () => {
    expect(allowsOptionalProcessing("child")).toBe(false);
    expect(allowsOptionalProcessing("teen")).toBe(false);
    expect(allowsOptionalProcessing("adult")).toBe(true);
  });

  // The moment we know least about a user is the moment to grant least.
  it("withholds them when no age is on file", () => {
    expect(allowsOptionalProcessing(null)).toBe(false);
  });
});

describe("evaluateAccess", () => {
  it("lets teens and adults straight through", () => {
    expect(evaluateAccess({ birthYear: 2008, now: NOW }).allowed).toBe(true);
    expect(evaluateAccess({ birthYear: 1990, now: NOW }).allowed).toBe(true);
  });

  it("refuses an under-13 with nobody acting for them", () => {
    const d = evaluateAccess({ birthYear: 2016, now: NOW });
    expect(d).toEqual({ allowed: false, band: "child", reason: "needs_school_or_parent" });
  });

  it("admits an under-13 whose school vouches — the COPPA school exception", () => {
    expect(evaluateAccess({ birthYear: 2016, schoolId: "s1", now: NOW }).allowed).toBe(true);
    expect(
      evaluateAccess({ birthYear: 2016, minorConsentSource: "school", now: NOW }).allowed,
    ).toBe(true);
    expect(
      evaluateAccess({ birthYear: 2016, minorConsentSource: "parent", now: NOW }).allowed,
    ).toBe(true);
  });

  it("does not treat an unrecognised consent source as authorisation", () => {
    const d = evaluateAccess({ birthYear: 2016, minorConsentSource: "self", now: NOW });
    expect(d.allowed).toBe(false);
  });

  it("asks for an age rather than assuming one", () => {
    expect(evaluateAccess({ birthYear: null, now: NOW })).toEqual({
      allowed: false,
      band: null,
      reason: "age_undeclared",
    });
  });
});
