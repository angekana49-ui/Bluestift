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

/** Drop a cached decision — call after the age or the account changes. */
export function forgetOptionalProcessing(userId: string): void {
  memo.delete(userId);
}
