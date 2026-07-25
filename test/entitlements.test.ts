import { describe, it, expect } from "vitest";
import {
  normalizeRayaTier,
  normalizeSchoolTier,
  RAYA_ENTITLEMENTS,
  SCHOOL_ENTITLEMENTS,
  rayaFeatureBullets,
  schoolFeatureBullets,
  overQuota,
  gateFeature,
  gateQuota,
  assertFeature,
  assertQuota,
  ENTITLEMENTS_ENFORCE,
} from "@/lib/entitlements";

describe("tier normalization", () => {
  it("maps Raya plan names/tiers onto free|plus|max, degrading to free", () => {
    expect(normalizeRayaTier("User — Max")).toBe("max");
    expect(normalizeRayaTier("max")).toBe("max");
    expect(normalizeRayaTier("User — Plus")).toBe("plus");
    expect(normalizeRayaTier("pro")).toBe("plus");
    expect(normalizeRayaTier("User — Free")).toBe("free");
    expect(normalizeRayaTier(null)).toBe("free");
    expect(normalizeRayaTier("something unknown")).toBe("free");
  });

  it("maps School plan names/tiers onto standard|plus|custom, degrading to standard", () => {
    expect(normalizeSchoolTier("custom")).toBe("custom");
    expect(normalizeSchoolTier("École / devis")).toBe("custom");
    expect(normalizeSchoolTier("Plus")).toBe("plus");
    expect(normalizeSchoolTier("Standard")).toBe("standard");
    expect(normalizeSchoolTier(null)).toBe("standard");
    // Regression: "École — …" names must NOT all collapse to custom (the audience
    // prefix is not a tier signal).
    expect(normalizeSchoolTier("École — Standard")).toBe("standard");
  });

  // The resolvers feed "<name> <tier>" to the normalizers (planSignal), so pin the
  // ACTUAL seeded rows: the b2c ladder is standard/pro/custom, where tier "custom"
  // is really the Max plan — only the name reveals it. A naive tier-only match
  // would silently serve a paying Max user the Free set.
  it("resolves the real seeded plan rows correctly (name + tier combined)", () => {
    expect(normalizeRayaTier("User — Free standard")).toBe("free");
    expect(normalizeRayaTier("User — Plus pro")).toBe("plus");
    expect(normalizeRayaTier("User — Max custom")).toBe("max");
    expect(normalizeSchoolTier("Schools — Standard standard")).toBe("standard");
    expect(normalizeSchoolTier("Schools — Plus pro")).toBe("plus");
    expect(normalizeSchoolTier("Schools — Custom custom")).toBe("custom");
  });
});

describe("entitlement grid matches the frozen Forfaits pricing", () => {
  it("Raya: PDF/voice are paid; Free is quota-capped; Max is unlimited", () => {
    expect(RAYA_ENTITLEMENTS.free.pdfExport).toBe(false);
    expect(RAYA_ENTITLEMENTS.plus.pdfExport).toBe(true);
    expect(RAYA_ENTITLEMENTS.free.voiceInput).toBe(false);
    expect(RAYA_ENTITLEMENTS.free.roomsPerMonth).toBe(3);
    expect(RAYA_ENTITLEMENTS.free.exportsPerWeek).toBe(5);
    expect(RAYA_ENTITLEMENTS.free.kernelAnalysisPerWeek).toBe(1);
    expect(RAYA_ENTITLEMENTS.free.roomTimerOptional).toBe(false); // timer mandatory
    expect(RAYA_ENTITLEMENTS.max.uploadsPerMonth).toBeNull(); // unlimited
    expect(RAYA_ENTITLEMENTS.max.generationsPerMonth).toBeNull();
  });

  it("Schools: AI grading laddered 5 → 75 → ∞; LMS is Custom-only", () => {
    expect(SCHOOL_ENTITLEMENTS.standard.aiGradingPerMonthPerProf).toBe(5);
    expect(SCHOOL_ENTITLEMENTS.plus.aiGradingPerMonthPerProf).toBe(75);
    expect(SCHOOL_ENTITLEMENTS.custom.aiGradingPerMonthPerProf).toBeNull();
    expect(SCHOOL_ENTITLEMENTS.standard.preparePerMonthPerProf).toBe(30);
    expect(SCHOOL_ENTITLEMENTS.plus.preparePerMonthPerProf).toBe(150);
    expect(SCHOOL_ENTITLEMENTS.standard.lms).toBe(false);
    expect(SCHOOL_ENTITLEMENTS.custom.lms).toBe(true);
    expect(SCHOOL_ENTITLEMENTS.standard.reportsPerWeekPerProf).toBe(1);
  });
});

// The public pricing cards read their bullets from these builders, so pin that
// the numbers/flags shown are the SAME source of truth the gates enforce — a
// quota change in the matrix must flow to the card, never drift from it.
describe("pricing-card bullets are derived from the entitlement matrix", () => {
  it("Raya cards echo the real quotas (Free capped, higher tiers unlimited)", () => {
    const free = rayaFeatureBullets("free").join(" | ");
    // Free's monthly generation/upload cap is shown verbatim from the matrix.
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.generationsPerMonth} study generations`);
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.uploadsPerMonth} uploads`);
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.roomsPerMonth} study rooms`);

    // Max's null (unlimited) quotas surface as "Unlimited", never a number.
    const max = rayaFeatureBullets("max").join(" | ");
    expect(max).toContain("Unlimited generations & uploads");
    expect(max).toContain(`${RAYA_ENTITLEMENTS.max.roomMaxParticipants} participants`);
  });

  it("School cards echo the ladder (Standard capped, Custom unlimited + LMS/SSO)", () => {
    const standard = schoolFeatureBullets("standard").join(" | ");
    expect(standard).toContain(`${SCHOOL_ENTITLEMENTS.standard.preparePerMonthPerProf} lesson preps`);
    expect(standard).toContain(`${SCHOOL_ENTITLEMENTS.standard.aiGradingPerMonthPerProf} AI gradings`);

    const custom = schoolFeatureBullets("custom").join(" | ");
    expect(custom).toContain("Unlimited preps, gradings & exports");
    expect(custom).toContain("LMS sync, SSO & multi-school administration");
  });

  it("every tier renders a non-empty bullet list", () => {
    for (const tier of ["free", "plus", "max"] as const) {
      expect(rayaFeatureBullets(tier).length).toBeGreaterThan(0);
    }
    for (const tier of ["standard", "plus", "custom"] as const) {
      expect(schoolFeatureBullets(tier).length).toBeGreaterThan(0);
    }
  });
});

describe("overQuota", () => {
  it("treats null as unlimited and >= as reached", () => {
    expect(overQuota(5, 5)).toBe(true);
    expect(overQuota(4, 5)).toBe(false);
    expect(overQuota(0, 0)).toBe(true);
    expect(overQuota(1_000_000, null)).toBe(false);
  });
});

// The default (pre-launch) state is monitor mode: gates observe but never block.
// These tests pin that contract so nothing starts enforcing by accident before
// the paid plans are seeded and ENTITLEMENTS_ENFORCE is deliberately flipped.
describe("monitor mode (ENTITLEMENTS_ENFORCE off by default)", () => {
  it("is off unless explicitly enabled", () => {
    expect(ENTITLEMENTS_ENFORCE).toBe(false);
  });

  it("gate helpers never block while in monitor mode", () => {
    expect(gateFeature(false, { feature: "voice_input" })).toBeNull();
    expect(gateQuota(99, 5, { metric: "exports" })).toBeNull();
  });

  it("assert helpers never throw while in monitor mode", () => {
    expect(() => assertFeature(false, { feature: "private_room" })).not.toThrow();
    expect(() => assertQuota(99, 3, { metric: "rooms" })).not.toThrow();
  });
});
