import { describe, it, expect } from "vitest";
import { pricingFrom } from "@/lib/billing";
import type { BillingPlan } from "@/lib/billing";

/**
 * The landing page's price figures. These used to be strings typed into the
 * component, and both had drifted from the catalogue by the time anyone
 * checked — a marketing card must not be able to quote a price the checkout
 * would not charge. So the figure is built from the plan rows, and what is
 * pinned here is that it says what the rows say.
 *
 * This replaced a suite over `pricingLine`, which built one string spelling out
 * the whole ladder. The cases below are the same cases; what changed is that a
 * card now leads with the floor of its lane and keeps the ladder as a footnote,
 * so a missing upper tier no longer has to take the whole figure down with it.
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
  // Bespoke: no catalogue price at all, because it is sized to the client.
  plan({ id: "school_custom", name: "Schools — Custom", tier: "custom", price: null, priceUnit: "per_seat" }),
];

describe("pricingFrom", () => {
  it("leads the solo lane on Free and keeps the ladder underneath", () => {
    expect(pricingFrom("b2c", SOLO)).toEqual({
      amount: "Free",
      unit: "to start",
      rest: "then Plus $8 · Max $20 / mo",
    });
  });

  it("leads the school lane on the per-student floor", () => {
    expect(pricingFrom("b2b", SCHOOLS)).toEqual({
      amount: "$2",
      unit: "per student / month",
      rest: "Plus $4 / student / mo",
    });
  });

  it("follows the rows when a price moves, which is the whole point", () => {
    const raised = SOLO.map((p) => (p.id === "student_plus" ? { ...p, price: 12 } : p));
    expect(pricingFrom("b2c", raised)?.rest).toContain("Plus $12");

    const dearer = SCHOOLS.map((p) => (p.id === "school_standard" ? { ...p, price: 3 } : p));
    expect(pricingFrom("b2b", dearer)?.amount).toBe("$3");
  });

  it("never quotes Custom, even if someone puts a number on it", () => {
    // Custom is bespoke by definition — it has no catalogue price, and if a
    // number ever lands on that row it is an internal reference, not an offer.
    const numbered = SCHOOLS.map((p) => (p.id === "school_custom" ? { ...p, price: 6 } : p));
    const got = pricingFrom("b2b", numbered);
    expect(got?.amount).toBe("$2");
    expect(`${got?.amount}${got?.rest}`).not.toContain("$6");
  });

  it("formats a non-round price rather than truncating it", () => {
    const cents = SOLO.map((p) => (p.id === "student_plus" ? { ...p, price: 6.99 } : p));
    expect(pricingFrom("b2c", cents)?.rest).toContain("Plus $6.99");
  });

  it("keeps the headline when only an upper tier is missing", () => {
    // The floor is still true, so the card still has a number. This is the one
    // behaviour that deliberately differs from the line it replaced.
    const noMax = SOLO.filter((p) => p.id !== "student_max");
    expect(pricingFrom("b2c", noMax)).toEqual({ amount: "Free", unit: "to start", rest: "then Plus $8 / mo" });

    const noPlus = SCHOOLS.filter((p) => p.id !== "school_plus");
    expect(pricingFrom("b2b", noPlus)).toEqual({ amount: "$2", unit: "per student / month", rest: null });
  });

  it("returns nothing when the floor itself is missing", () => {
    // "Free to start" must not be printed by a catalogue with no free plan —
    // that would advertise a door nobody can walk through.
    expect(pricingFrom("b2c", SOLO.filter((p) => p.id !== "student_free"))).toBeNull();
    expect(pricingFrom("b2b", SCHOOLS.filter((p) => p.id !== "school_standard"))).toBeNull();
    expect(pricingFrom("b2c", [])).toBeNull();
    expect(pricingFrom("b2b", [])).toBeNull();
  });

  it("returns nothing when the floor exists but carries no price", () => {
    // A plan row with a null price is "ask us", not "free".
    const noPrice = SCHOOLS.map((p) => (p.id === "school_standard" ? { ...p, price: null } : p));
    expect(pricingFrom("b2b", noPrice)).toBeNull();
  });
});
