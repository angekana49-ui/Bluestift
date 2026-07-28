import "server-only";
import { withTimeout } from "@/lib/net/timeout";

/**
 * Helpers for the RSC page hot path.
 *
 * Every connected page blocks on Supabase before it can emit a single byte, so
 * the ordering of those queries IS the page's time-to-first-paint. Two rules
 * come out of that:
 *   1. queries that don't depend on each other belong in one `Promise.all`;
 *   2. anything NON-CRITICAL to the page's purpose gets a deadline — a slow
 *      plan-label lookup must degrade to "Free", never hold the whole screen.
 */

/** Deadline for chrome-level data (plan labels, soft recommendations). */
const SOFT_MS = 800;

/**
 * Bound a non-critical page query: past `ms` (or on failure) the page renders
 * with `fallback` instead of waiting. Use ONLY where a wrong-but-instant value
 * beats a correct-but-late page.
 */
export function softValue<T>(p: Promise<T>, fallback: T, ms: number = SOFT_MS): Promise<T> {
  return withTimeout(p, ms, fallback);
}
