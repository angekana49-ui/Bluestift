import { ageBand, minimumAge, type AgeBand } from "@/lib/compliance/age";

/**
 * Who Raya is talking to — the bridge between the compliance age gate and the
 * teaching prompt.
 *
 * The age question exists for COPPA and GDPR art. 8, but a birth year is also
 * the single most useful thing a tutor can know: it is the difference between
 * explaining division with sweets and explaining it with a ring homomorphism.
 * Having asked, refusing to teach with the answer would be the waste.
 *
 * Two derivations come out of it, and they must not be confused:
 *
 *  - `band`  — SAFETY. Always from the birth year, never from anything the
 *    student typed later. A 12-year-old who says "university" is still 12.
 *  - `stage` — PITCH. The declared school level wins when we have one, because
 *    a 25-year-old finishing secondary school and a 15-year-old two years ahead
 *    both exist and both know their own situation better than a subtraction.
 *
 * We deliberately pass the BAND and the STAGE to the model, never the birth
 * year or the age itself: the prompt gets the least identifying form of the
 * fact that still changes the teaching. Same rule we apply to sub-processors,
 * applied to ourselves.
 */

export type LearnerStage =
  /** Roughly primary / élémentaire — under ~11. */
  | "primary"
  /** Lower secondary: collège, middle school. */
  | "lower_secondary"
  /** Upper secondary: lycée, high school, exam years. */
  | "upper_secondary"
  /** University, professional study, or an adult learning on their own. */
  | "adult";

export type Audience = {
  band: AgeBand | null;
  stage: LearnerStage | null;
  /** Whether `stage` came from the student or from arithmetic on the year. */
  stageSource: "declared" | "estimated" | null;
};

/** What onboarding stores in `users.school_level`, mapped onto a stage. */
const DECLARED: Record<string, LearnerStage> = {
  middle_school: "lower_secondary",
  high_school: "upper_secondary",
  university: "adult",
};

/**
 * Stage from a birth year. Because `minimumAge` rounds DOWN (a year cannot say
 * whether the birthday has happened), this is a FLOOR — the student is at this
 * stage or above it, never below. The prompt is told as much, so the model
 * corrects upward from the student's own writing rather than talking down to
 * someone eleven months older than we can prove.
 */
function estimateStage(birthYear: number, now: Date): LearnerStage {
  const age = minimumAge(birthYear, now);
  if (age < 11) return "primary";
  if (age < 15) return "lower_secondary";
  if (age < 18) return "upper_secondary";
  return "adult";
}

export function resolveAudience(input: {
  birthYear?: number | null;
  /** `users.school_level`, if the student picked one during onboarding. */
  schoolLevel?: string | null;
  now?: Date;
}): Audience {
  const now = input.now ?? new Date();
  const band = ageBand(input.birthYear, now);

  const declared = input.schoolLevel ? DECLARED[input.schoolLevel] : undefined;
  if (declared) return { band, stage: declared, stageSource: "declared" };

  // "other" and an unrecognised value fall through to the year on purpose: an
  // adult retraining picks "other", and so does a child who didn't read the
  // options. The year is the answer we can trust.
  if (band == null || input.birthYear == null) {
    return { band, stage: null, stageSource: null };
  }
  return {
    band,
    stage: estimateStage(input.birthYear, now),
    stageSource: "estimated",
  };
}

/** How to pitch, per stage. Read by the model, so it is written as guidance. */
const STAGE_GUIDANCE: Record<LearnerStage, string> = {
  primary:
    "Short sentences, one idea at a time, examples from everyday life. Unpack every technical word before using it. Ask one small question, not a chain of them.",
  lower_secondary:
    "Concrete before abstract. Define each technical term the first time it appears. Keep steps small enough that the student can see the join between two of them.",
  upper_secondary:
    "Formal notation and standard terminology are fine. Expect them to carry a multi-step argument, and to be working towards an exam — precision in the wording of an answer counts.",
  adult:
    "No simplification by default. Match their register, go straight to the substance, and treat them as capable of the full argument.",
};

const BAND_GUIDANCE: Record<AgeBand, string> = {
  child:
    "This student is a child. The safeguarding and personal-information rules apply to every turn without exception, and being direct about involving an adult matters more here than anywhere else.",
  teen: "This student is a minor. The safeguarding and personal-information rules apply in full.",
  adult: "This student is an adult. The standing safety rules still apply.",
};

/**
 * The `<audience>` lines for the dynamic layer, or [] when nothing is known.
 * Returned as lines rather than a block so they sit inside the existing
 * `<learner_state>` envelope — same "data, not instructions" framing as the
 * Kernel signals, and the model already knows never to mention it.
 */
export function audienceLines(audience: Audience): string[] {
  const lines: string[] = [];

  if (audience.band) {
    lines.push(
      `  <age_band value="${audience.band}">${BAND_GUIDANCE[audience.band]}</age_band>`,
    );
  }

  if (audience.stage) {
    const caveat =
      audience.stageSource === "estimated"
        ? " This is estimated from a year of birth and is a FLOOR, never a ceiling: if the student's own vocabulary and reasoning are clearly above it, follow the student. Never say the level back to them."
        : " The student chose this level themselves. If their writing says otherwise, follow the writing.";
    lines.push(
      `  <level value="${audience.stage}">${STAGE_GUIDANCE[audience.stage]}${caveat}</level>`,
    );
  }

  return lines;
}
