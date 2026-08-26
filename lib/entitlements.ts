import "server-only";
import { ROOM_TIMER_MIN, ROOM_TIMER_MAX } from "@/lib/rooms";
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
function quota(n: number | null, noun: string): string {
  return n == null ? `Unlimited ${noun}` : `${n} ${noun}`;
}

/**
 * The chat line on a pricing card, from the field the gate reads — so the card
 * cannot promise what the gate would refuse. Unlimited says so in words rather
 * than as "Unlimited messages / day", which reads like a limit that lost its
 * number.
 */
function chatLine(e: RayaEntitlements): string {
  return e.messagesPerDay == null
    ? "Unlimited AI tutor chat"
    : `${e.messagesPerDay} AI tutor messages / day`;
}

/** Pricing-card bullets for a Raya (b2c) tier, derived from RAYA_ENTITLEMENTS. */
export function rayaFeatureBullets(tier: RayaTier): string[] {
  const e = RAYA_ENTITLEMENTS[tier];
  switch (tier) {
    case "free":
      return [
        `${chatLine(e)} — the core learning loop`,
        `${quota(e.generationsPerMonth, "study generations")} & ${quota(e.uploadsPerMonth, "uploads")} / month`,
        `${e.roomsPerMonth} study rooms / month · up to ${e.roomMaxParticipants} peers · always private`,
        `${e.convHistoryDays}-day conversation history`,
        `${e.kernelAnalysisPerWeek} Kernel deep-dive per week`,
      ];
    case "plus":
      return [
        "Everything in Free, plus:",
        chatLine(e),
        "Voice input & every AI tutor mode",
        `${quota(e.generationsPerMonth, "generations")} & ${quota(e.uploadsPerMonth, "uploads")} / month`,
        "Mind maps, PDF export, no watermark",
        // Not "private rooms" any more — every room is private, on every plan.
        // What Plus buys is the choice to open one, and the room-size ceiling.
        `Unlimited rooms · up to ${e.roomMaxParticipants} peers · public if you want`,
        `${e.privateRayaPerMonth} private sessions with Raya in a room / month`,
        "Unlimited chat history & Kernel analysis",
        "AI feedback on self-tests",
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
      // What is left is Max's whole real delta over Plus, and it is thin: the
      // quotas come off, rooms double, attachments gain 5MB. Printing a thin
      // delta honestly is a pricing problem to solve with the pricing, not a
      // copy problem to solve with an adjective.
      return [
        "Everything in Plus, plus:",
        "Unlimited study generations & uploads",
        `Study rooms up to ${e.roomMaxParticipants} participants`,
        `${e.attachmentMaxMb} MB attachments & study packets`,
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

// ---- The comparison table ---------------------------------------------------
/*
 * Three cards cannot answer "what do I get, and up to what limit".
 *
 * The cards are a ladder written as prose: each one opens on "Everything in the
 * tier below, plus", so a buyer asking a flat question — how many rooms on Plus,
 * how many gradings on Standard — has to hold three lists in their head and diff
 * them. That is the one job the pricing page exists to do, and it was the one
 * job it left to the reader. Worse, the same capability was named differently in
 * each card ("Unlimited private rooms" against "Study rooms up to 50
 * participants"), so even the diff was unreliable.
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
const un = (n: number | null, suffix: string) => (n == null ? "Unlimited" : `${n} ${suffix}`);
const yes = "Included";

/** Solo ladder: Free · Plus · Max. */
export function rayaComparison(): CompareGroup[] {
  const [f, p, m] = [RAYA_ENTITLEMENTS.free, RAYA_ENTITLEMENTS.plus, RAYA_ENTITLEMENTS.max];
  return [
    {
      title: "Learning with Raya",
      rows: [
        {
          label: "AI tutor messages",
          hint: "Every exchange with Raya, on any subject.",
          cells: [`${f.messagesPerDay} / day`, "Unlimited", "Unlimited"],
        },
        {
          label: "Voice input and tutor modes",
          hint: "Speak instead of typing, and choose how Raya talks to you.",
          cells: [f.voiceInput ? yes : null, p.voiceInput ? yes : null, m.voiceInput ? yes : null],
        },
        {
          label: "Conversation history",
          cells: [`${f.convHistoryDays} days`, "Kept", "Kept"],
        },
        {
          label: "Kernel deep-dive",
          hint: "A full re-read of your concept profile, on demand.",
          cells: [un(f.kernelAnalysisPerWeek, "/ week"), "Unlimited", "Unlimited"],
        },
        {
          label: "AI feedback on self-tests",
          cells: [f.selfTestAiAnalysis ? yes : null, p.selfTestAiAnalysis ? yes : null, m.selfTestAiAnalysis ? yes : null],
        },
      ],
    },
    {
      title: "Study tools",
      rows: [
        {
          label: "Study generations",
          hint: "One summary, flashcard deck, quiz or mind map made from a lesson.",
          cells: [un(f.generationsPerMonth, "/ month"), un(p.generationsPerMonth, "/ month"), un(m.generationsPerMonth, "/ month")],
        },
        {
          label: "Document uploads",
          cells: [un(f.uploadsPerMonth, "/ month"), un(p.uploadsPerMonth, "/ month"), un(m.uploadsPerMonth, "/ month")],
        },
        { label: "Mind maps", cells: [f.mindMap ? yes : null, p.mindMap ? yes : null, m.mindMap ? yes : null] },
        {
          label: "PDF export, no watermark",
          cells: [f.pdfExport ? yes : null, p.pdfExport ? yes : null, m.pdfExport ? yes : null],
        },
        {
          label: "Attachment size",
          cells: [`${f.attachmentMaxMb} MB`, `${p.attachmentMaxMb} MB`, `${m.attachmentMaxMb} MB`],
        },
      ],
    },
    {
      title: "Study rooms",
      rows: [
        {
          label: "Rooms you can open",
          cells: [un(f.roomsPerMonth, "/ month"), "Unlimited", "Unlimited"],
        },
        {
          label: "People in a room",
          cells: [`${f.roomMaxParticipants}`, `${p.roomMaxParticipants}`, `${m.roomMaxParticipants}`],
        },
        {
          label: "How long a session runs",
          hint: `A room can carry a ${ROOM_TIMER_MIN}–${ROOM_TIMER_MAX} minute countdown; when it runs out the room turns read-only and the report is still there.`,
          cells: [
            // Free does not merely default to a timer, it cannot switch one off:
            // the countdown is forced to its maximum when none was asked for.
            f.roomTimerOptional ? "As long as you like" : `${ROOM_TIMER_MAX} minutes`,
            p.roomTimerOptional ? "As long as you like" : `${ROOM_TIMER_MAX} minutes`,
            m.roomTimerOptional ? "As long as you like" : `${ROOM_TIMER_MAX} minutes`,
          ],
        },
        {
          label: "Who can see the room",
          hint: "Every room starts private. Opening one to everybody is a choice a paid account makes; on Free it is not offered at all.",
          cells: [
            f.roomVisibilityChoice ? "Private or public" : "Private, always",
            p.roomVisibilityChoice ? "Private or public" : "Private, always",
            m.roomVisibilityChoice ? "Private or public" : "Private, always",
          ],
        },
        {
          label: "Private session with Raya",
          hint: "A one-to-one with Raya inside the room, which the other members do not see.",
          cells: [
            un(f.privateRayaPerMonth, "/ month"),
            un(p.privateRayaPerMonth, "/ month"),
            un(m.privateRayaPerMonth, "/ month"),
          ],
        },
        {
          label: "Group challenges per room",
          cells: [un(f.roomChallengesPerRoom, "per room"), "Unlimited", "Unlimited"],
        },
        { label: "Room reports", cells: [f.roomReports ? yes : null, p.roomReports ? yes : null, m.roomReports ? yes : null] },
      ],
    },
  ];
}

/** Schools ladder: Standard · Plus · Custom. */
export function schoolComparison(): CompareGroup[] {
  const [s, p, c] = [SCHOOL_ENTITLEMENTS.standard, SCHOOL_ENTITLEMENTS.plus, SCHOOL_ENTITLEMENTS.custom];
  return [
    {
      title: "Teaching",
      rows: [
        {
          label: "Lesson preparations",
          hint: "A lesson or exercise set prepared for one class, from your own material.",
          cells: [
            un(s.preparePerMonthPerProf, "/ teacher / month"),
            un(p.preparePerMonthPerProf, "/ teacher / month"),
            "Unlimited",
          ],
        },
        {
          label: "AI grading",
          hint: "A batch of student work marked, with the reasoning shown to the teacher.",
          cells: [
            un(s.aiGradingPerMonthPerProf, "/ teacher / month"),
            un(p.aiGradingPerMonthPerProf, "/ teacher / month"),
            "Unlimited",
          ],
        },
        {
          label: "Student simulations",
          hint: "A what-if projection of where one student is heading if nothing changes.",
          cells: [
            un(s.simulationsPerWeekPerProf, "/ teacher / week"),
            "Unlimited",
            "Unlimited",
          ],
        },
        {
          label: "Advanced follow-ups",
          hint: "Shared across the teaching team rather than kept by one teacher.",
          cells: [s.followupsAdvanced ? yes : null, p.followupsAdvanced ? yes : null, c.followupsAdvanced ? yes : null],
        },
      ],
    },
    {
      title: "Insights and reports",
      rows: [
        {
          label: "Reports",
          cells: [un(s.reportsPerWeekPerProf, "/ teacher / week"), "Unlimited", "Unlimited"],
        },
        {
          label: "Automatic daily reports",
          cells: [s.autoDailyReports ? yes : null, p.autoDailyReports ? yes : null, c.autoDailyReports ? yes : null],
        },
        {
          label: "Advanced insights",
          cells: [s.insightsAdvanced ? yes : null, p.insightsAdvanced ? yes : null, c.insightsAdvanced ? yes : null],
        },
        {
          label: "Export insights",
          hint: "The underlying figures out of the dashboard, not just the view.",
          cells: [s.insightsExport ? yes : null, p.insightsExport ? yes : null, c.insightsExport ? yes : null],
        },
        {
          label: "Document exports",
          cells: [un(s.exportsPerMonth, "/ month"), "Unlimited", "Unlimited"],
        },
        {
          label: "Your logo on every document",
          cells: [s.schoolLogoOnDocs ? yes : null, p.schoolLogoOnDocs ? yes : null, c.schoolLogoOnDocs ? yes : null],
        },
      ],
    },
    {
      title: "Administration and data",
      rows: [
        {
          label: "Data archive",
          hint: "How far back the school's own records stay available to it.",
          cells: [`${s.archiveYears} years`, `${p.archiveYears} years`, "As agreed"],
        },
        {
          label: "LMS sync",
          hint: "Classes and rosters come from the system you already run.",
          cells: [s.lms ? yes : null, p.lms ? yes : null, c.lms ? yes : null],
        },
        { label: "Single sign-on", cells: [s.sso ? yes : null, p.sso ? yes : null, c.sso ? yes : null] },
        {
          label: "Several schools, one account",
          cells: [s.multiSchool ? yes : null, p.multiSchool ? yes : null, c.multiSchool ? yes : null],
        },
        {
          label: "Consolidated monitoring",
          hint: "Every class of every school on one screen, rather than one at a time.",
          cells: [s.consolidatedView ? yes : null, p.consolidatedView ? yes : null, c.consolidatedView ? yes : null],
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
