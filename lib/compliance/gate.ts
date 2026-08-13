import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateAccess, ageBand, allowsOptionalProcessing } from "./age";
import type { AccessDecision, AgeBand } from "./age";

/**
 * Server-side age gate. The onboarding UI asks the question, but this is what
 * actually decides — a client that skips the step, or posts around it, still
 * has to come back through here to reach any product surface.
 *
 * Reads through the admin client on purpose: `birth_year` and the consent
 * columns are not in the client's column-level UPDATE whitelist, and they are
 * not the user's to assert.
 */

export type AgeStatus = {
  decision: AccessDecision;
  band: AgeBand | null;
  /** True once the user has answered the age question at all. */
  declared: boolean;
  /** Whether analytics / model-training may run for this account. */
  optionalProcessing: boolean;
};

type Row = {
  birth_year: number | null;
  age_declared_at: string | null;
  minor_consent_source: string | null;
  school_id: string | null;
};

export async function getAgeStatus(userId: string): Promise<AgeStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("birth_year, age_declared_at, minor_consent_source, school_id")
    .eq("id", userId)
    .maybeSingle();

  // A read failure must not open the gate. With no row we fall through to the
  // undeclared branch, which blocks and routes back to the age question.
  const row = (data ?? null) as Row | null;
  const birthYear = row?.birth_year ?? null;

  return {
    decision: evaluateAccess({
      birthYear,
      schoolId: row?.school_id ?? null,
      minorConsentSource: row?.minor_consent_source ?? null,
    }),
    band: ageBand(birthYear),
    declared: Boolean(row?.age_declared_at),
    optionalProcessing: allowsOptionalProcessing(ageBand(birthYear)),
  };
}

/**
 * Convenience for page-level guards: the path a user must be sent to before
 * they can use the product, or null when nothing stands in their way.
 */
export async function ageGateRedirect(userId: string): Promise<string | null> {
  const { decision } = await getAgeStatus(userId);
  return decision.allowed ? null : "/onboarding";
}
