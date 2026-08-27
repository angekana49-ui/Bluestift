import "server-only";
import { ROOM_TIMER_MIN, ROOM_TIMER_MAX } from "@/lib/rooms";
import { NextResponse } from "next/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { billingIsLive } from "@/lib/billing/payments";
import { captureServer } from "@/lib/analytics/server";
import type { MessageKey } from "@/lib/i18n";

/** What the marketing-copy functions below need to translate their output.
 *  Callers get one from getServerTranslate() (lib/i18n/server.ts) — the only
 *  consumer today is the /pricing page, a server component. */
type Tr = (key: MessageKey) => string;

/**
 * Entitlements — the single source of truth for "what does each forfait unlock,
 * and up to what limit". This is the pricing grid (the published Forfaits
 * artifact) translated into code. Two families:
 *   - Raya (b2c): free | plus | max
 *   - Schools (b2b): standard | plus | custom
 *
 * Design principles baked in from the pricing discussion:
 *   - The CHAT stays UNMETERED ON EVERY PAID TIER — it is the core learning
 *     loop and the thing the product sells, and metering it would be charging
 *     for the part that is not the defensible one. `messagesPerDay` exists for
 *     one reason: the free tier is also the only place where the one cost that
 *     scales with use has no counterparty. So the cap sits there and nowhere
 *     else. Artefacts (generations, exports), doc capacity (uploads) and
 *     premium features are gated as before.
 *   - SEPARATELY, and independent of any plan: both chat routes carry per-USER
 *     rate limits — a burst window and a daily ceiling. Those bound runaway
 *     clients and shared credentials, are identical on every tier, and stay in
 *     force on the tiers whose plan quota is `null`.
 *   - `null` on a numeric limit means UNLIMITED.
 *   - Feature flags are binary availability; numeric fields are quotas.
 *
 * ACTIVATION — the gates enforce exactly when money can change hands, and only
 * count until then ("monitor mode": a would-be denial is logged and reported to
 * analytics, and the action goes through). That is not a policy choice made
 * here, it is the one condition under which a wall is honest, and it is derived
 * rather than configured — see ENTITLEMENTS_ENFORCE below. The anti-abuse chat
 * rate-limit is independent of it (always on).
 */

// ---- Master activation switch ----------------------------------------------

/**
 * Do the gates below BLOCK, or only count?
 *
 * This was a hand-thrown switch that defaulted to off, with a note here saying
 * "flip it at launch". That is the kind of step nobody remembers. /pricing now
 * publishes sixteen rows of limits, and whether a single one of them meant
 * anything depended on somebody recalling an environment variable months after
 * reading about it — in the direction where forgetting is silent, because
 * nothing breaks when a wall fails to appear.
 *
 * It is derived now, from the only thing it ever actually depended on: whether
 * there is a cashier. A paywall with no way to pay is not a paywall, it is a
 * dead end — the student hits "30 messages today", follows the upgrade the
 * error names, and lands on a checkout that tells them the channel is closed.
 * Counting without blocking is the RIGHT behaviour in that state, and blocking
 * is the right behaviour the moment a real provider is configured. Neither one
 * should need a human to notice.
 *
 * The environment variable stays, and now overrides in BOTH directions:
 *   ENTITLEMENTS_ENFORCE=true   force the walls up (exercise them locally
 *                               against the sandbox, or against seeded plans)
 *   ENTITLEMENTS_ENFORCE=false  force them down (a demo on a live deployment)
 *   unset                       the derived answer
 *
 * Two things do NOT ride on this and never did. The chat routes' per-user
 * burst + daily ceiling is anti-abuse, identical on every tier, always on. And
 * a room's private-by-default visibility is a safety default rather than a
 * monetisation rule — see the note in app/rooms/actions.ts.
 */
function resolveEnforcement(): boolean {
  const override = process.env.ENTITLEMENTS_ENFORCE;
  if (override === "true") return true;
  if (override === "false") return false;
  return billingIsLive();
}

export const ENTITLEMENTS_ENFORCE = resolveEnforcement();

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
  /** false = timer mandatory (Free auto-closes at ROOM_TIMER_MAX). */
  roomTimerOptional: boolean;
  /**
   * May the creator CHOOSE a room's visibility.
   *
   * This replaced `privateRooms`, which named the same boolean for the opposite
   * rule: private rooms were the paid feature and a free room was public. That
   * is backwards for who is on the free plan. Rooms are private by default now,
   * and a plan without this flag cannot leave that default — so a free room is
   * always private, and only a paying account can open one to everyone.
   *
   * Read the enforcement note in app/rooms/actions.ts before touching it: unlike
   * every other flag in this file, this one is not a monetisation gate and does
   * not wait for ENTITLEMENTS_ENFORCE.
   */
  roomVisibilityChoice: boolean;
  /**
   * The private one-to-one channel with Raya inside a room, per month.
   *
   * Shipped and, until now, metered by nothing: app/rooms/[id]/page.tsx opens
   * it and /api/raya/chat creates it (conversations.is_private_room_channel).
   * It is the most expensive thing a room can do — a full tutor session that no
   * other member sees — so it is the one room capability worth a quota.
   */
  privateRayaPerMonth: number | null;
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
    // The ONLY tier with a chat cap, and only because a free account is the
    // one place an LLM bill has nobody behind it. Enough for a real study
    // session every day, not enough to run a class on one free account.
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
    roomVisibilityChoice: false,
    privateRayaPerMonth: 3,
    roomChallengesPerRoom: 1,
    roomMaxParticipants: 8,
    roomReports: false,
    selfTestAiAnalysis: false,
    kernelAnalysisPerWeek: 1,
  },
  plus: {
    // Unmetered, like Max: paying for Raya buys the tutor, not a number of
    // turns with it. Bounded only by the routes' abuse ceiling, which is not a
    // plan quota and applies to every tier.
    messagesPerDay: null,
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
    roomVisibilityChoice: true,
    privateRayaPerMonth: 50,
    roomChallengesPerRoom: null,
    roomMaxParticipants: 25,
    roomReports: true,
    selfTestAiAnalysis: true,
    kernelAnalysisPerWeek: null,
  },
  max: {
    // "Fully unmetered" stays literally true for Max, as for Plus.
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
    roomVisibilityChoice: true,
    privateRayaPerMonth: null,
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
function quota(n: number | null, nounKey: MessageKey, tr: Tr): string {
  return n == null ? `${tr("ent.unlimited")} ${tr(nounKey)}` : `${n} ${tr(nounKey)}`;
}

/**
 * The chat line on a pricing card, from the field the gate reads — so the card
 * cannot promise what the gate would refuse. Unlimited says so in words rather
 * than as "Unlimited messages / day", which reads like a limit that lost its
 * number.
 */
function chatLine(e: RayaEntitlements, tr: Tr): string {
  return e.messagesPerDay == null ? tr("ent.chat.unlimited") : `${e.messagesPerDay} ${tr("ent.chat.messagesPerDay")}`;
}

/** Pricing-card bullets for a Raya (b2c) tier, derived from RAYA_ENTITLEMENTS. */
export function rayaFeatureBullets(tier: RayaTier, tr: Tr): string[] {
  const e = RAYA_ENTITLEMENTS[tier];
  switch (tier) {
    case "free":
      return [
        `${chatLine(e, tr)} ${tr("ent.raya.free.b1Suffix")}`,
        `${quota(e.generationsPerMonth, "ent.noun.studyGenerations", tr)} & ${quota(e.uploadsPerMonth, "ent.noun.uploads", tr)} ${tr("ent.perMonth")}`,
        `${e.roomsPerMonth} ${tr("ent.raya.free.b3a")} ${e.roomMaxParticipants} ${tr("ent.raya.free.b3b")}`,
        `${e.convHistoryDays} ${tr("ent.raya.free.b4")}`,
        `${e.kernelAnalysisPerWeek} ${tr("ent.raya.free.b5")}`,
      ];
    case "plus":
      return [
        chatLine(e, tr),
        tr("ent.raya.plus.b2"),
        `${quota(e.generationsPerMonth, "ent.noun.generations", tr)} & ${quota(e.uploadsPerMonth, "ent.noun.uploads", tr)} ${tr("ent.perMonth")}`,
        tr("ent.raya.plus.b4"),
        // Not "private rooms" any more — every room is private, on every plan.
        // What Plus buys is the choice to open one, and the room-size ceiling.
        `${tr("ent.raya.plus.b5a")} ${e.roomMaxParticipants} ${tr("ent.raya.plus.b5b")}`,
        `${e.privateRayaPerMonth} ${tr("ent.raya.plus.b6")}`,
        tr("ent.raya.plus.b7"),
        tr("ent.common.aiFeedbackSelfTests"),
      ];
    case "max":
      // Two bullets were removed here rather than reworded, because neither
      // described anything that exists.
      //
      // "Audio summaries & infographics" is `audioInfographic`, whose own
      // declaration says "premium, still to ship" — and it is the one flag in
      // this file that no route reads: mindMap gates /api/tools/generate,
      // audioExtraction gates /api/tools/extract, this one gates nothing,
      // because there is nothing to gate. It was the only line on the pricing
      // page selling an unbuilt feature, on the most expensive plan.
      //
      // "Priority" implied a queue that would serve a Max user first. There is
      // no such queue. "Fully unmetered" was true and is already said by the
      // unlimited line above it.
      //
      // What was left read as a rounding error: three numbers going up. They
      // are the same three facts below, said as the one thing they actually
      // amount to.
      //
      // Max is the tier where NOTHING IS COUNTED. Not a slogan — a property of
      // the object above, and the only tier that has it. Plus is unmetered on
      // the chat, the rooms, the Kernel and the exports, but it still counts
      // three things: generations, uploads, and private sessions with Raya. On
      // Max every per-period quota in RayaEntitlements is null, and the only
      // numbers left anywhere are sizes and capacities. A test asserts that, so
      // this line cannot quietly stop being true (see test/entitlements).
      //
      // The room ceiling is the one qualitative difference and it was being
      // sold as arithmetic: 25 → 50 is not "double", it is the line between a
      // study group and a class. A buyer choosing between the two tiers is
      // choosing between those two situations, not between two integers.
      //
      // The private Raya session was missing from this card entirely, though
      // going from 50/month to uncounted is Max's most substantial delta.
      return [
        tr("ent.raya.max.b1"),
        tr("ent.raya.plus.b2"),
        tr("ent.raya.max.b3"),
        tr("ent.raya.max.b4"),
        tr("ent.raya.plus.b4"),
        `${tr("ent.raya.max.b6a")} ${e.roomMaxParticipants} ${tr("ent.raya.max.b6b")}`,
        `${e.attachmentMaxMb} ${tr("ent.mb")} ${tr("ent.raya.max.b7")}`,
        tr("ent.common.aiFeedbackSelfTests"),
      ];
  }
}

/*
 * The one line on a pricing card that was still hand-authored.
 *
 * A plan's `description` is seeded in the database, and the pricing page
 * replaced every plan's `features` with the derived bullets while rendering
 * that field untouched — directly above them. So the card's last unchecked
 * sentence was selling, on Max: "exam mode" (no such thing anywhere in this
 * repo), "deep insights" (a Schools flag, not a Raya one) and "priority" (the
 * queue that does not exist — removed from the bullets last week and still
 * printed one line higher), and on Plus "full analytics" plus a RAYA in caps,
 * which the brand rule forbids.
 *
 * That is what a hand-authored line does when everything around it is derived:
 * it becomes the only place a retired claim can survive, and the last place
 * anyone looks. These say what a tier is FOR — the bullets below say what it
 * gives — and every claim in them is one the matrix above actually keeps.
 */
export function rayaTagline(tier: RayaTier, tr: Tr): string {
  switch (tier) {
    case "free":
      return tr("ent.tagline.rayaFree");
    case "plus":
      return tr("ent.tagline.rayaPlus");
    case "max":
      return tr("ent.tagline.rayaMax");
  }
}

export function schoolTagline(tier: SchoolTier, tr: Tr): string {
  switch (tier) {
    case "standard":
      return tr("ent.tagline.schoolStandard");
    case "plus":
      return tr("ent.tagline.schoolPlus");
    case "custom":
      return tr("ent.tagline.schoolCustom");
  }
}

/** "3-year data archive" / "1-year data archive" — plural agrees with n, since
 *  not every locale has English's invariant hyphenated-adjective form. Only
 *  called for standard/plus, whose archiveYears is always a number — custom's
 *  (the one nullable case) uses its own "kept for as long as you need it"
 *  bullet instead. */
function archiveYears(n: number | null, tr: Tr): string {
  return `${n} ${tr(n === 1 ? "ent.common.archiveYear" : "ent.common.archiveYears")}`;
}

/** Pricing-card bullets for a Schools (b2b) tier, derived from SCHOOL_ENTITLEMENTS. */
export function schoolFeatureBullets(tier: SchoolTier, tr: Tr): string[] {
  const e = SCHOOL_ENTITLEMENTS[tier];
  switch (tier) {
    case "standard":
      return [
        `${e.preparePerMonthPerProf} ${tr("ent.school.std.b1a")} ${e.aiGradingPerMonthPerProf} ${tr("ent.school.std.b1b")}`,
        `${e.simulationsPerWeekPerProf} ${tr("ent.school.std.b2")}`,
        `${e.reportsPerWeekPerProf} ${tr("ent.school.std.b3")}`,
        `${e.exportsPerMonth} ${tr("ent.school.std.b4")}`,
        tr("ent.school.std.b5"),
        archiveYears(e.archiveYears, tr),
      ];
    case "plus":
      return [
        `${quota(e.preparePerMonthPerProf, "ent.noun.preps", tr)} & ${quota(e.aiGradingPerMonthPerProf, "ent.noun.aiGradings", tr)} ${tr("ent.perTeacherPerMonth")}`,
        tr("ent.school.plus.b2"),
        tr("ent.school.plus.b3"),
        tr("ent.school.plus.b4"),
        // followupsAdvanced, true here and false on Standard. It was a real
        // delta that only ever appeared in the comparison grid.
        tr("ent.school.plus.b5"),
        tr("ent.school.plus.b6"),
        archiveYears(e.archiveYears, tr),
      ];
    case "custom":
      return [
        tr("ent.school.custom.b1"),
        tr("ent.school.custom.b2"),
        tr("ent.school.custom.b3"),
        tr("ent.school.custom.b4"),
        tr("ent.school.plus.b6"),
        tr("ent.school.custom.b6"),
        tr("ent.school.custom.b7"),
      ];
  }
}

// ---- The comparison table ---------------------------------------------------
/*
 * Three cards cannot answer "what do I get, and up to what limit".
 *
 * The cards are a ladder written as prose, so a buyer asking a flat question —
 * how many rooms on Plus, how many gradings on Standard — has to hold three
 * lists in their head and diff them. That is the one job the pricing page
 * exists to do, and it was the one job it left to the reader. Worse, the same
 * capability was named differently in each card ("Unlimited private rooms"
 * against "Study rooms up to 50 participants"), so even the diff was
 * unreliable.
 *
 * The cards used to open on "Everything in the tier below, plus:", which was
 * bookkeeping rather than an argument: of course the dearer plan gives more.
 * That line is gone, and each card now stands on its own — which is only
 * affordable BECAUSE this grid exists underneath to answer cumulativeness
 * outright. Removing it from a page with no grid would have left a reader
 * guessing whether the tiers were cumulative or alternative.
 *
 * A grid answers it in one look: capability down the side, tier across the top,
 * the limit in the cell. Every value below is read from the same objects the
 * gates read, so the table cannot promise what the gate would refuse — and a
 * quota changed in one place moves the card AND the row together.
 *
 * `hint` is not decoration. Half these rows are internal vocabulary — a parent
 * does not know what a "generation" is, a headteacher does not know what a
 * "simulation" is, and nobody outside this repo has heard of a Kernel deep-dive.
 * A limit on a word the buyer cannot define is not information.
 */

export type CompareRow = {
  /** What the buyer calls it. */
  label: string;
  /** One line of plain language, wherever the label alone is our vocabulary. */
  hint?: string;
  /** One cell per tier, in ladder order. `null` renders as "not included". */
  cells: [string | null, string | null, string | null];
};

export type CompareGroup = { title: string; rows: CompareRow[] };

/** "Unlimited" beats "null messages / day", which reads as a lost number. */
const un = (n: number | null, unitKey: MessageKey, tr: Tr) => (n == null ? tr("ent.unlimited") : `${n} ${tr(unitKey)}`);
const yes = (tr: Tr) => tr("ent.included");

/** Solo ladder: Free · Plus · Max. */
export function rayaComparison(tr: Tr): CompareGroup[] {
  const [f, p, m] = [RAYA_ENTITLEMENTS.free, RAYA_ENTITLEMENTS.plus, RAYA_ENTITLEMENTS.max];
  return [
    {
      title: tr("ent.group.learningWithRaya"),
      rows: [
        {
          label: tr("ent.row.aiTutorMessages.label"),
          hint: tr("ent.row.aiTutorMessages.hint"),
          cells: [`${f.messagesPerDay} ${tr("ent.perDay")}`, tr("ent.unlimited"), tr("ent.unlimited")],
        },
        {
          label: tr("ent.row.voiceInput.label"),
          hint: tr("ent.row.voiceInput.hint"),
          cells: [f.voiceInput ? yes(tr) : null, p.voiceInput ? yes(tr) : null, m.voiceInput ? yes(tr) : null],
        },
        {
          label: tr("ent.row.convHistory.label"),
          cells: [`${f.convHistoryDays} ${tr("ent.days")}`, tr("ent.kept"), tr("ent.kept")],
        },
        {
          label: tr("ent.row.kernelDeepDive.label"),
          hint: tr("ent.row.kernelDeepDive.hint"),
          cells: [un(f.kernelAnalysisPerWeek, "ent.perWeek", tr), tr("ent.unlimited"), tr("ent.unlimited")],
        },
        {
          label: tr("ent.row.aiFeedbackSelfTests.label"),
          cells: [f.selfTestAiAnalysis ? yes(tr) : null, p.selfTestAiAnalysis ? yes(tr) : null, m.selfTestAiAnalysis ? yes(tr) : null],
        },
      ],
    },
    {
      title: tr("ent.group.studyTools"),
      rows: [
        {
          label: tr("ent.row.studyGenerations.label"),
          hint: tr("ent.row.studyGenerations.hint"),
          cells: [un(f.generationsPerMonth, "ent.perMonth", tr), un(p.generationsPerMonth, "ent.perMonth", tr), un(m.generationsPerMonth, "ent.perMonth", tr)],
        },
        {
          label: tr("ent.row.documentUploads.label"),
          cells: [un(f.uploadsPerMonth, "ent.perMonth", tr), un(p.uploadsPerMonth, "ent.perMonth", tr), un(m.uploadsPerMonth, "ent.perMonth", tr)],
        },
        { label: tr("ent.row.mindMaps.label"), cells: [f.mindMap ? yes(tr) : null, p.mindMap ? yes(tr) : null, m.mindMap ? yes(tr) : null] },
        {
          label: tr("ent.row.pdfExport.label"),
          cells: [f.pdfExport ? yes(tr) : null, p.pdfExport ? yes(tr) : null, m.pdfExport ? yes(tr) : null],
        },
        {
          label: tr("ent.row.attachmentSize.label"),
          cells: [`${f.attachmentMaxMb} ${tr("ent.mb")}`, `${p.attachmentMaxMb} ${tr("ent.mb")}`, `${m.attachmentMaxMb} ${tr("ent.mb")}`],
        },
      ],
    },
    {
      title: tr("ent.group.studyRooms"),
      rows: [
        {
          label: tr("ent.row.roomsOpen.label"),
          cells: [un(f.roomsPerMonth, "ent.perMonth", tr), tr("ent.unlimited"), tr("ent.unlimited")],
        },
        {
          label: tr("ent.row.peopleInRoom.label"),
          cells: [`${f.roomMaxParticipants}`, `${p.roomMaxParticipants}`, `${m.roomMaxParticipants}`],
        },
        {
          label: tr("ent.row.sessionLength.label"),
          hint: `${tr("ent.row.sessionLength.hintA")} ${ROOM_TIMER_MIN}–${ROOM_TIMER_MAX} ${tr("ent.row.sessionLength.hintB")}`,
          cells: [
            // Free does not merely default to a timer, it cannot switch one off:
            // the countdown is forced to its maximum when none was asked for.
            f.roomTimerOptional ? tr("ent.asLongAsYouLike") : `${ROOM_TIMER_MAX} ${tr("ent.minutes")}`,
            p.roomTimerOptional ? tr("ent.asLongAsYouLike") : `${ROOM_TIMER_MAX} ${tr("ent.minutes")}`,
            m.roomTimerOptional ? tr("ent.asLongAsYouLike") : `${ROOM_TIMER_MAX} ${tr("ent.minutes")}`,
          ],
        },
        {
          label: tr("ent.row.roomVisibility.label"),
          hint: tr("ent.row.roomVisibility.hint"),
          cells: [
            f.roomVisibilityChoice ? tr("ent.privateOrPublic") : tr("ent.privateAlways"),
            p.roomVisibilityChoice ? tr("ent.privateOrPublic") : tr("ent.privateAlways"),
            m.roomVisibilityChoice ? tr("ent.privateOrPublic") : tr("ent.privateAlways"),
          ],
        },
        {
          label: tr("ent.row.privateSession.label"),
          hint: tr("ent.row.privateSession.hint"),
          cells: [
            un(f.privateRayaPerMonth, "ent.perMonth", tr),
            un(p.privateRayaPerMonth, "ent.perMonth", tr),
            un(m.privateRayaPerMonth, "ent.perMonth", tr),
          ],
        },
        {
          label: tr("ent.row.groupChallenges.label"),
          cells: [un(f.roomChallengesPerRoom, "ent.perRoom", tr), tr("ent.unlimited"), tr("ent.unlimited")],
        },
        { label: tr("ent.row.roomReports.label"), cells: [f.roomReports ? yes(tr) : null, p.roomReports ? yes(tr) : null, m.roomReports ? yes(tr) : null] },
      ],
    },
  ];
}

/** Schools ladder: Standard · Plus · Custom. */
export function schoolComparison(tr: Tr): CompareGroup[] {
  const [s, p, c] = [SCHOOL_ENTITLEMENTS.standard, SCHOOL_ENTITLEMENTS.plus, SCHOOL_ENTITLEMENTS.custom];
  return [
    {
      title: tr("ent.group.teaching"),
      rows: [
        {
          label: tr("ent.row.lessonPreps.label"),
          hint: tr("ent.row.lessonPreps.hint"),
          cells: [
            un(s.preparePerMonthPerProf, "ent.perTeacherPerMonth", tr),
            un(p.preparePerMonthPerProf, "ent.perTeacherPerMonth", tr),
            tr("ent.unlimited"),
          ],
        },
        {
          label: tr("ent.row.aiGrading.label"),
          hint: tr("ent.row.aiGrading.hint"),
          cells: [
            un(s.aiGradingPerMonthPerProf, "ent.perTeacherPerMonth", tr),
            un(p.aiGradingPerMonthPerProf, "ent.perTeacherPerMonth", tr),
            tr("ent.unlimited"),
          ],
        },
        {
          label: tr("ent.row.studentSimulations.label"),
          hint: tr("ent.row.studentSimulations.hint"),
          cells: [
            un(s.simulationsPerWeekPerProf, "ent.perTeacherPerWeek", tr),
            tr("ent.unlimited"),
            tr("ent.unlimited"),
          ],
        },
        {
          label: tr("ent.row.advancedFollowups.label"),
          hint: tr("ent.row.advancedFollowups.hint"),
          cells: [s.followupsAdvanced ? yes(tr) : null, p.followupsAdvanced ? yes(tr) : null, c.followupsAdvanced ? yes(tr) : null],
        },
      ],
    },
    {
      title: tr("ent.group.insightsReports"),
      rows: [
        {
          label: tr("ent.row.reports.label"),
          cells: [un(s.reportsPerWeekPerProf, "ent.perTeacherPerWeek", tr), tr("ent.unlimited"), tr("ent.unlimited")],
        },
        {
          label: tr("ent.row.autoDailyReports.label"),
          cells: [s.autoDailyReports ? yes(tr) : null, p.autoDailyReports ? yes(tr) : null, c.autoDailyReports ? yes(tr) : null],
        },
        {
          label: tr("ent.row.advancedInsights.label"),
          cells: [s.insightsAdvanced ? yes(tr) : null, p.insightsAdvanced ? yes(tr) : null, c.insightsAdvanced ? yes(tr) : null],
        },
        {
          label: tr("ent.row.exportInsights.label"),
          hint: tr("ent.row.exportInsights.hint"),
          cells: [s.insightsExport ? yes(tr) : null, p.insightsExport ? yes(tr) : null, c.insightsExport ? yes(tr) : null],
        },
        {
          label: tr("ent.row.documentExports.label"),
          cells: [un(s.exportsPerMonth, "ent.perMonth", tr), tr("ent.unlimited"), tr("ent.unlimited")],
        },
        {
          label: tr("ent.row.logoOnDocs.label"),
          cells: [s.schoolLogoOnDocs ? yes(tr) : null, p.schoolLogoOnDocs ? yes(tr) : null, c.schoolLogoOnDocs ? yes(tr) : null],
        },
      ],
    },
    {
      title: tr("ent.group.adminData"),
      rows: [
        {
          label: tr("ent.row.dataArchive.label"),
          hint: tr("ent.row.dataArchive.hint"),
          cells: [`${s.archiveYears} ${tr("ent.years")}`, `${p.archiveYears} ${tr("ent.years")}`, tr("ent.asAgreed")],
        },
        {
          label: tr("ent.row.lmsSync.label"),
          hint: tr("ent.row.lmsSync.hint"),
          cells: [s.lms ? yes(tr) : null, p.lms ? yes(tr) : null, c.lms ? yes(tr) : null],
        },
        { label: tr("ent.row.sso.label"), cells: [s.sso ? yes(tr) : null, p.sso ? yes(tr) : null, c.sso ? yes(tr) : null] },
        {
          label: tr("ent.row.multiSchool.label"),
          cells: [s.multiSchool ? yes(tr) : null, p.multiSchool ? yes(tr) : null, c.multiSchool ? yes(tr) : null],
        },
        {
          label: tr("ent.row.consolidatedMonitoring.label"),
          hint: tr("ent.row.consolidatedMonitoring.hint"),
          cells: [s.consolidatedView ? yes(tr) : null, p.consolidatedView ? yes(tr) : null, c.consolidatedView ? yes(tr) : null],
        },
      ],
    },
  ];
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
