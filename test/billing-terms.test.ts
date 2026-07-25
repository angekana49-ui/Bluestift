import { describe, it, expect } from "vitest";
import {
  ANNUAL_DISCOUNT,
  MIN_B2B_SEATS,
  isAnnualTerm,
  termFactor,
  annualMonthlyRate,
  termTotal,
} from "@/lib/billing/terms";

describe("billing terms", () => {
  it("annual discount is 15% and the B2B floor is 100 seats", () => {
    expect(ANNUAL_DISCOUNT).toBe(0.15);
    expect(MIN_B2B_SEATS).toBe(100);
  });

  it("only 12+ month terms count as annual", () => {
    expect(isAnnualTerm(12)).toBe(true);
    expect(isAnnualTerm(13)).toBe(true);
    expect(isAnnualTerm(3)).toBe(false);
    expect(isAnnualTerm(1)).toBe(false);
    expect(termFactor(12)).toBe(0.85);
    expect(termFactor(1)).toBe(1);
  });

  it("Raya Max $20/mo → $17/mo billed annually → $204 for the year", () => {
    expect(annualMonthlyRate(20)).toBe(17);
    expect(termTotal(20 * 12, 12)).toBe(204);
  });

  it("monthly and quarterly terms are charged at full price", () => {
    expect(termTotal(20 * 1, 1)).toBe(20);
    expect(termTotal(20 * 3, 3)).toBe(60);
  });

  it("per-seat annual: rate × seats × 12 less 15%", () => {
    // e.g. $2/student/mo × 100 students × 12 mo = $2400 → $2040 annually
    expect(termTotal(2 * 100 * 12, 12)).toBe(2040);
  });
});
