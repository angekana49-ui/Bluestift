/**
 * The trailing-slash redirect Next.js used to apply by itself.
 *
 * `skipTrailingSlashRedirect` is on (next.config.ts) because PostHog's SDK posts
 * to slash-terminated paths under `/ingest`, and Next's built-in redirect runs
 * before any rewrite could catch them. Turning it off is global, though, so the
 * proxy puts it back for every path the proxy sees — which is everything except
 * static assets and `/ingest` (see the matcher in proxy.ts).
 *
 * Same rule as Next's own: one slash removed, never from the root, and never
 * under `/.well-known/`, where some consumers require the slash.
 */
export function trailingSlashTarget(pathname: string): string | null {
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  if (pathname === "/.well-known/" || pathname.startsWith("/.well-known/")) return null;
  return pathname.slice(0, -1);
}
