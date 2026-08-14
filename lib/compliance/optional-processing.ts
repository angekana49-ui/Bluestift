import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ageBand, allowsOptionalProcessing } from "./age";

/**
 * May we run consent-based processing — product analytics, and using content to
 * improve models — for this account?
 *
 * Consent alone never answers that question. A minor's consent isn't valid for
 * it, so the age band is checked first and the checkbox second. This is the
 * server-side half of the rule; the client half only stops the SDK loading.
 *
 * Memoised per process because the hot caller is telemetry, and telemetry that
 * adds a database round trip to every event will eventually be the reason a
 * request is slow. The window is short enough that a birthday, or an erasure,
 * costs at most a few minutes of staleness — and staleness here fails closed
 * for a child (their band only ever loosens with time).
 */

const TTL_MS = 5 * 60 * 1000;
const memo = new Map<string, { allowed: boolean; at: number }>();

export async function optionalProcessingAllowed(userId: string): Promise<boolean> {
  const hit = memo.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.allowed;

  let allowed = false;
  try {
    const { data } = await createAdminClient()
      .from("users")
      .select("birth_year")
      .eq("id", userId)
      .maybeSingle();
    allowed = allowsOptionalProcessing(ageBand(data?.birth_year ?? null));
  } catch {
    // Unknown age is treated as a minor — see allowsOptionalProcessing.
    allowed = false;
  }

  memo.set(userId, { allowed, at: now });
  return allowed;
}

/**
 * May this account's content be used to improve the models?
 *
 * Deliberately NOT the same question as `optionalProcessingAllowed`. That one
 * gates product analytics; this one gates training. They were conflated only in
 * the sense that neither was checked here — `training_consent` was written by
 * the settings switch and then read by nothing, so the control was decorative.
 * Anything that ships content to a training pipeline must call this.
 *
 * Two conditions, in this order:
 *  - the age band allows optional processing at all (adults only), and
 *  - the user has not switched it off.
 *
 * The band is checked first for the same reason it is everywhere else: a minor
 * cannot grant this, so their stored column value is irrelevant.
 */
const trainingMemo = new Map<string, { allowed: boolean; at: number }>();

export async function trainingAllowed(userId: string): Promise<boolean> {
  const hit = trainingMemo.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.allowed;

  let allowed = false;
  try {
    const { data } = await createAdminClient()
      .from("users")
      .select("birth_year, training_consent")
      .eq("id", userId)
      .maybeSingle();
    allowed =
      allowsOptionalProcessing(ageBand(data?.birth_year ?? null)) &&
      data?.training_consent === true;
  } catch {
    // A read failure must not enrol someone by accident.
    allowed = false;
  }

  trainingMemo.set(userId, { allowed, at: now });
  return allowed;
}

/** Drop a cached decision — call after the age or the account changes. */
export function forgetOptionalProcessing(userId: string): void {
  memo.delete(userId);
  trainingMemo.delete(userId);
}
