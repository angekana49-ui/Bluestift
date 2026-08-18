import { describe, it, expect, vi, afterEach } from "vitest";
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
  startOfDayIso,
  startOfMonthIso,
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

/**
 * The chat message quota. The cap exists on ONE tier and the reason is not
 * "Free gets less": chat is the core learning loop and the thing the product
 * sells, so metering it on a paid plan would be charging for the part that is
 * not defensible. Free is capped because it is the only place where the cost
 * that scales with use has nobody behind it.
 *
 * Beyond the numbers, two contracts: the pricing card has to say what the gate
 * enforces, and the day boundary has to be one a student can predict.
 */
describe("chat messages per day", () => {
  it("caps the free tier and nothing else", () => {
    expect(RAYA_ENTITLEMENTS.free.messagesPerDay).toBe(30);
    // Regression guard on a decision that was made, reversed, and made again:
    // a paid tier must not acquire a chat number. Both are still bounded by
    // the routes' daily abuse ceiling, which is not a plan quota.
    expect(RAYA_ENTITLEMENTS.plus.messagesPerDay).toBeNull();
    expect(RAYA_ENTITLEMENTS.max.messagesPerDay).toBeNull();
  });

  it("counts before the message is stored, so a limit of N lets N through", () => {
    const limit = RAYA_ENTITLEMENTS.free.messagesPerDay;
    expect(overQuota(29, limit)).toBe(false); // the 30th message
    expect(overQuota(30, limit)).toBe(true); // the 31st
  });

  it("states the number where there is one and promises unlimited where there is not", () => {
    const free = rayaFeatureBullets("free").join(" | ");
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.messagesPerDay} AI tutor messages / day`);
    expect(free).not.toMatch(/unlimited ai tutor/i);

    // The paid cards must say it in words. "Unlimited AI tutor messages / day"
    // — what a naive interpolation produces — reads like a limit that lost its
    // number, on the one line that is supposed to remove the doubt.
    const plus = rayaFeatureBullets("plus").join(" | ");
    expect(plus).toContain("Unlimited AI tutor chat");
    expect(plus).not.toMatch(/\d+ AI tutor messages/);
    expect(plus).not.toContain("Unlimited AI tutor messages / day");
  });
});

describe("startOfDayIso", () => {
  it("is midnight UTC of the day it is given, not the moment it is called", () => {
    expect(startOfDayIso(new Date("2026-08-18T21:47:13.412Z"))).toBe("2026-08-18T00:00:00.000Z");
    expect(startOfDayIso(new Date("2026-08-18T00:00:00.000Z"))).toBe("2026-08-18T00:00:00.000Z");
  });

  it("gives every instant of one day the same boundary, and the next day a new one", () => {
    const morning = startOfDayIso(new Date("2026-03-01T06:00:00Z"));
    const night = startOfDayIso(new Date("2026-03-01T23:59:59Z"));
    expect(morning).toBe(night);
    expect(startOfDayIso(new Date("2026-03-02T00:00:01Z"))).not.toBe(morning);
  });

  it("is a day boundary, not the month one", () => {
    const mid = new Date("2026-08-18T10:00:00Z");
    expect(startOfDayIso(mid)).not.toBe(startOfMonthIso(mid));
  });
});

/**
 * What a blocked student actually reads. Enforcement is off by default, so the
 * message is unreachable in the default build — these load the module with the
 * switch on, which is also the only coverage of the enforcing branch at all.
 */
describe("enforcement mode (ENTITLEMENTS_ENFORCE=true)", () => {
  async function loadEnforcing() {
    vi.resetModules();
    vi.stubEnv("ENTITLEMENTS_ENFORCE", "true");
    return import("@/lib/entitlements");
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("blocks a reached quota with a 429 worded for a daily period", async () => {
    const { gateQuota } = await loadEnforcing();
    const res = gateQuota(30, 30, { metric: "messages", period: "day", upgradeTo: "Plus" });
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    const body = await res?.json();
    expect(body.code).toBe("quota_reached");
    expect(body.error).toContain("your messages limit today (30)");
    // "this day" is what the old formatter produced.
    expect(body.error).not.toContain("this day");
  });

  it("keeps the weekly and monthly wording it already had", async () => {
    const { gateQuota } = await loadEnforcing();
    const week = await gateQuota(5, 5, { metric: "exports", period: "week" })?.json();
    expect(week.error).toContain("your exports limit this week (5)");
  });

  it("lets an unlimited plan through even while enforcing", async () => {
    const { gateQuota } = await loadEnforcing();
    expect(gateQuota(9_999, null, { metric: "messages", period: "day" })).toBeNull();
  });
});
