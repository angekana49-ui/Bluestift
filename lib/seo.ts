/**
 * Shared constants for everything under app/robots.ts, app/sitemap.ts,
 * app/layout.tsx's metadata and JSON-LD, and the opengraph-image/twitter-image
 * routes — one place so the site's name, description and canonical origin
 * can't drift apart between them.
 *
 * SITE_URL falls back to production rather than localhost: metadata (OG image
 * URLs, canonical links, the sitemap) still needs to resolve to something
 * absolute wherever NEXT_PUBLIC_SITE_URL is unset — a preview deploy, say —
 * and a stray localhost URL baked into a search index is a worse failure mode
 * than pointing at prod too early.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thebluestift.com").replace(
  /\/$/,
  "",
);

export const SITE_NAME = "Bluestift";

export const SITE_DESCRIPTION =
  "Bluestift is two products on one account: Raya, a Socratic AI tutor that teaches by asking instead of answering, and Bluestift Schools, the staff dashboard that shows teachers where a class is stuck without reading anyone's conversations.";

/**
 * Routes meant to be crawled and cited — the marketing site, not the product.
 * Kept as one list so app/robots.ts (what may be crawled) and app/sitemap.ts
 * (what's worth crawling) can't quietly disagree about what's public.
 *
 * changeFrequency/priority are the sitemap's hints, not a promise a crawler
 * honours — kept modest and roughly true rather than tuned for effect.
 */
export const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/research", changeFrequency: "daily", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/feedback", changeFrequency: "yearly", priority: 0.3 },
  { path: "/survey", changeFrequency: "monthly", priority: 0.4 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/dpa", changeFrequency: "yearly", priority: 0.2 },
  { path: "/subprocessors", changeFrequency: "monthly", priority: 0.2 },
];

/**
 * Everything else: the products themselves (login-gated, no content a visitor
 * without an account could see anyway), account/auth flow, checkout
 * (transactional, not content), and share links (unlisted by design — a
 * token in the URL is the access control, so it must not end up in a search
 * index). `/api` is data, never a page.
 */
export const DISALLOWED_PREFIXES = [
  "/api",
  "/chat",
  "/rooms",
  "/assignments",
  "/tools",
  "/profile",
  "/school",
  "/account",
  "/onboarding",
  "/login",
  "/checkout",
  // The trailing slash matters: share links live at /s/<token>, but a bare
  // "/s" prefix-matches "/survey" and "/subprocessors" too (robots.txt
  // disallow is a plain string prefix, not a path-segment match) — which
  // would silently deindex two pages this same file lists as public.
  "/s/",
  "/ops",
];

/** Organization JSON-LD — who's publishing this site. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/bluestift-mark.png`,
    description: SITE_DESCRIPTION,
  };
}

/** WebSite JSON-LD — the site itself, as distinct from the org behind it. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
  };
}
