/**
 * Age assurance — the single source of truth for every age rule in the product.
 *
 * Three regimes land on this one file:
 *  - COPPA (US) bites under 13 and requires verifiable parental consent, with a
 *    carve-out where a school consents on the parent's behalf for school use.
 *  - GDPR art. 8 puts the age of digital consent between 13 and 16 depending on
 *    the member state, for processing whose lawful basis is consent.
 *  - FERPA governs school records rather than age, but reaches us through the
 *    same school-authorised path.
 *
 * We only ever store a birth YEAR (see the migration), which means we never
 * know whether this year's birthday has happened. Every rule below therefore
 * works off the MINIMUM age the year allows — `year - birthYear - 1`. Rounding
 * a student down is harmless; rounding one up is the failure that matters.
 */

export type AgeBand = "child" | "teen" | "adult";

/** COPPA applies to children under this age. */
export const CHILD_UNDER = 13;
/** Below this, the user is a minor. */
export const ADULT_FROM = 18;

/** Oldest birth year we'll accept — a guard against typos, not a real limit. */
const EARLIEST_YEAR = 1900;

/**
 * Optional, consent-based processing (product analytics, and using the
 * student's content to improve models) is switched off for every minor rather
 * than per-jurisdiction.
 *
 * GDPR art. 8 would let a 16-year-old consent in some member states, and this
 * rule is stricter than that. It is deliberate: the alternative is resolving
 * each student's country and its national age, and getting that wrong on a
 * child is a far worse outcome than losing analytics on a 17-year-old. Loosen
 * it here, in one place, if that trade ever changes.
 */
const OPTIONAL_PROCESSING_MIN_BAND: AgeBand = "adult";

/** A birth year we're willing to record at all. */
export function isPlausibleBirthYear(year: number, now: Date = new Date()): boolean {
  return (
    Number.isInteger(year) && year >= EARLIEST_YEAR && year <= now.getUTCFullYear()
  );
}

/**
 * The youngest age this birth year can correspond to today. Used everywhere
 * instead of `year - birthYear`, which would silently age a 12-year-old into
 * a 13-year-old for the eleven months before their birthday.
 */
export function minimumAge(birthYear: number, now: Date = new Date()): number {
  return now.getUTCFullYear() - birthYear - 1;
}

/** Band for a declared birth year; null when nothing has been declared yet. */
export function ageBand(
  birthYear: number | null | undefined,
  now: Date = new Date(),
): AgeBand | null {
  if (birthYear == null || !isPlausibleBirthYear(birthYear, now)) return null;
  const age = minimumAge(birthYear, now);
  if (age < CHILD_UNDER) return "child";
  if (age < ADULT_FROM) return "teen";
  return "adult";
}

export function isMinor(band: AgeBand | null): boolean {
  // An undeclared band is treated as a minor: the safe reading of "we don't
  // know" is the one that withholds optional processing.
  return band !== "adult";
}

/**
 * May we run analytics / model-training on this account? Consent alone is not
 * enough — a minor's consent isn't valid for this, so the band gates it before
 * the checkbox is ever consulted.
 */
export function allowsOptionalProcessing(band: AgeBand | null): boolean {
  return band === OPTIONAL_PROCESSING_MIN_BAND;
}

export type AccessDecision =
  | { allowed: true; band: AgeBand }
  /** Under 13 with nobody authorised to act for them — the COPPA block. */
  | { allowed: false; band: "child"; reason: "needs_school_or_parent" }
  /** No age on file yet; the caller should send them to the age step. */
  | { allowed: false; band: null; reason: "age_undeclared" };

/**
 * Whether an account may use the product on its own.
 *
 * Under 13 we do not attempt verifiable parental consent ourselves — no card
 * check, no ID upload, none of the mechanisms COPPA accepts. We rely solely on
 * the school-consent exception (16 CFR 312.5(c)(6)): a child reaches Raya
 * because their school authorised it, and the school is also the FERPA "school
 * official" relationship we operate under. A child with no school and no
 * recorded parental authorisation is refused, not quietly downgraded.
 */
export function evaluateAccess(input: {
  birthYear: number | null | undefined;
  /** The school that vouches for this student, if any. */
  schoolId?: string | null;
  /** A recorded authorisation, if one was captured out of band. */
  minorConsentSource?: string | null;
  now?: Date;
}): AccessDecision {
  const band = ageBand(input.birthYear, input.now ?? new Date());
  if (band == null) return { allowed: false, band: null, reason: "age_undeclared" };
  if (band !== "child") return { allowed: true, band };

  const vouched =
    Boolean(input.schoolId) ||
    input.minorConsentSource === "school" ||
    input.minorConsentSource === "parent";
  return vouched
    ? { allowed: true, band: "child" }
    : { allowed: false, band: "child", reason: "needs_school_or_parent" };
}
