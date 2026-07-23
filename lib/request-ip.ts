import "server-only";

/**
 * Best-effort client IP for abuse controls (per-IP signup anti-burst).
 * On Vercel, `x-real-ip` is the actual connecting address the platform sets and
 * is not spoofable the way a client-sent `x-forwarded-for` can be — prefer it,
 * then fall back to the left-most XFF hop. Returns "" when unknown (callers must
 * treat an empty IP as "can't identify", never as a shared bucket).
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff && xff.trim()) return xff.split(",")[0].trim();
  return "";
}
