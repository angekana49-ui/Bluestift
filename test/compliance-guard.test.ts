import { describe, expect, it } from "vitest";
import { needsAgeGate } from "@/lib/compliance/guard";

/**
 * The page-level gate. Its job is to be boring and to fail closed — every app
 * page calls it, so a wrong `false` here silently opens every surface.
 */
describe("needsAgeGate", () => {
  const adultYear = new Date().getUTCFullYear() - 30;
  const childYear = new Date().getUTCFullYear() - 8;

  it("lets an adult through", () => {
    expect(needsAgeGate({ birth_year: adultYear })).toBe(false);
  });

  it("gates an account that has never answered — including one that predates the question", () => {
    expect(needsAgeGate({ birth_year: null })).toBe(true);
    expect(needsAgeGate({})).toBe(true);
    expect(needsAgeGate(null)).toBe(true);
    expect(needsAgeGate(undefined)).toBe(true);
  });

  it("gates an under-13 with no school", () => {
    expect(needsAgeGate({ birth_year: childYear })).toBe(true);
  });

  it("lets an under-13 through once a school vouches", () => {
    expect(needsAgeGate({ birth_year: childYear, school_id: "s1" })).toBe(false);
    expect(needsAgeGate({ birth_year: childYear, minor_consent_source: "school" })).toBe(false);
  });
});
