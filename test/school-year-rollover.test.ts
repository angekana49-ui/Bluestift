import { describe, it, expect } from "vitest";
import {
  planClassCarryForward,
  isArchivedClass,
  deleteBlockReason,
  periodBounds,
  needsYearReconfirmation,
} from "@/lib/school-admin";
import { currentAcademicYear, academicYear } from "@/lib/school-constants";

// The rollover happens on the school's behalf, with no prompt, on the first
// admin visit after the year ends — i.e. the morning school comes back. What it
// carries forward decides whether the admin finds their setup or an empty
// dashboard, so the rule is checkable here without a database.

const cls = (
  name: string,
  extra: Partial<{ level: string | null; expected_size: number | null; max_overflow: number | null }> = {},
) => ({
  id: `c-${name}`,
  name,
  level: extra.level ?? null,
  expected_size: extra.expected_size ?? null,
  max_overflow: extra.max_overflow ?? null,
});

describe("planClassCarryForward", () => {
  it("recreates the ending year's class structure", () => {
    const plan = planClassCarryForward(
      [cls("Terminale C1", { level: "Lycee", expected_size: 30, max_overflow: 5 })],
      [],
    );
    expect(plan).toEqual([
      { name: "Terminale C1", level: "Lycee", expected_size: 30, max_overflow: 5 },
    ]);
  });

  it("carries no roster or code — only the shape", () => {
    // The plan is the insert payload: an `id` leaking through would clone the
    // old row wholesale and re-point last year's students at the new year.
    const plan = planClassCarryForward([cls("3e B")], []);
    expect(Object.keys(plan[0]).sort()).toEqual(["expected_size", "level", "max_overflow", "name"]);
  });

  it("adds nothing on a second run", () => {
    // Two admins opening /school at once both roll over; the second must be a
    // no-op rather than a duplicate class list.
    const previous = [cls("Terminale C1"), cls("3e B")];
    const first = planClassCarryForward(previous, []);
    const second = planClassCarryForward(previous, first.map((c) => c.name));
    expect(first).toHaveLength(2);
    expect(second).toEqual([]);
  });

  it("treats a name already in the new year as taken, whatever its case", () => {
    // Class names are compared case-insensitively when created (the POST route
    // uses ilike), so "terminale c2" must not slip past "Terminale C2".
    const plan = planClassCarryForward([cls("Terminale C2"), cls("1ere D")], ["  terminale c2 "]);
    expect(plan.map((c) => c.name)).toEqual(["1ere D"]);
  });

  it("collapses same-named classes in the source year", () => {
    const plan = planClassCarryForward([cls("6e A"), cls("6e a")], []);
    expect(plan.map((c) => c.name)).toEqual(["6e A"]);
  });

  it("has nothing to do for a school with no classes", () => {
    expect(planClassCarryForward([], ["Terminale C1"])).toEqual([]);
  });
});

describe("isArchivedClass", () => {
  it("locks a class that belongs to a past year", () => {
    expect(isArchivedClass("y2025", "y2026")).toBe(true);
  });

  it("leaves the current year's class editable", () => {
    expect(isArchivedClass("y2026", "y2026")).toBe(false);
  });

  it("locks a class attached to no year at all once a year is active", () => {
    // A stray row from before school years existed is not part of the live year,
    // so it must not be editable through the current-year screens either.
    expect(isArchivedClass(null, "y2026")).toBe(true);
  });

  it("locks nothing while the school has no active year", () => {
    // Everything the school has IS the present — there is no archive yet.
    expect(isArchivedClass("y2025", null)).toBe(false);
    expect(isArchivedClass(null, null)).toBe(false);
  });
});

describe("deleteBlockReason", () => {
  it("lets an empty class of the current year go", () => {
    // The rollover carries classes forward; dropping one the school no longer
    // runs is the counterpart, and must not need waiting a year.
    expect(deleteBlockReason(false, 0)).toBeNull();
  });

  it("refuses a class that holds students", () => {
    expect(deleteBlockReason(false, 3)).toMatch(/3 students/);
    expect(deleteBlockReason(false, 1)).toMatch(/1 student\b/);
  });

  it("refuses an archived class even when it is empty", () => {
    // A past year is a record. Emptiness is not permission to rewrite it.
    expect(deleteBlockReason(true, 0)).toMatch(/archived year/);
  });
});

describe("needsYearReconfirmation", () => {
  const base = { role: "prof" as const, currentYearId: "y2026", tracked: true };

  it("asks a teacher confirmed only for last year", () => {
    expect(needsYearReconfirmation({ ...base, confirmedYearId: "y2025" })).toBe(true);
  });

  it("leaves a teacher already confirmed for this year alone", () => {
    expect(needsYearReconfirmation({ ...base, confirmedYearId: "y2026" })).toBe(false);
  });

  it("asks a teacher who has never confirmed for any year", () => {
    expect(needsYearReconfirmation({ ...base, confirmedYearId: null })).toBe(true);
  });

  it("never asks an admin_master", () => {
    // Somebody has to be able to validate the others. An admin locked behind
    // their own gate would leave the whole school unable to come back.
    expect(
      needsYearReconfirmation({ ...base, role: "admin_master", confirmedYearId: "y2025" }),
    ).toBe(false);
  });

  it("asks nobody when the column isn't there yet", () => {
    // The migration is applied by hand. Until it is, `tracked` is false and the
    // app must behave exactly as before — a false positive here locks a real
    // teacher out of their own school.
    expect(needsYearReconfirmation({ ...base, tracked: false, confirmedYearId: null })).toBe(false);
  });

  it("asks nobody while the school has no active year", () => {
    expect(
      needsYearReconfirmation({ ...base, currentYearId: null, confirmedYearId: "y2025" }),
    ).toBe(false);
  });
});

describe("periodBounds", () => {
  // Most of what a school produces (reports, directives, payments, join
  // requests) carries no school year, so the archive attributes it by creation
  // date. This is that rule — an off-by-one here would file a whole day of the
  // school's work under the wrong year.
  it("covers the last day of the year", () => {
    const { gte, lt } = periodBounds("2025-09-01", "2026-08-31");
    expect(gte).toBe("2025-09-01T00:00:00.000Z");
    // Half-open: anything on Aug 31 is in, the first instant of Sep 1 is out.
    expect(lt).toBe("2026-09-01T00:00:00.000Z");
    expect("2026-08-31T23:59:59.000Z" < lt!).toBe(true);
    expect("2026-09-01T00:00:00.000Z" < lt!).toBe(false);
  });

  it("hands consecutive years a boundary with no gap and no overlap", () => {
    // The upper bound of one year is the lower bound of the next, so no entry
    // is counted twice and none falls between the two.
    expect(periodBounds("2025-09-01", "2026-08-31").lt).toBe(
      periodBounds("2026-09-01", "2027-08-31").gte,
    );
  });

  it("leaves an open side when only one date is on record", () => {
    expect(periodBounds(null, "2026-08-31").gte).toBeNull();
    expect(periodBounds("2025-09-01", null).lt).toBeNull();
  });

  it("attributes nothing when the year has no dates at all", () => {
    // Both bounds null is the signal the archive uses to skip period-based
    // sections entirely — an open range would file the school's whole history
    // under one year.
    expect(periodBounds(null, null)).toEqual({ gte: null, lt: null });
  });
});

describe("academic-year boundaries", () => {
  it("rolls a school over on September 1, not before", () => {
    // A school that set itself up in July sits in the year that ends Aug 31.
    // These two dates are exactly where the dashboard emptied itself.
    expect(currentAcademicYear(new Date("2026-07-06T12:00:00Z")).label).toBe("2025–2026");
    expect(currentAcademicYear(new Date("2026-09-03T12:00:00Z")).label).toBe("2026–2027");
  });

  it("ends a year the day before the next one starts", () => {
    // No gap and no overlap: a gap would leave a day with no current year, and
    // classes are scoped to the current year.
    const y = academicYear(2026);
    expect(y.start_date).toBe("2026-09-01");
    expect(academicYear(2025).end_date).toBe("2026-08-31");
    expect(new Date(y.start_date).getTime() - new Date(academicYear(2025).end_date).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });
});
