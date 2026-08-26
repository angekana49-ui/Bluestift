import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeRayaTier,
  normalizeSchoolTier,
  RAYA_ENTITLEMENTS,
  SCHOOL_ENTITLEMENTS,
  rayaComparison,
  rayaFeatureBullets,
  schoolComparison,
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

  // A room holds 8 on the free plan, and privacy runs the other way from every
  // other flag here: it is the plan that CANNOT choose which gets the safe
  // setting. Both are easy to invert by accident, and inverting either one is a
  // child-safety regression rather than a pricing one.
  it("Rooms: 8 seats on Free, and Free cannot open a room to the public", () => {
    expect(RAYA_ENTITLEMENTS.free.roomMaxParticipants).toBe(8);
    // The ladder still climbs above the free floor — rooms get bigger, paid.
    expect(RAYA_ENTITLEMENTS.plus.roomMaxParticipants).toBeGreaterThan(8);
    expect(RAYA_ENTITLEMENTS.max.roomMaxParticipants).toBeGreaterThan(
      RAYA_ENTITLEMENTS.plus.roomMaxParticipants,
    );

    // false = no choice = private, always. Read it as "may choose", never as
    // "may have a private room" — that was the old flag and the opposite rule.
    expect(RAYA_ENTITLEMENTS.free.roomVisibilityChoice).toBe(false);
    expect(RAYA_ENTITLEMENTS.plus.roomVisibilityChoice).toBe(true);
    expect(RAYA_ENTITLEMENTS.max.roomVisibilityChoice).toBe(true);
  });

  it("Rooms: the private Raya channel is metered per month, unlimited on Max", () => {
    expect(RAYA_ENTITLEMENTS.free.privateRayaPerMonth).toBe(3);
    expect(RAYA_ENTITLEMENTS.plus.privateRayaPerMonth).toBe(50);
    expect(RAYA_ENTITLEMENTS.max.privateRayaPerMonth).toBeNull();
  });

  // A ladder that goes backwards anywhere is a bug you only discover from a
  // customer who paid to get less. Checked over every numeric field in both
  // families rather than the handful spelled out above, so a quota added later
  // is covered the day it is added and nobody has to remember this file.
  it("never sells a worse limit for more money, on any numeric quota", () => {
    const climbs = (name: string, rungs: (number | null)[]) => {
      for (let i = 1; i < rungs.length; i++) {
        const lower = rungs[i - 1];
        const upper = rungs[i];
        // null is unlimited: fine above anything, never acceptable below a cap.
        if (upper === null) continue;
        if (lower === null) {
          throw new Error(`${name}: tier ${i} caps at ${upper} where tier ${i - 1} was unlimited`);
        }
        expect(upper, `${name} went backwards at tier ${i}`).toBeGreaterThanOrEqual(lower);
      }
    };

    const numeric = <T extends object>(o: T) =>
      (Object.keys(o) as (keyof T)[]).filter((k) => {
        const v = o[k];
        return v === null || typeof v === "number";
      });

    for (const k of numeric(RAYA_ENTITLEMENTS.free)) {
      climbs(`raya.${String(k)}`, [
        RAYA_ENTITLEMENTS.free[k],
        RAYA_ENTITLEMENTS.plus[k],
        RAYA_ENTITLEMENTS.max[k],
      ] as (number | null)[]);
    }
    for (const k of numeric(SCHOOL_ENTITLEMENTS.standard)) {
      climbs(`school.${String(k)}`, [
        SCHOOL_ENTITLEMENTS.standard[k],
        SCHOOL_ENTITLEMENTS.plus[k],
        SCHOOL_ENTITLEMENTS.custom[k],
      ] as (number | null)[]);
    }
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
    // Matched loosely on purpose: this assertion used to pin the bullet's exact
    // wording, so it failed on a copy edit that changed no behaviour at all —
    // which teaches everyone to update the expected string without reading it.
    // What has to hold is that an unlimited quota never prints as a figure.
    const max = rayaFeatureBullets("max").join(" | ");
    expect(max).toMatch(/Unlimited .*generations & uploads/);
    expect(max).not.toMatch(/\d+\s+(study\s+)?generations/);
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

// The comparison grid on /pricing is the page's answer to "what do I get, and
// up to what limit". Every cell is derived from the matrix above, so these pin
// the derivation rather than the prose.
describe("the /pricing comparison grid", () => {
  const all = () => [...rayaComparison(), ...schoolComparison()];

  it("gives every row one cell per tier, and never leaks a raw null", () => {
    for (const g of all()) {
      expect(g.rows.length).toBeGreaterThan(0);
      for (const r of g.rows) {
        expect(r.label.trim()).not.toBe("");
        // Three tiers in both ladders. A row short of a cell would silently
        // shift every value after it one column to the left.
        expect(r.cells).toHaveLength(3);
        for (const c of r.cells) {
          // `null` is the deliberate "not included" marker the view renders as
          // an em dash. What must never appear is a quota that stringified its
          // own absence — "null / month", "undefined years", "NaN".
          if (c !== null) {
            expect(c.trim()).not.toBe("");
            expect(c).not.toMatch(/null|undefined|NaN/);
          }
        }
      }
    }
  });

  it("reads its numbers off the same objects the gates read", () => {
    const solo = rayaComparison().flatMap((g) => g.rows);
    const chat = solo.find((r) => r.label === "AI tutor messages");
    expect(chat?.cells[0]).toBe(`${RAYA_ENTITLEMENTS.free.messagesPerDay} / day`);
    // Free is capped, both paid tiers are not — the shape of the whole ladder.
    expect(chat?.cells[1]).toBe("Unlimited");

    const school = schoolComparison().flatMap((g) => g.rows);
    const preps = school.find((r) => r.label === "Lesson preparations");
    expect(preps?.cells[0]).toContain(`${SCHOOL_ENTITLEMENTS.standard.preparePerMonthPerProf}`);
    expect(preps?.cells[1]).toContain(`${SCHOOL_ENTITLEMENTS.plus.preparePerMonthPerProf}`);

    // SSO and LMS are Custom-only, and the entry tier must say so with a null
    // rather than a cheerful blank.
    const sso = school.find((r) => r.label === "Single sign-on");
    expect(sso?.cells).toEqual([null, null, "Included"]);
  });

  it("never advertises a capability nothing implements", () => {
    // `audioInfographic` is flagged in the matrix as still to ship, and unlike
    // every other feature flag NO route reads it. It was nonetheless sold on
    // the Max card as "Audio summaries & infographics" — the single most
    // expensive plan promising the one thing that does not exist. This is the
    // assertion that would have caught it, so it guards the whole surface: the
    // bullets AND the grid, for every tier.
    expect(RAYA_ENTITLEMENTS.max.audioInfographic).toBe(true); // still gated off
    const sold = [
      ...(["free", "plus", "max"] as const).flatMap(rayaFeatureBullets),
      ...(["standard", "plus", "custom"] as const).flatMap(schoolFeatureBullets),
      ...all().flatMap((g) => g.rows.flatMap((r) => [r.label, r.hint ?? "", ...r.cells.map((c) => c ?? "")])),
    ].join(" | ");
    expect(sold).not.toMatch(/infographic/i);
    expect(sold).not.toMatch(/audio summar/i);
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
