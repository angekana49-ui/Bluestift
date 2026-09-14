/**
 * Which origin owns which path, and where a request on the wrong one goes.
 *
 * One deployment answers all three origins (docs/domains.md), so every origin
 * can render every page. Until this module, only the apex sent anything away —
 * /chat and /school, to their products. Nothing went the other way: a pricing
 * link clicked inside Schools rendered the pricing page on
 * schools.thebluestift.com, and the address bar kept naming the wrong space for
 * as long as the visitor stayed on the site.
 *
 * So the table is symmetric now: whichever origin a request lands on, a path
 * owned by another CONFIGURED origin is sent there.
 *
 * What is deliberately not in the table, and so is served wherever it is asked
 * for:
 *  - `/` on a product origin. next.config.ts sends it to that product's home
 *    (raya./ → /chat, schools./ → /school), and that rule runs before this one.
 *  - the account and auth flow (/login, /onboarding, /auth, /account, /upgrade,
 *    /reset): a magic link comes back to the origin that asked for it, and
 *    moving that is a change to the authentication flow, not to navigation.
 *  - /api, /ops, the manifests and the metadata files.
 */

export type Surface = "site" | "raya" | "schools";

const OWNED: Record<Surface, readonly string[]> = {
  raya: ["/chat", "/rooms", "/assignments", "/tools", "/profile"],
  schools: ["/school"],
  // /s and /checkout stay on the site: a share link is read by the public, and
  // the payment aggregator calls back one stable origin.
  site: [
    "/research",
    "/survey",
    "/pricing",
    "/contact",
    "/feedback",
    "/legal",
    "/privacy",
    "/terms",
    "/dpa",
    "/subprocessors",
    "/s",
    "/checkout",
  ],
};

/** Hostname of a configured URL, or "" — the port is not part of the match. */
function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Read at call time, not at import, so tests can stub the environment. */
function configured(): Record<Surface, { host: string; origin: string }> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const raya = process.env.NEXT_PUBLIC_RAYA_URL;
  const schools = process.env.NEXT_PUBLIC_SCHOOLS_URL;
  return {
    site: { host: hostOf(site), origin: originOf(site) },
    raya: { host: hostOf(raya), origin: originOf(raya) },
    schools: { host: hostOf(schools), origin: originOf(schools) },
  };
}

/** `/s` owns `/s` and `/s/abc`, never `/survey`. */
function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function ownerOf(pathname: string): Surface | null {
  for (const surface of ["raya", "schools", "site"] as const) {
    if (OWNED[surface].some((prefix) => under(pathname, prefix))) return surface;
  }
  return null;
}

/**
 * The absolute URL this request belongs at, or null to serve it where it is.
 *
 * Null unless ALL of these hold, which is what keeps it from ever looping:
 *  - the request's host is one of the configured origins. Local dev, preview
 *    deploys and any unknown host are never redirected, even with production
 *    URLs in the environment;
 *  - the path has an owner, and that owner's origin is configured;
 *  - the owner's host is not the host the request is already on. A product
 *    variable still pointing at the site means that product has not moved.
 */
export function crossOriginTarget(req: { host: string | null; pathname: string; search: string }): string | null {
  const host = (req.host ?? "").split(":")[0].toLowerCase();
  if (!host) return null;

  const origins = configured();
  const known = (Object.keys(origins) as Surface[]).some((s) => origins[s].host === host);
  if (!known) return null;

  const owner = ownerOf(req.pathname);
  if (!owner) return null;

  const target = origins[owner];
  if (!target.origin || target.host === host) return null;

  return `${target.origin}${req.pathname}${req.search}`;
}

/**
 * Where "back to the site" points from the origin a page is on.
 *
 * `/` cannot say it on a product origin: there it is that product's home, so a
 * "Back to site" link on schools.…/login went to /school, which sent a signed-out
 * visitor straight back to /login. From a product origin the landing page is
 * the site's own `/`, absolute. Everywhere else — the site itself, local dev, a
 * preview — `/` is right.
 */
export function siteHomeFrom(currentHost: string | null): string {
  const host = (currentHost ?? "").split(":")[0].toLowerCase();
  const origins = configured();
  if (!host || !origins.site.origin || host === origins.site.host) return "/";
  if (host !== origins.raya.host && host !== origins.schools.host) return "/";
  return `${origins.site.origin}/`;
}

/**
 * Permanent only for the moves that existed before the split — the apex's
 * /chat and /school — because links to those are already in the wild. The rest
 * are new, and a browser caches a 308 past the point a fix could reach it.
 */
export function isPermanentMove(fromHost: string | null, target: string): boolean {
  const host = (fromHost ?? "").split(":")[0].toLowerCase();
  const origins = configured();
  if (host !== origins.site.host) return false;
  try {
    const to = new URL(target).hostname;
    return to === origins.raya.host || to === origins.schools.host;
  } catch {
    return false;
  }
}
