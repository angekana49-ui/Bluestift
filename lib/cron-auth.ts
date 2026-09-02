import { timingSafeEqual } from "node:crypto";

/**
 * The bearer check every cron route shares.
 *
 * Extracted rather than copied. It was written once, for the route that erases
 * accounts, and a second cron would have meant a second copy of a security
 * check — which is how one of them ends up with a `!==` in it a year later
 * while the other keeps the constant-time compare.
 *
 * `!==` on a secret leaks its prefix through timing. The window is narrow over
 * HTTP, but these endpoints erase accounts and probe internals, so it is not
 * the place to rely on the attack being inconvenient. Digests of equal length
 * are compared so a length mismatch neither throws nor leaks the length.
 *
 * An UNSET secret is closed, never open: a cron endpoint that answers anyone
 * because it was not configured is worse than one that answers nobody.
 */
export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const presented = request.headers.get("authorization") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
