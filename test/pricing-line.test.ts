import { describe, it, expect } from "vitest";
import { pricingLine } from "@/lib/billing";
import type { BillingPlan } from "@/lib/billing";

/**
 * The landing page's price lines. These used to be strings typed into the
 * component, and both had drifted from the catalogue by the time anyone
 * checked — a marketing card must not be able to quote a price the checkout
 * would not charge. So the line is built from the plan rows, and what is
 * pinned here is that it says what the rows say.
 */
function plan(over: Partial<BillingPlan> & Pick<BillingPlan, "id" | "name">): BillingPlan {
  return {
    description: null,
    category: null,
    tier: null,
    price: null,
    priceUnit: "flat",
    billingPeriod: "monthly",
    features: [],
    seatLimit: null,
    storageGb: null,
    ...over,
  };
}

const SOLO = [
  plan({ id: "student_free", name: "User — Free", tier: "standard", price: 0 }),
  plan({ id: "student_plus", name: "User — Plus", tier: "pro", price: 8 }),
  plan({ id: "student_max", name: "User — Max", tier: "custom", price: 20 }),
];

const SCHOOLS = [
  plan({ id: "school_standard", name: "Schools — Standard", tier: "standard", price: 2, priceUnit: "per_seat" }),
  plan({ id: "school_plus", name: "Schools — Plus", tier: "pro", price: 4, priceUnit: "per_seat" }),
  plan({ id: "school_custom", name: "Schools — Custom", tier: "custom", price: 6, priceUnit: "per_seat" }),
];

describe("pricingLine", () => {
  it("quotes the solo ladder from the rows", () => {
    expect(pricingLine("b2c", SOLO)).toBe("Free · Plus $8 · Max $20 / mo");
  });

  it("follows the rows when a price moves, which is the whole point", () => {
    const raised = SOLO.map((p) => (p.id === "student_plus" ? { ...p, price: 12 } : p));
    expect(pricingLine("b2c", raised)).toContain("Plus $12");
  });

  it("quotes the school ladder per student, and leaves Custom without a number", () => {
    const line = pricingLine("b2b", SCHOOLS);
    expect(line).toBe("Standard $2 · Plus $4 / student / mo");
    // Custom is a quote. Its price exists in the catalogue and must not surface
    // here as if it were a list price.
    expect(line).not.toContain("$6");
  });

  it("formats a non-round price rather than truncating it", () => {
    const cents = SOLO.map((p) => (p.id === "student_plus" ? { ...p, price: 6.99 } : p));
    expect(pricingLine("b2c", cents)).toContain("Plus $6.99");
  });

  it("returns null rather than half a line when a tier is missing", () => {
    expect(pricingLine("b2c", SOLO.filter((p) => p.id !== "student_max"))).toBeNull();
    expect(pricingLine("b2b", SCHOOLS.filter((p) => p.id !== "school_plus"))).toBeNull();
    expect(pricingLine("b2c", [])).toBeNull();
  });

  it("returns null when a tier exists but carries no price", () => {
    // A plan row with a null price is "ask us", not "free".
    const noPrice = SOLO.map((p) => (p.id === "student_max" ? { ...p, price: null } : p));
    expect(pricingLine("b2c", noPrice)).toBeNull();
  });
});
