/**
 * A ceiling for the in-process caches keyed by user or school.
 *
 * Those caches expire entries LAZILY — the TTL is checked when a key is read
 * again, so a key that is never read again is never removed. That is fine for
 * the two caches keyed by a fixed handful of strings (the plan catalogue, the
 * published articles) and wrong for the ones keyed by an account id: on a
 * long-lived server the map grows with every distinct visitor and nothing ever
 * shrinks it. `anchoredCache` is the sharpest case, because its TTL is thirty
 * days — an entry written today is still resident next month.
 *
 * On serverless the instance is usually recycled before that matters, which is
 * exactly why it is easy to miss and worth writing down rather than relying on.
 *
 * Clearing wholesale rather than evicting the oldest is deliberate, and copied
 * from `lib/observability/report.ts`, which reached the same conclusion for the
 * same reason: tracking insertion order costs more than the thing being saved,
 * and the only penalty for dropping a warm cache is that the next few reads go
 * to the database. A process holding this many distinct accounts at once has a
 * cheap re-fetch ahead of it either way.
 */
export function capMap(map: Map<unknown, unknown>, max: number): void {
  if (map.size > max) map.clear();
}

/**
 * The default ceiling. Large enough that a real instance never reaches it
 * during a normal burst of traffic, small enough that reaching it cannot cost
 * meaningful memory — the largest entries here are Kernel profiles.
 */
export const CACHE_MAX_ENTRIES = 5000;
