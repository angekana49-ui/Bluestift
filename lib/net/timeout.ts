/**
 * Bounded-promise primitives for the degraded-network work. Isomorphic on
 * purpose (no "use client"/"server-only"): the middleware, RSC pages and
 * client hooks all need the same contract.
 */

/**
 * Bound `p` to `ms` milliseconds, TOTAL: resolves `fallback` on deadline AND on
 * rejection — it never rejects. The underlying promise keeps running unawaited
 * (a slow Supabase query still completes and warms whatever cache it feeds);
 * we only stop waiting for it.
 *
 * Use for NON-CRITICAL data only — anything where "degrade to a default" beats
 * "block the page": plan labels, recommendations, cache snapshots, the
 * middleware session refresh. Never wrap something whose failure must be seen.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * An AbortSignal that fires after `ms`. Thin wrapper over the platform so call
 * sites read uniformly and tests can assert on one seam.
 */
export function raceSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}
