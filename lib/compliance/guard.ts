import { evaluateAccess } from "./age";

/**
 * Page-level age gate.
 *
 * Every app page already fetches the caller's profile row to check
 * `account_state`; adding these three columns to that same select makes the
 * gate free — no extra round trip, no admin client. RLS scopes the row to its
 * owner and the columns are read-only to the client, so reading them here is
 * safe while writing them still isn't.
 *
 * Existing accounts predate the age question and have no birth year, so they
 * are gated too and sent back through /onboarding to answer it once. That is
 * the point: an age screen that only applies to new sign-ups leaves the
 * children already in the product uncounted.
 */

/**
 * Guarded pages must add `birth_year, minor_consent_source, school_id` to their
 * profile select. Spelled out at each call site rather than interpolated from a
 * constant here: supabase-js infers the row type from the literal select
 * string, and a template literal would erase that.
 */
export type AgeGateRow = {
  birth_year?: number | null;
  minor_consent_source?: string | null;
  school_id?: string | null;
};

/** True when the user must return to /onboarding before using the product. */
export function needsAgeGate(row: AgeGateRow | null | undefined): boolean {
  return !evaluateAccess({
    birthYear: row?.birth_year ?? null,
    schoolId: row?.school_id ?? null,
    minorConsentSource: row?.minor_consent_source ?? null,
  }).allowed;
}
