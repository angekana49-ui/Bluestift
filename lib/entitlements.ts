import "server-only";
import { NextResponse } from "next/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/server";

/**
 * Entitlements — the single source of truth for "what does each forfait unlock,
 * and up to what limit". This is the pricing grid (the published Forfaits
 * artifact) translated into code. Two families:
 *   - Raya (b2c): free | plus | max
 *   - Schools (b2b): standard | plus | custom
 *
 * Design principles baked in from the pricing discussion:
 *   - The CHAT is metered by plan (`messagesPerDay`), as of the pricing
 *     decision that made the forfaits the source of the limits. It was
 *     deliberately unmetered before, on the grounds that it is the core
 *     learning loop; what changed is that the core learning loop is also the
 *     only line item whose cost scales with use, so the forfait now has to
 *     name it. Artefacts (generations, exports), doc capacity (uploads) and
 *     premium features are gated as before.
 *   - SEPARATELY, and independent of any plan: both chat routes carry per-USER
 *     rate limits — a burst window and a daily ceiling. Those bound runaway
 *     clients and shared credentials, are identical on every tier, and stay in
 *     force on the tiers whose plan quota is `null`.
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
  /**
   * AI tutor messages per UTC calendar day. `null` = unlimited by plan — which
   * is not unbounded: the chat routes' own daily ceiling still applies.
   *
   * Counted per UTC day rather than as a rolling 24h window because a student
   * who runs out needs to know when they get it back, and "tomorrow" is an
   * answer a rolling window cannot give.
   */
  messagesPerDay: number | null;
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
    // Enough for a real study session every day, not enough to run a class on
    // one free account. Deliberately the tightest number in the grid to move,
    // because it is the one that carries an LLM bill.
    messagesPerDay: 30,
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
    // Ten times Free and past any plausible human day: Plus should never feel
    // like it is counting, while the number still exists to be enforced.
    messagesPerDay: 300,
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
    // "Fully unmetered" stays literally true for Max. It is safe to leave
    // unlimited here only because the routes' abuse ceiling is not a plan
    // quota and applies anyway.
    messagesPerDay: null,
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

// ---- Marketing copy (pricing cards) ----------------------------------------
// The public pricing cards must never drift from what each forfait actually
// unlocks, so their bullet lists are DERIVED from the entitlements above rather
// than hand-authored (and re-authored) in the DB `features` column. The prose is
// templated, but every number and flag is read straight from RAYA_ENTITLEMENTS /
// SCHOOL_ENTITLEMENTS — change a quota in one place and the card follows. Used by
// the /pricing page (a server component), so living in this server-only module is
// fine. `null` quota renders as "Unlimited".

/** "10 uploads" / "Unlimited uploads" from a nullable quota (null = unlimited). */
function quota(n: number | null, noun: string): string {
  return n == null ? `Unlimited ${noun}` : `${n} ${noun}`;
}

/** Pricing-card bullets for a Raya (b2c) tier, derived from RAYA_ENTITLEMENTS. */
export function rayaFeatureBullets(tier: RayaTier): string[] {
  const e = RAYA_ENTITLEMENTS[tier];
  switch (tier) {
    case "free":
      return [
        `${e.messagesPerDay} AI tutor messages / day — the core learning loop`,
        `${quota(e.generationsPerMonth, "study generations")} & ${quota(e.uploadsPerMonth, "uploads")} / month`,
        `${e.roomsPerMonth} study rooms / month · up to ${e.roomMaxParticipants} peers`,
        `${e.convHistoryDays}-day conversation history`,
        `${e.kernelAnalysisPerWeek} Kernel deep-dive per week`,
      ];
    case "plus":
      return [
        "Everything in Free, plus:",
        `${quota(e.messagesPerDay, "AI tutor messages")} / day`,
        "Voice input & every AI tutor mode",
        `${quota(e.generationsPerMonth, "generations")} & ${quota(e.uploadsPerMonth, "uploads")} / month`,
        "Mind maps, PDF export, no watermark",
        `Unlimited private rooms · up to ${e.roomMaxParticipants} peers`,
        "Unlimited chat history & Kernel analysis",
        "AI feedback on self-tests",
      ];
    case "max":
      return [
        "Everything in Plus, plus:",
        `${quota(e.messagesPerDay, "AI tutor messages")} / day`,
        "Unlimited generations & uploads",
        "Audio summaries & infographics",
        `Study rooms up to ${e.roomMaxParticipants} participants`,
        `${e.attachmentMaxMb} MB attachments & study packets`,
        "Priority, fully unmetered",
      ];
  }
}

/** Pricing-card bullets for a Schools (b2b) tier, derived from SCHOOL_ENTITLEMENTS. */
export function schoolFeatureBullets(tier: SchoolTier): string[] {
  const e = SCHOOL_ENTITLEMENTS[tier];
  switch (tier) {
    case "standard":
      return [
        `${e.preparePerMonthPerProf} lesson preps & ${e.aiGradingPerMonthPerProf} AI gradings / teacher / month`,
        `${e.simulationsPerWeekPerProf} student simulations / teacher / week`,
        `${e.reportsPerWeekPerProf} report / teacher / week`,
        `${e.exportsPerMonth} document exports / month`,
        "Teacher dashboards & per-class insights",
        `${e.archiveYears}-year data archive`,
      ];
    case "plus":
      return [
        "Everything in Standard, plus:",
        `${quota(e.preparePerMonthPerProf, "preps")} & ${quota(e.aiGradingPerMonthPerProf, "AI gradings")} / teacher / month`,
        "Unlimited student simulations & reports",
        "Advanced insights & automatic daily reports",
        "Your school logo on every document",
        `${e.archiveYears}-year data archive`,
      ];
    case "custom":
      return [
        "Everything in Plus, plus:",
        "Unlimited preps, gradings & exports",
        "Consolidated multi-class monitoring",
        "LMS sync, SSO & multi-school administration",
        "Insights export & unlimited data archive",
        "Bespoke deployment, tuned to your school",
      ];
  }
}

// ---- Tier normalization -----------------------------------------------------

/**
 * Map a plan's DB `tier`/`name` onto our normalized tier enum. We match on
 * keywords rather than exact strings so the resolver is resilient to however the
 * plans happen to be seeded, and always degrades to the base tier on anything
 * unrecognized. Callers pass BOTH the tier and the name (see `planSignal`) so
 * that either field carrying the signal is enough — important because the live
 * b2c plans use a generic ladder where tier "custom" actually means the Max plan
 * (only the name "User — Max" reveals it).
 */
export function normalizeRayaTier(planTierOrName: string | null | undefined): RayaTier {
  const s = (planTierOrName ?? "").toLowerCase();
  if (s.includes("max")) return "max";
  if (s.includes("plus") || s.includes("pro")) return "plus";
  return "free";
}

export function normalizeSchoolTier(planTierOrName: string | null | undefined): SchoolTier {
  const s = (planTierOrName ?? "").toLowerCase();
  // NB: the school-plan name prefix ("Schools — …") is NOT a tier signal, so we
  // only match real tier keywords — never an audience label. "devis" (quote)
  // covers a bespoke plan named in French.
  if (s.includes("custom") || s.includes("enterprise") || s.includes("devis")) return "custom";
  if (s.includes("plus") || s.includes("pro")) return "plus";
  return "standard";
}

// ---- Resolvers --------------------------------------------------------------

type ActivePlan = { tier: string | null; name: string | null } | null;

/** Combined tier+name signal fed to the normalizers (either field is enough). */
function planSignal(plan: ActivePlan): string {
  return [plan?.name, plan?.tier].filter(Boolean).join(" ");
}

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

// ---- Per-instance TTL cache (perf) -----------------------------------------
// A burst of gated actions from the same user/school would otherwise re-run the
// plan lookup (2 queries) every time. We cache only the resolved PLAN/tier, never
// the usage counts (those stay live so quotas are accurate). Best-effort: it's a
// process-local Map, not shared across serverless instances, and self-heals after
// RESOLVE_TTL_MS — so a fresh upgrade takes effect within a minute even without
// explicit invalidation. Mutating paths (activateSubscription) call invalidate*.

const RESOLVE_TTL_MS = 60_000;
type CacheEntry<T> = { value: T; expires: number };
const rayaCache = new Map<string, CacheEntry<ResolvedRaya>>();
const schoolCache = new Map<string, CacheEntry<ResolvedSchool>>();

function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    m.delete(key);
    return null;
  }
  return e.value;
}
function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T): void {
  m.set(key, { value, expires: Date.now() + RESOLVE_TTL_MS });
}

/** Drop cached entitlements for a user (b2c) or school (b2b) after a plan change. */
export function invalidateEntitlements(target: { userId: string } | { schoolId: string }): void {
  if ("schoolId" in target) schoolCache.delete(target.schoolId);
  else rayaCache.delete(target.userId);
}

/** Is the school inside its (paid-plan-free) pilot window? Never throws. */
async function isSchoolInPilot(schoolId: string): Promise<boolean> {
  try {
    const schools = createSchoolsAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await schools
      .from("schools")
      .select("pilot_until")
      .eq("id", schoolId)
      .maybeSingle();
    const pilotUntil = (data as { pilot_until: string | null } | null)?.pilot_until ?? null;
    return !!pilotUntil && pilotUntil >= today;
  } catch {
    return false;
  }
}

/** Resolve a student's Raya entitlements. No paid plan → free. Never throws. */
export async function resolveRayaEntitlements(userId: string): Promise<ResolvedRaya> {
  const cached = cacheGet(rayaCache, userId);
  if (cached) return cached;
  const plan = await getActivePlan({ userId });
  const tier = normalizeRayaTier(planSignal(plan));
  warnIfDowngraded(plan, tier, "free");
  const resolved = { tier, ent: RAYA_ENTITLEMENTS[tier], planName: plan?.name ?? null };
  cacheSet(rayaCache, userId, resolved);
  return resolved;
}

export type ResolvedSchool = {
  tier: SchoolTier;
  ent: SchoolEntitlements;
  planName: string | null;
};

/**
 * Resolve a school's entitlements. Resolution order:
 *   1. an active paid plan → its tier (always wins);
 *   2. else, inside the pilot window → the **Plus** feature set, so pilots trial
 *      the real product for a compelling demo (seat gating stays ungated during a
 *      pilot, handled separately in lib/billing);
 *   3. else → standard.
 * Never throws.
 */
export async function resolveSchoolEntitlements(schoolId: string): Promise<ResolvedSchool> {
  const cached = cacheGet(schoolCache, schoolId);
  if (cached) return cached;

  const plan = await getActivePlan({ schoolId });
  let tier = normalizeSchoolTier(planSignal(plan));
  let planName = plan?.name ?? null;

  if (!plan && (await isSchoolInPilot(schoolId))) {
    tier = "plus";
    planName = "Pilot";
  } else {
    warnIfDowngraded(plan, tier, "standard");
  }

  const resolved = { tier, ent: SCHOOL_ENTITLEMENTS[tier], planName };
  cacheSet(schoolCache, schoolId, resolved);
  return resolved;
}

// ---- Usage windows ----------------------------------------------------------

/** ISO timestamp for the first instant of the current UTC calendar month. */
export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * ISO timestamp for the first instant of the current UTC day. Used by the chat
 * message quota, which resets on a clock the student can predict.
 *
 * UTC, not local: it matches startOfMonthIso, and our markets sit at UTC+0/+1,
 * so the reset lands within an hour of their midnight either way. A per-user
 * timezone would be the correct fix if that ever stops being true.
 */
export function startOfDayIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/** ISO timestamp N days ago (rolling window, used for "per week" = last 7 days). */
export function sinceDaysIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ---- Gate helpers -----------------------------------------------------------

/**
 * How a period reads in a sentence shown to a customer. "this week"/"this
 * month" work verbatim; "this day" does not, and this is the message someone
 * sees at the moment they are blocked.
 */
function periodPhrase(period?: string): string {
  if (!period) return "";
  return period === "day" ? " today" : ` this ${period}`;
}

/** True when a numeric limit is set and already reached. null = unlimited. */
export function overQuota(used: number, limit: number | null): boolean {
  return limit != null && used >= limit;
}

/**
 * Emit the gate signal to product analytics (best-effort, consent-gated, no-op
 * without a PostHog key). Fires whenever a gate is HIT — in monitor mode too, so
 * "what free users reach for" is captured even though the action still succeeds.
 * `userId`/`tier` come from the resolver at the call site.
 */
function emitGateEvent(
  kind: "feature_locked" | "quota_reached",
  name: string,
  opts: {
    userId?: string;
    tier?: string;
    scope?: string;
    period?: string;
    used?: number;
    limit?: number | null;
  },
): void {
  void captureServer(opts.userId, "entitlement_gate", {
    kind,
    name,
    tier: opts.tier,
    scope: opts.scope,
    period: opts.period,
    used: opts.used,
    limit: opts.limit,
    enforced: ENTITLEMENTS_ENFORCE,
  });
}

/**
 * Feature gate. Returns a 403 NextResponse when the plan lacks `allowed` AND
 * enforcement is on; otherwise null (allowed through). In monitor mode a denial
 * is logged, not blocked, so we can see what free users are reaching for. Pass
 * `userId`/`tier` to attribute the analytics signal.
 */
export function gateFeature(
  allowed: boolean,
  opts: { feature: string; upgradeTo?: string; scope?: string; userId?: string; tier?: string },
): NextResponse | null {
  if (allowed) return null;
  emitGateEvent("feature_locked", opts.feature, opts);
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
 * `limit == null` (unlimited) is always allowed. Pass `userId`/`tier` to
 * attribute the analytics signal.
 */
export function gateQuota(
  used: number,
  limit: number | null,
  opts: { metric: string; period?: string; upgradeTo?: string; scope?: string; userId?: string; tier?: string },
): NextResponse | null {
  if (!overQuota(used, limit)) return null;
  emitGateEvent("quota_reached", opts.metric, { ...opts, used, limit });
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
      error: `You've reached your ${opts.metric} limit${periodPhrase(opts.period)} (${limit}). Upgrade to ${opts.upgradeTo ?? "a higher plan"} for more.`,
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
  opts: { feature: string; upgradeTo?: string; scope?: string; userId?: string; tier?: string },
): void {
  if (allowed) return;
  emitGateEvent("feature_locked", opts.feature, opts);
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
  opts: { metric: string; period?: string; upgradeTo?: string; scope?: string; userId?: string; tier?: string },
): void {
  if (!overQuota(used, limit)) return;
  emitGateEvent("quota_reached", opts.metric, { ...opts, used, limit });
  if (!ENTITLEMENTS_ENFORCE) {
    console.info(
      `[entitlements:monitor] quota "${opts.metric}" reached: ${used}/${limit}` +
        (opts.period ? ` per ${opts.period}` : "") +
        (opts.scope ? ` (${opts.scope})` : ""),
    );
    return;
  }
  throw new EntitlementError(
    `You've reached your ${opts.metric} limit${periodPhrase(opts.period)} (${limit}). Upgrade to ${opts.upgradeTo ?? "a higher plan"} for more.`,
    "quota_reached",
  );
}
