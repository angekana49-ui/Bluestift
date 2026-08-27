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
  rayaTagline,
  schoolTagline,
  overQuota,
  gateFeature,
  gateQuota,
  assertFeature,
  assertQuota,
  ENTITLEMENTS_ENFORCE,
  startOfDayIso,
  startOfMonthIso,
} from "@/lib/entitlements";
import { lookup, type MessageKey } from "@/lib/i18n";

// The bullets/tagline/comparison builders are translated (see lib/entitlements
// and lib/i18n/en.ts) — these assertions pin the English source text, which is
// what lookup("en", …) returns, so pass it through the same way the real
// /pricing page does (getServerTranslate() there, this here).
const tr = (key: MessageKey) => lookup("en", key);

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
    const free = rayaFeatureBullets("free", tr).join(" | ");
    // Free's monthly generation/upload cap is shown verbatim from the matrix.
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.generationsPerMonth} study generations`);
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.uploadsPerMonth} uploads`);
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.roomsPerMonth} study rooms`);

    // Max's null (unlimited) quotas surface as "Unlimited", never a number.
    // Matched loosely on purpose: this assertion used to pin the bullet's exact
    // wording, so it failed on a copy edit that changed no behaviour at all —
    // which teaches everyone to update the expected string without reading it.
    // What has to hold is that an unlimited quota never prints as a figure.
    const max = rayaFeatureBullets("max", tr).join(" | ");
    expect(max).toMatch(/Unlimited[^|]*generations/);
    expect(max).toMatch(/Unlimited[^|]*uploads/);
    expect(max).not.toMatch(/\d+\s+(study\s+)?generations/);
    // The room ceiling stays a figure, because it IS one — but it is the only
    // one on this card, and it must be the matrix's.
    expect(max).toContain(`${RAYA_ENTITLEMENTS.max.roomMaxParticipants}`);
  });

  /**
   * Max's card makes exactly one claim — "nothing left to count" — and it is a
   * property of the matrix, not a slogan: every per-period quota on the tier is
   * null. That was worth saying because the card previously read as three
   * numbers going up, which is a rounding error rather than a reason to pay.
   *
   * Checked by reflection over the field NAMES so a quota added later is
   * covered the day it is added. The claim is the kind that stops being true
   * quietly: someone caps one thing on Max for a good reason, and the most
   * expensive plan is left advertising an absolute it no longer keeps.
   */
  it("Max counts nothing at all, and Plus still counts something", () => {
    const counted = (t: "plus" | "max") =>
      Object.entries(RAYA_ENTITLEMENTS[t])
        .filter(([k]) => /(PerDay|PerWeek|PerMonth|PerRoom)$/.test(k))
        .filter(([, v]) => v !== null)
        .map(([k]) => k);

    expect(counted("max")).toEqual([]);
    // Without this half the assertion above is satisfied by a ladder with no
    // rungs — if Plus stops counting too, Max's whole delta has evaporated and
    // the card is selling a difference that no longer exists.
    expect(counted("plus").length).toBeGreaterThan(0);

    // Going from 50/month to uncounted is Max's most substantial single delta
    // and the card omitted it entirely while listing two smaller ones.
    expect(RAYA_ENTITLEMENTS.plus.privateRayaPerMonth).not.toBeNull();
    expect(rayaFeatureBullets("max", tr).join(" | ")).toMatch(/private sessions with Raya/i);
  });

  it("School cards echo the ladder (Standard capped, Custom unlimited + LMS/SSO)", () => {
    const standard = schoolFeatureBullets("standard", tr).join(" | ");
    expect(standard).toContain(`${SCHOOL_ENTITLEMENTS.standard.preparePerMonthPerProf} lesson preps`);
    expect(standard).toContain(`${SCHOOL_ENTITLEMENTS.standard.aiGradingPerMonthPerProf} AI gradings`);

    const custom = schoolFeatureBullets("custom", tr).join(" | ");
    expect(custom).toMatch(/Unlimited preps, gradings/);
    expect(custom).toContain("LMS sync, SSO & multi-school administration");
  });

  /**
   * No card opens on bookkeeping.
   *
   * Every tier above the first used to lead with "Everything in <tier below>,
   * plus:" — a line that argues nothing, because a dearer plan giving more is
   * the premise, not a feature. It also cost the card its most valuable slot:
   * the first bullet is the one a scanning reader actually reads.
   *
   * The reason it was there is real, though, and this test is the place to
   * record it: it stopped a SHORTER card from reading as a smaller offer. Max
   * listed three increments against Plus's eight, and without the header a
   * reader scanning two columns would have concluded that the expensive plan
   * gave less. So the cards were made self-contained rather than incremental —
   * each one lists what its tier gives, and the ladder shows in the values. If
   * a future edit trims a higher card back below the one under it, that is the
   * regression to look for, not this assertion.
   */
  it("no card opens on 'Everything in ...', and none is shorter than the tier below", () => {
    const raya = (["free", "plus", "max"] as const).map((tier) => rayaFeatureBullets(tier, tr));
    const school = (["standard", "plus", "custom"] as const).map((tier) => schoolFeatureBullets(tier, tr));

    for (const bullets of [...raya, ...school]) {
      for (const b of bullets) expect(b).not.toMatch(/^Everything in /i);
      // A bullet ending in a colon is the same move wearing a different hat.
      for (const b of bullets) expect(b.trimEnd()).not.toMatch(/:$/);
    }

    for (const ladder of [raya, school]) {
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i].length).toBeGreaterThanOrEqual(ladder[i - 1].length);
      }
    }
  });

  it("every tier renders a non-empty bullet list", () => {
    for (const tier of ["free", "plus", "max"] as const) {
      expect(rayaFeatureBullets(tier, tr).length).toBeGreaterThan(0);
    }
    for (const tier of ["standard", "plus", "custom"] as const) {
      expect(schoolFeatureBullets(tier, tr).length).toBeGreaterThan(0);
    }
  });
});

// The comparison grid on /pricing is the page's answer to "what do I get, and
// up to what limit". Every cell is derived from the matrix above, so these pin
// the derivation rather than the prose.
describe("the /pricing comparison grid", () => {
  const all = () => [...rayaComparison(tr), ...schoolComparison(tr)];

  /**
   * EVERY word the pricing page prints about a plan, from every derived source
   * — the tagline, the bullets and the grid, across both ladders. The point of
   * gathering them into one string is that a claim only has to be retired once:
   * an assertion written against this cannot be satisfied by moving the phrase
   * to whichever surface the test was not looking at.
   */
  const sold = () =>
    [
      ...(["free", "plus", "max"] as const).map((tier) => rayaTagline(tier, tr)),
      ...(["standard", "plus", "custom"] as const).map((tier) => schoolTagline(tier, tr)),
      ...(["free", "plus", "max"] as const).flatMap((tier) => rayaFeatureBullets(tier, tr)),
      ...(["standard", "plus", "custom"] as const).flatMap((tier) => schoolFeatureBullets(tier, tr)),
      ...all().flatMap((g) =>
        g.rows.flatMap((r) => [r.label, r.hint ?? "", ...r.cells.map((c) => c ?? "")]),
      ),
    ].join(" | ");

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
    const solo = rayaComparison(tr).flatMap((g) => g.rows);
    const chat = solo.find((r) => r.label === "AI tutor messages");
    expect(chat?.cells[0]).toBe(`${RAYA_ENTITLEMENTS.free.messagesPerDay} / day`);
    // Free is capped, both paid tiers are not — the shape of the whole ladder.
    expect(chat?.cells[1]).toBe("Unlimited");

    const school = schoolComparison(tr).flatMap((g) => g.rows);
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
    expect(sold()).not.toMatch(/infographic/i);
    expect(sold()).not.toMatch(/audio summar/i);
  });

  /**
   * The taglines are here for the same reason, and they are the reason this
   * assertion had to widen.
   *
   * A plan's `description` is seeded in the DATABASE, and the pricing page
   * derived only the bullets — so the seeded line sat above them, outside every
   * check, still selling Max on "exam mode" (which exists nowhere in this
   * repo), "deep insights" (a Schools flag, not a Raya one) and "priority",
   * removed from the bullets a week earlier for naming a queue that does not
   * exist. It survived precisely because it was the one line nobody derived.
   */
  it("never sells a retired claim in the line above the bullets", () => {
    expect(sold()).not.toMatch(/priority/i);
    expect(sold()).not.toMatch(/exam mode/i);
    expect(sold()).not.toMatch(/full analytics/i);
    // Brand rule: "Raya" is a proper noun and is never re-cased. The seeded
    // Plus description shouted RAYA, which no derived line has ever done.
    expect(sold()).not.toMatch(/RAYA/);
    // And the taglines have to actually be in there, or the assertions above
    // pass by testing nothing.
    expect(sold()).toContain(rayaTagline("max", tr));
    expect(sold()).toContain(schoolTagline("custom", tr));
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

// The pre-launch state is monitor mode: gates observe but never block. It is no
// longer a default someone has to remember to leave — it is what the derivation
// below produces while there is no cashier. These pin that a build with no
// payment provider configured cannot wall anybody off.
describe("monitor mode (no payment provider configured)", () => {
  it("is off while nobody can pay", () => {
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
    const free = rayaFeatureBullets("free", tr).join(" | ");
    expect(free).toContain(`${RAYA_ENTITLEMENTS.free.messagesPerDay} AI tutor messages / day`);
    expect(free).not.toMatch(/unlimited ai tutor/i);

    // The paid cards must say it in words. "Unlimited AI tutor messages / day"
    // — what a naive interpolation produces — reads like a limit that lost its
    // number, on the one line that is supposed to remove the doubt.
    const plus = rayaFeatureBullets("plus", tr).join(" | ");
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
 * Enforcement is DERIVED from whether a real payment provider is configured,
 * because a paywall with no cashier is not a paywall — it is a student hitting
 * "30 messages today", following the upgrade the error names, and landing on a
 * checkout that tells them the channel is closed.
 *
 * The env var used to be the whole switch, defaulting to off with a comment
 * saying "flip at launch". These tests exist because that is precisely the sort
 * of step nobody performs: sixteen published limits meaning nothing, and the
 * failure mode — no wall where a wall was promised — makes no noise at all.
 */
describe("enforcement follows the cashier", () => {
  async function load(env: Record<string, string>) {
    vi.resetModules();
    // Neutralise any ambient value: neither "true" nor "false", so the
    // derivation is what answers unless a case overrides it on purpose.
    vi.stubEnv("ENTITLEMENTS_ENFORCE", "");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return import("@/lib/entitlements");
  }

  const LIVE = {
    BILLING_PROVIDER: "cinetpay",
    CINETPAY_API_KEY: "k",
    CINETPAY_SITE_ID: "s",
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("turns itself on when a real provider is configured, with no switch thrown", async () => {
    const { ENTITLEMENTS_ENFORCE: on } = await load(LIVE);
    expect(on).toBe(true);
  });

  it("stays off for a HALF-configured provider", async () => {
    // BILLING_PROVIDER names cinetpay but the keys are absent, so
    // getPaymentProvider falls back to the sandbox. The dangerous reading is
    // "cinetpay is set, therefore we are live": it would wall off every free
    // account on a deployment that cannot take a single payment.
    const { ENTITLEMENTS_ENFORCE: on } = await load({ BILLING_PROVIDER: "cinetpay" });
    expect(on).toBe(false);
  });

  it("stays off for the sandbox, which completes the loop with imaginary money", async () => {
    const { ENTITLEMENTS_ENFORCE: on } = await load({ BILLING_PROVIDER: "sandbox" });
    expect(on).toBe(false);
  });

  it("lets the env var override in BOTH directions", async () => {
    vi.resetModules();
    vi.stubEnv("ENTITLEMENTS_ENFORCE", "false");
    for (const [k, v] of Object.entries(LIVE)) vi.stubEnv(k, v);
    // Down, on a live deployment — a demo where the walls are in the way.
    expect((await import("@/lib/entitlements")).ENTITLEMENTS_ENFORCE).toBe(false);

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("ENTITLEMENTS_ENFORCE", "true");
    // Up, with no provider at all — the only way to exercise the walls locally.
    expect((await import("@/lib/entitlements")).ENTITLEMENTS_ENFORCE).toBe(true);
  });
});

/**
 * What a blocked student actually reads. Enforcement is off in the test build
 * (no provider), so the message is unreachable there — these load the module
 * with the switch forced on, which is also the only coverage of that branch.
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
