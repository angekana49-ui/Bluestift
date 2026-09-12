/**
 * The `Domain` attribute for the Supabase session cookies on a request to
 * `host` — or undefined, which writes a host-only cookie.
 *
 * ONE function, called by all three clients (browser, server, proxy), because
 * the failure it prevents is two scopes for one cookie name. `sb-<ref>-auth-token`
 * written host-only on `www.raya.thebluestift.com` and again on
 * `.thebluestift.com` are two different cookies to the browser. It sends both,
 * the browser client and Next parse the duplicate differently (first wins vs
 * last wins), and signing out clears only the copy in its own scope — so the
 * server keeps authenticating with a revoked token. That is exactly what
 * happened once `NEXT_PUBLIC_COOKIE_DOMAIN` went live: the proxy never passed a
 * domain, the other two did.
 *
 * It is host-aware rather than a raw read of the variable because a `Domain`
 * that does not match the host is rejected by the browser SILENTLY. `.env.local`
 * carries the production value, so on localhost — and on every `*.vercel.app`
 * preview — a raw read made sign-in "succeed" and store nothing.
 */
export function cookieDomainFor(host: string | null | undefined): string | undefined {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (!domain || !host) return undefined;
  const hostname = host.split(":")[0].toLowerCase();
  const apex = domain.replace(/^\./, "").toLowerCase();
  if (!apex) return undefined;
  return hostname === apex || hostname.endsWith(`.${apex}`) ? domain : undefined;
}

/**
 * The `sb-` cookie names in a raw `Cookie` header that the browser holds in
 * more than one scope — the leftovers of the proxy writing host-only copies
 * next to the parent-domain ones.
 *
 * A `Cookie` header carries names and values only, never the scope, so the
 * duplicate itself is the evidence. Two shapes count, grouped by the name with
 * its chunk suffix (`.0`, `.1`…) removed:
 *   - the same name sent twice;
 *   - the whole value AND chunks of it at once, which one scope could never
 *     produce, since writing either form clears the other in that scope.
 * Every name in such a group is returned, so the caller can expire the
 * host-only copies and let the parent-domain session stand alone.
 */
export function conflictingSessionCookies(cookieHeader: string | null | undefined): string[] {
  if (!cookieHeader) return [];
  const groups = new Map<string, { names: Set<string>; repeated: boolean }>();
  for (const part of cookieHeader.split(";")) {
    const name = part.split("=")[0].trim();
    if (!name.startsWith("sb-")) continue;
    const base = name.replace(/\.\d+$/, "");
    const group = groups.get(base) ?? { names: new Set<string>(), repeated: false };
    if (group.names.has(name)) group.repeated = true;
    group.names.add(name);
    groups.set(base, group);
  }
  const conflicting: string[] = [];
  for (const [base, { names, repeated }] of groups) {
    const whole = names.has(base);
    const chunked = [...names].some((n) => n !== base);
    if (repeated || (whole && chunked)) conflicting.push(...names);
  }
  return conflicting;
}
