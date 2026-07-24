import "server-only";
import { NextResponse } from "next/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";

/**
 * Entitlements — the single source of truth for "what does each forfait unlock,
 * and up to what limit". This is the pricing grid (the published Forfaits
 * artifact) translated into code. Two families:
 *   - Raya (b2c): free | plus | max
 *   - Schools (b2b): standard | plus | custom
 *
 * Design principles baked in from the pricing discussion:
 *   - The CHAT is never metered (core learning loop). Only artefacts
 *     (generations, exports), doc capacity (uploads) and premium features are
 *     gated. Chat abuse is handled by a separate per-IP rate-limit, not here.
 *   - `null` on a numeric limit means UNLIMITED.
 *   - Feature flags are binary availability; numeric fields are quotas.
 *
 * ACTIVATION — nothing bites until you flip the master switch. While
 * `ENTITLEMENTS_ENFORCE` is off (the default, pre-launch), gate helpers never
 * block: they only log would-be denials so we gather real usage telemetry
 * ("monitor mode"). At launch — once the paid b2c plans are seeded and payment
 * is live — set `ENTITLEMENTS_ENFORCE=true` and the same gates start enforcing.
 * The anti-abuse chat rate-limit is independent of this switch (always on).
 */

// ---- Master activation switch ----------------------------------------------

/** When false (default), gates log but never block. Flip at launch. */
export const ENTITLEMENTS_ENFORCE = process.env.ENTITLEMENTS_ENFORCE === "true";

// ---- Raya (b2c) -------------------------------------------------------------

export type RayaTier = "free" | "plus" | "max";

export type RayaEntitlements = {
  // Chat
  /** Multiple AI modes/personas vs the default "Encouraging" persona only. */
  aiModes: boolean;
  voiceInput: boolean;
  attachmentMaxMb: number;
  /** Rolling conversation history window; null = kept forever. */
  convHistoryDays: number | null;
  // Tools Studio
  mindMap: boolean;
  /** Audio summary / infographic generators (premium, still to ship). */
  audioInfographic: boolean;
  /** Audio file extraction (transcription in Tools). */
  audioExtraction: boolean;
  uploadsPerMonth: number | null;
  generationsPerMonth: number | null;
  packetMaxMb: number;
  packetMultiFile: boolean;
  libraryRetentionDays: number | null;
  // Exports & sharing
  pdfExport: boolean;
  removeWatermark: boolean;
  exportsPerWeek: number | null;
  savedGenerationsDays: number | null;
  // Rooms
  roomsPerMonth: number | null;
  /** false = timer mandatory (Free auto-closes at 60 min). */
  roomTimerOptional: boolean;
  privateRooms: boolean;
  roomChallengesPerRoom: number | null;
  roomMaxParticipants: number;
  roomReports: boolean;
  // Self-tests
  selfTestAiAnalysis: boolean;
  // Kernel
  kernelAnalysisPerWeek: number | null;
};

export const RAYA_ENTITLEMENTS: Record<RayaTier, RayaEntitlements> = {
  free: {
    aiModes: false,
    voiceInput: false,
    attachmentMaxMb: 5,
    convHistoryDays: 7,
    mindMap: false,
    audioInfographic: false,
    audioExtraction: false,
    uploadsPerMonth: 10,
    generationsPerMonth: 10,
    packetMaxMb: 5,
    packetMultiFile: false,
    libraryRetentionDays: 30,
    pdfExport: false,
    removeWatermark: false,
    exportsPerWeek: 5,
    savedGenerationsDays: 30,
    roomsPerMonth: 3,
    roomTimerOptional: false,
    privateRooms: false,
    roomChallengesPerRoom: 1,
    roomMaxParticipants: 5,
    roomReports: false,
    selfTestAiAnalysis: false,
    kernelAnalysisPerWeek: 1,
  },
  plus: {
    aiModes: true,
    voiceInput: true,
    attachmentMaxMb: 20,
    convHistoryDays: null,
    mindMap: true,
    audioInfographic: false,
    audioExtraction: true,
    uploadsPerMonth: 150,
    generationsPerMonth: 100,
    packetMaxMb: 20,
    packetMultiFile: true,
    libraryRetentionDays: null,
    pdfExport: true,
    removeWatermark: true,
    exportsPerWeek: null,
    savedGenerationsDays: null,
    roomsPerMonth: null,
    roomTimerOptional: true,
    privateRooms: true,
    roomChallengesPerRoom: null,
    roomMaxParticipants: 25,
    roomReports: true,
    selfTestAiAnalysis: true,
    kernelAnalysisPerWeek: null,
  },
  max: {
    aiModes: true,
    voiceInput: true,
    attachmentMaxMb: 25,
    convHistoryDays: null,
    mindMap: true,
    audioInfographic: true,
    audioExtraction: true,
    uploadsPerMonth: null,
    generationsPerMonth: null,
    packetMaxMb: 25,
    packetMultiFile: true,
    libraryRetentionDays: null,
    pdfExport: true,
    removeWatermark: true,
    exportsPerWeek: null,
    savedGenerationsDays: null,
    roomsPerMonth: null,
    roomTimerOptional: true,
    privateRooms: true,
    roomChallengesPerRoom: null,
    roomMaxParticipants: 50,
    roomReports: true,
    selfTestAiAnalysis: true,
    kernelAnalysisPerWeek: null,
  },
};

// ---- Schools (b2b) ----------------------------------------------------------

export type SchoolTier = "standard" | "plus" | "custom";

export type SchoolEntitlements = {
  // Capacity
  /** Data retention / archive window in years; null = beyond (custom). */
  archiveYears: number | null;
  /** Consolidated (vs detailed) monitoring view — a Custom particularity. */
  consolidatedView: boolean;
  // Prof pedagogy
  preparePerMonthPerProf: number | null;
  aiGradingPerMonthPerProf: number | null;
  insightsAdvanced: boolean;
  insightsExport: boolean;
  simulationsPerWeekPerProf: number | null;
  simulationExport: boolean;
  reportsPerWeekPerProf: number | null;
  autoDailyReports: boolean;
  exportsPerMonth: number | null;
  followupsAdvanced: boolean;
  // Administration
  schoolLogoOnDocs: boolean;
  lms: boolean;
  sso: boolean;
  multiSchool: boolean;
};

export const SCHOOL_ENTITLEMENTS: Record<SchoolTier, SchoolEntitlements> = {
  standard: {
    archiveYears: 3,
    consolidatedView: false,
    preparePerMonthPerProf: 30,
    aiGradingPerMonthPerProf: 5,
    insightsAdvanced: false,
    insightsExport: false,
    simulationsPerWeekPerProf: 3,
    simulationExport: false,
    reportsPerWeekPerProf: 1,
    autoDailyReports: false,
    exportsPerMonth: 20,
    followupsAdvanced: false,
    schoolLogoOnDocs: false,
    lms: false,
    sso: false,
    multiSchool: false,
  },
  plus: {
    archiveYears: 10,
    consolidatedView: false,
    preparePerMonthPerProf: 150,
    aiGradingPerMonthPerProf: 75,
    insightsAdvanced: true,
    insightsExport: false,
    simulationsPerWeekPerProf: null,
    simulationExport: true,
    reportsPerWeekPerProf: null,
    autoDailyReports: true,
    exportsPerMonth: null,
    followupsAdvanced: true,
    schoolLogoOnDocs: true,
    lms: false,
    sso: false,
    multiSchool: false,
  },
  custom: {
    archiveYears: null,
    consolidatedView: true,
    preparePerMonthPerProf: null,
    aiGradingPerMonthPerProf: null,
    insightsAdvanced: true,
    insightsExport: true,
    simulationsPerWeekPerProf: null,
    simulationExport: true,
    reportsPerWeekPerProf: null,
    autoDailyReports: true,
    exportsPerMonth: null,
    followupsAdvanced: true,
    schoolLogoOnDocs: true,
    lms: true,
    sso: true,
    multiSchool: true,
  },
};

// ---- Tier normalization -----------------------------------------------------

/**
 * Map a plan's DB `tier`/`name` onto our normalized tier enum. We match on
 * keywords rather than exact strings so the resolver is resilient to the exact
 * seeded values ("User — Plus", "Plus", tier "plus", …) and always degrades to
 * the base tier on anything unrecognized.
 */
export function normalizeRayaTier(planTierOrName: string | null | undefined): RayaTier {
  const s = (planTierOrName ?? "").toLowerCase();
  if (s.includes("max")) return "max";
  if (s.includes("plus") || s.includes("pro")) return "plus";
  return "free";
}

export function normalizeSchoolTier(planTierOrName: string | null | undefined): SchoolTier {
  const s = (planTierOrName ?? "").toLowerCase();
  if (s.includes("custom") || s.includes("enterprise") || s.includes("école") || s.includes("ecole"))
    return "custom";
  if (s.includes("plus") || s.includes("pro")) return "plus";
  return "standard";
}

// ---- Resolvers --------------------------------------------------------------

type ActivePlan = { tier: string | null; name: string | null } | null;

/** The newest active/trial subscription's plan for a user (b2c) or school (b2b). */
async function getActivePlan(target: { userId: string } | { schoolId: string }): Promise<ActivePlan> {
  try {
    const schools = createSchoolsAdminClient();
    let q = schools.from("subscriptions").select("plan_id").in("status", ["active", "trial"]);
    q =
      "schoolId" in target
        ? q.eq("school_id", target.schoolId)
        : q.eq("user_id", target.userId).is("school_id", null);
    const { data: sub } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    const planId = (sub as { plan_id: string | null } | null)?.plan_id ?? null;
    if (!planId) return null;
    const { data: p } = await schools
      .from("subscription_plans")
      .select("tier, name")
      .eq("id", planId)
      .maybeSingle();
    return (p as { tier: string | null; name: string | null } | null) ?? null;
  } catch {
    return null;
  }
}

export type ResolvedRaya = { tier: RayaTier; ent: RayaEntitlements; planName: string | null };

/**
 * Loudly flag the dangerous case: an ACTIVE paid plan exists, yet its tier/name
 * doesn't confidently map to a paid tier, so we're about to serve the paying
 * customer the base (free/standard) feature set. Silent in that case = a paying
 * user quietly downgraded. This surfaces mis-seeded plan names in the logs so
 * they're caught before ENTITLEMENTS_ENFORCE is flipped on. Base tier from
 * "no plan at all" is expected and NOT warned.
 */
function warnIfDowngraded(plan: ActivePlan, resolved: string, base: string): void {
  if (plan && resolved === base && (plan.tier || plan.name)) {
    console.warn(
      `[entitlements] active plan {tier:${plan.tier ?? "-"}, name:${plan.name ?? "-"}} ` +
        `did not map to a paid tier and fell back to "${base}". ` +
        `Fix the seeded plan tier/name before enforcing, or a paying user is downgraded.`,
    );
  }
}

/** Resolve a student's Raya entitlements. No paid plan → free. Never throws. */
export async function resolveRayaEntitlements(userId: string): Promise<ResolvedRaya> {
  const plan = await getActivePlan({ userId });
  const tier = normalizeRayaTier(plan?.tier ?? plan?.name ?? null);
  warnIfDowngraded(plan, tier, "free");
  return { tier, ent: RAYA_ENTITLEMENTS[tier], planName: plan?.name ?? null };
}

export type ResolvedSchool = {
  tier: SchoolTier;
  ent: SchoolEntitlements;
  planName: string | null;
};

/**
 * Resolve a school's entitlements. No paid plan (incl. pilot window) → standard
 * feature set. Seat gating is handled separately in lib/billing (a pilot school
 * is seat-ungated but gets Standard *features* here). If you'd rather let pilot
 * schools trial Plus-level features, uplift here — that's a policy choice.
 */
export async function resolveSchoolEntitlements(schoolId: string): Promise<ResolvedSchool> {
  const plan = await getActivePlan({ schoolId });
  const tier = normalizeSchoolTier(plan?.tier ?? plan?.name ?? null);
  warnIfDowngraded(plan, tier, "standard");
  return { tier, ent: SCHOOL_ENTITLEMENTS[tier], planName: plan?.name ?? null };
}

// ---- Usage windows ----------------------------------------------------------

/** ISO timestamp for the first instant of the current UTC calendar month. */
export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** ISO timestamp N days ago (rolling window, used for "per week" = last 7 days). */
export function sinceDaysIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ---- Gate helpers -----------------------------------------------------------

/** True when a numeric limit is set and already reached. null = unlimited. */
export function overQuota(used: number, limit: number | null): boolean {
  return limit != null && used >= limit;
}

/**
 * Feature gate. Returns a 403 NextResponse when the plan lacks `allowed` AND
 * enforcement is on; otherwise null (allowed through). In monitor mode a denial
 * is logged, not blocked, so we can see what free users are reaching for.
 */
export function gateFeature(
  allowed: boolean,
  opts: { feature: string; upgradeTo?: string; scope?: string },
): NextResponse | null {
  if (allowed) return null;
  if (!ENTITLEMENTS_ENFORCE) {
    console.info(
      `[entitlements:monitor] feature "${opts.feature}" would be blocked` +
        (opts.scope ? ` (${opts.scope})` : ""),
    );
    return null;
  }
  return NextResponse.json(
    {
      error: `This feature requires ${opts.upgradeTo ?? "an upgrade"}.`,
      code: "feature_locked",
      feature: opts.feature,
    },
    { status: 403 },
  );
}

/**
 * Quota gate. Returns a 429 NextResponse when `used >= limit` AND enforcement is
 * on; otherwise null. In monitor mode an over-quota is logged, not blocked.
 * `limit == null` (unlimited) is always allowed.
 */
export function gateQuota(
  used: number,
  limit: number | null,
  opts: { metric: string; period?: string; upgradeTo?: string; scope?: string },
): NextResponse | null {
  if (!overQuota(used, limit)) return null;
  if (!ENTITLEMENTS_ENFORCE) {
    console.info(
      `[entitlements:monitor] quota "${opts.metric}" reached: ${used}/${limit}` +
        (opts.period ? ` per ${opts.period}` : "") +
        (opts.scope ? ` (${opts.scope})` : ""),
    );
    return null;
  }
  return NextResponse.json(
    {
      error: `You've reached your ${opts.metric} limit${opts.period ? ` this ${opts.period}` : ""} (${limit}). Upgrade to ${opts.upgradeTo ?? "a higher plan"} for more.`,
      code: "quota_reached",
      metric: opts.metric,
      used,
      limit,
    },
    { status: 429 },
  );
}

/** Thrown by the assert* gates (server actions) when enforcement blocks. */
export class EntitlementError extends Error {
  code: "feature_locked" | "quota_reached";
  constructor(message: string, code: "feature_locked" | "quota_reached") {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
  }
}

/**
 * Server-action variant of gateFeature: throws EntitlementError when the plan
 * lacks the feature AND enforcement is on; in monitor mode it only logs. Use in
 * "use server" actions where returning a NextResponse isn't possible.
 */
export function assertFeature(
  allowed: boolean,
  opts: { feature: string; upgradeTo?: string; scope?: string },
): void {
  if (allowed) return;
  if (!ENTITLEMENTS_ENFORCE) {
    console.info(
      `[entitlements:monitor] feature "${opts.feature}" would be blocked` +
        (opts.scope ? ` (${opts.scope})` : ""),
    );
    return;
  }
  throw new EntitlementError(
    `This feature requires ${opts.upgradeTo ?? "an upgrade"}.`,
    "feature_locked",
  );
}

/** Server-action variant of gateQuota: throws when over quota and enforcing. */
export function assertQuota(
  used: number,
  limit: number | null,
  opts: { metric: string; period?: string; upgradeTo?: string; scope?: string },
): void {
  if (!overQuota(used, limit)) return;
  if (!ENTITLEMENTS_ENFORCE) {
    console.info(
      `[entitlements:monitor] quota "${opts.metric}" reached: ${used}/${limit}` +
        (opts.period ? ` per ${opts.period}` : "") +
        (opts.scope ? ` (${opts.scope})` : ""),
    );
    return;
  }
  throw new EntitlementError(
    `You've reached your ${opts.metric} limit${opts.period ? ` this ${opts.period}` : ""} (${limit}). Upgrade to ${opts.upgradeTo ?? "a higher plan"} for more.`,
    "quota_reached",
  );
}
