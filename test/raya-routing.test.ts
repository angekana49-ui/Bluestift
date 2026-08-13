import { describe, expect, it } from "vitest";
import { routeTier } from "@/lib/raya/routing";
import type { ConceptStateOut, LoadProfileResponse } from "@/lib/kernel/types";

/**
 * The router decides how much a turn costs, so its rules are asserted rather
 * than trusted. The bias under test is deliberate and one-directional: it is
 * always safe to spend more on a struggling student and never safe to spend
 * less — every ambiguous or missing signal must land on "deep".
 */

function concept(k: number): ConceptStateOut {
  return {
    concept_id: "c1",
    label: "fractions",
    k_raw: k,
    k_effective: k,
    v_score: 0.5,
    p_score: 0.5,
    status: "partial",
    last_interaction_at: null,
  };
}

function profile(states: ConceptStateOut[], mindset?: string): LoadProfileResponse {
  return {
    user_id: "u1",
    concept_states: states,
    mindset: mindset ? { m_score: 0.5, detected_mindset: mindset } : null,
    last_kernel_update: null,
  };
}

describe("routeTier", () => {
  it("sends a settled student to the cheap tier — the case the pricing rests on", () => {
    const r = routeTier(profile([concept(0.8), concept(0.7)]), []);
    expect(r.tier).toBe("fast");
  });

  it("escalates on any active alert, and names it", () => {
    const r = routeTier(profile([concept(0.9)]), [{ type: "false_mastery" }]);
    expect(r.tier).toBe("deep");
    expect(r.reason).toContain("false_mastery");
  });

  it("escalates on low average mastery even with no alert", () => {
    expect(routeTier(profile([concept(0.2), concept(0.3)]), []).tier).toBe("deep");
  });

  it("treats the 0.4 mastery boundary as not-yet-struggling", () => {
    expect(routeTier(profile([concept(0.4)]), []).tier).toBe("fast");
    expect(routeTier(profile([concept(0.39)]), []).tier).toBe("deep");
  });

  it("escalates a fixed mindset regardless of mastery", () => {
    const r = routeTier(profile([concept(0.95)], "fixed"), []);
    expect(r.tier).toBe("deep");
    expect(r.reason).toBe("mindset:fixed");
  });

  it("does not escalate a growth mindset", () => {
    expect(routeTier(profile([concept(0.8)], "growth"), []).tier).toBe("fast");
  });

  it("an alert outranks otherwise-healthy signals", () => {
    const r = routeTier(profile([concept(0.9)], "growth"), [{ type: "passive_dependency" }]);
    expect(r.tier).toBe("deep");
  });

  // A brand-new student has no concept states and no alerts. That is the moment
  // the tutor knows least about them, so it must not be read as "doing fine".
  it("does not escalate on an empty profile, but never crashes on one", () => {
    expect(routeTier(null, []).tier).toBe("fast");
    expect(routeTier(profile([]), []).tier).toBe("fast");
    expect(() => routeTier(null)).not.toThrow();
  });
});
