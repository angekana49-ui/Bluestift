/**
 * What a page view is allowed to say about where someone is.
 *
 * A URL in this app is not just a location. Several of them are CREDENTIALS:
 *
 *  - `/s/<token>` is a bearer capability — whoever holds the token reads the
 *    shared document, no account required (app/s/[token]/page.tsx);
 *  - `/rooms/<uuid>` is how a private study room is joined, because holding the
 *    room's id IS the invitation (joinRoom in app/rooms/actions.ts);
 *  - `?pid=`, `?code=`, `?token_hash=` carry payment and sign-in material.
 *
 * Sent verbatim to a product-analytics processor, those stop being ours: anyone
 * with access to that project — or to a copy of it — can open a child's shared
 * work and walk into their private room. So the path is reduced to its SHAPE
 * before it leaves the browser, and the query string is dropped except for the
 * few keys that carry no identity.
 *
 * `/rooms/9f1c…/` becomes `/rooms/[id]`, which is the only part any funnel was
 * ever reading anyway. Nothing here is a substitute for consent — it applies
 * after consent, to visitors who said yes.
 *
 * Pure and dependency-free so the rule can be tested directly.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Query keys that survive. Everything else is dropped rather than redacted,
 * because a list of what is DANGEROUS is a list that goes stale the next time
 * someone adds a parameter; a list of what is HARMLESS does not.
 *
 * `utm_*` and `ref` are kept by prefix below — they are how a launch is
 * measured, and they describe the campaign, never the visitor.
 */
const SAFE_QUERY_KEYS = new Set(["tab", "view", "lang", "locale", "brand", "category", "error"]);

/** A path segment that identifies one THING rather than one kind of thing. */
function isIdentifier(segment: string): boolean {
  if (UUID.test(segment)) return true;
  // Random tokens: share links are 12 chars of base64url, class/staff codes 6-8
  // of an unambiguous alphabet. Anything that long with no vowel-and-lowercase
  // shape of a real route name is treated as an id — over-redacting a path costs
  // a funnel some detail; under-redacting one hands out a credential.
  if (segment.length >= 8 && /[A-Za-z0-9_-]/.test(segment) && /\d|[A-Z]/.test(segment)) return true;
  return false;
}

/** Reduce a concrete pathname to its route shape. */
export function scrubPath(pathname: string): string {
  const parts = pathname.split("/");
  const out = parts.map((segment, i) => {
    if (!segment) return segment;
    // The share token is a capability whatever it happens to look like, so it
    // is named rather than matched — a short token must not slip through the
    // shape test above.
    if (i === 2 && parts[1] === "s") return "[token]";
    return isIdentifier(segment) ? "[id]" : segment;
  });
  return out.join("/") || "/";
}

/** The query string that may travel, or "" when nothing may. */
export function scrubQuery(search: string): string {
  if (!search) return "";
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (SAFE_QUERY_KEYS.has(key) || key.startsWith("utm_") || key === "ref") {
      kept.append(key, value.slice(0, 64));
    }
  }
  const q = kept.toString();
  return q ? `?${q}` : "";
}

/**
 * The full value sent as `$current_url`. The origin is kept — it says which
 * product the visitor is on once the domains split, and it identifies nobody.
 */
export function scrubUrl(origin: string, pathname: string, search = ""): string {
  return `${origin}${scrubPath(pathname)}${scrubQuery(search)}`;
}
