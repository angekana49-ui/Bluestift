import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Relative, not the "@/" alias: this file is evaluated by Node before the
// tsconfig paths are in play.
import { SCHOOL_TABS } from "./lib/school-tabs";

// Pin the workspace root so Turbopack doesn't infer a parent directory
// (which caused "couldn't find next/package.json" + panics).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hostname of a configured URL, or "" if unset/invalid — for the `has` host
 * conditions below.
 *
 * `.hostname`, not `.host`: Next matches a `{ type: "host" }` condition against
 * the request's hostname with the port already stripped, so a configured URL
 * carrying one (`http://localhost:3101`, any preview served on a port) produced
 * a value that could never match anything. Silently — a host condition that
 * matches nothing does not warn, the rule simply never fires. Production hosts
 * have no port, so this was invisible there and only ever bit locally, which is
 * exactly where the rules get verified.
 */
function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * The Content-Security-Policy is NOT here any more, and that is the point.
 *
 * This file is evaluated once, at build time. A policy written here can only
 * contain constants — which is why the old one had to allow `'unsafe-inline'`
 * for scripts: there is no way to put a per-request nonce in a value computed
 * before any request exists.
 *
 * It now lives in `proxy.ts`, built per request around a fresh nonce, with
 * `lib/security/csp.ts` holding the shape. The headers below stayed because
 * every one of them IS a constant.
 */

/**
 * Paths each product origin owns, once the split happens (docs/domains.md).
 * Everything not listed — the marketing pages, /research, /survey, /s, the
 * checkout pages — belongs to the site and stays on the apex.
 */
const PRODUCT_PATHS = {
  raya: ["/chat", "/rooms", "/assignments", "/tools", "/profile"],
  schools: ["/school"],
};

/**
 * 308s from the apex to the product origins.
 *
 * They exist so links already in the wild — a shared /chat URL, a "Review
 * requests" email sent before the split, an installed home-screen icon — keep
 * working forever rather than for a migration window.
 *
 * Two guards keep this inert until it should fire:
 *
 *  - a rule is only emitted when its product origin is CONFIGURED, so the
 *    redirects switch on in the same act that creates the destination. Today,
 *    with the vars unset, `redirects()` returns nothing at all.
 *  - every rule is conditioned on the apex host. Without that, a request to
 *    raya.thebluestift.com/chat would match `/chat` and be redirected to
 *    raya.thebluestift.com/chat — a redirect loop, served to the product's own
 *    users, on the day of the migration.
 *
 * Each prefix needs two rules because `/chat/:path*` does not match a bare
 * `/chat`; `:path*` requires the segment separator in front of it.
 */
/** Origin of a configured URL, or "" so an unset env var adds nothing. */
function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function productRedirects() {
  const apex = hostOf(process.env.NEXT_PUBLIC_SITE_URL);
  if (!apex) return [];

  const targets = [
    { origin: originOf(process.env.NEXT_PUBLIC_RAYA_URL), paths: PRODUCT_PATHS.raya },
    { origin: originOf(process.env.NEXT_PUBLIC_SCHOOLS_URL), paths: PRODUCT_PATHS.schools },
  ];

  return targets.flatMap(({ origin, paths }) =>
    // An origin equal to the apex means the product has not moved yet; a rule
    // would send the apex to itself.
    !origin || hostOf(origin) === apex
      ? []
      : paths.flatMap((path) => [
          {
            source: path,
            destination: `${origin}${path}`,
            permanent: true,
            has: [{ type: "host" as const, value: apex }],
          },
          {
            source: `${path}/:rest*`,
            destination: `${origin}${path}/:rest*`,
            permanent: true,
            has: [{ type: "host" as const, value: apex }],
          },
        ]),
  );
}

/**
 * The bare root of a product origin, sent to that product's own home instead
 * of falling through to `/` — which is the marketing landing page on EVERY
 * origin, because it's the same deployment answering all of them. Found live:
 * schools.thebluestift.com/ was serving the landing page instead of Schools,
 * while schools.thebluestift.com/school worked fine (it bounces an
 * unauthenticated visitor to /login itself, same as it does on the apex) —
 * nothing was wrong with the app, there was just no rule sending the bare
 * root anywhere product-specific. Someone who types raya.thebluestift.com or
 * schools.thebluestift.com directly — a bookmark, a returning visitor, a
 * guess — should land in that product (which itself decides login vs. home),
 * not read a pitch for it.
 *
 * NOT permanent: this is a per-origin UX default that could reasonably change
 * later, not a canonical content move like productRedirects() above — and a
 * permanent (308) redirect here would get cached by the browser past the
 * point a fix could reach it.
 */
function productHomeRedirects() {
  const targets = [
    { host: hostOf(process.env.NEXT_PUBLIC_RAYA_URL), destination: "/chat" },
    { host: hostOf(process.env.NEXT_PUBLIC_SCHOOLS_URL), destination: "/school" },
  ];
  return targets
    .filter(({ host }) => !!host)
    .map(({ host, destination }) => ({
      source: "/",
      destination,
      permanent: false,
      has: [{ type: "host" as const, value: host }],
    }));
}

/**
 * Next streams metadata by default: the initial response can go out before
 * `generateMetadata` resolves, with the resolved `<head>` tags patched in once
 * it does. Fine for a browser, which keeps reading; not fine for a crawler
 * that does one plain fetch and never sees the patch — it gets a `<head>`
 * with no title, no description, no OG tags.
 *
 * Next's own default list of bots that get a blocking (non-streamed) render
 * already covers the classic link-preview crawlers (Slackbot, Twitterbot,
 * Googlebot's variants, ...) — see html-bots.ts in the Next source. It does
 * NOT cover the crawlers behind AI answer engines, because that default
 * predates them. Setting this option REPLACES that list rather than adding to
 * it, so it starts as a copy of Next's default, plus the ones an AEO push
 * specifically cares about: OpenAI (GPTBot for training, OAI-SearchBot for
 * ChatGPT search, ChatGPT-User for a live fetch during a chat), Anthropic
 * (ClaudeBot, Claude-User, Claude-SearchBot, and the older anthropic-ai UA),
 * Perplexity (PerplexityBot, Perplexity-User), Common Crawl (CCBot — what a
 * lot of smaller models train on), and Meta's, Amazon's, ByteDance's and
 * DuckDuckGo's answer/training crawlers. Google's own AI crawler
 * (Google-Extended) already matches the `Google-[\w-]+` half of the default.
 */
const AI_ANSWER_ENGINE_BOTS =
  "GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Meta-ExternalAgent|Meta-ExternalFetcher|Amazonbot|Bytespider|DuckAssistBot";
const HTML_LIMITED_BOTS = new RegExp(
  `[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|${AI_ANSWER_ENGINE_BOTS}`,
  "i",
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: rootDir },
  // Keep native doc parsers out of the bundle (run as Node modules at runtime).
  serverExternalPackages: ["mammoth", "xlsx"],
  htmlLimitedBots: HTML_LIMITED_BOTS,
  /**
   * The Schools dashboard's tabs, as addresses (lib/school-tabs.ts).
   *
   * A rewrite, not a redirect: the point is that the address bar KEEPS saying
   * /billing while the page served is the dashboard. Host-conditioned, so these
   * twelve very generic words are Schools addresses and nothing at all on the
   * apex or on Raya — and emitted only once the Schools origin is configured,
   * the same guard the redirects use.
   *
   * Returned as a plain array, i.e. `afterFiles`: filesystem routes win, so a
   * real page added at one of these paths later would shadow the rewrite rather
   * than be shadowed by it.
   */
  async rewrites() {
    const host = hostOf(process.env.NEXT_PUBLIC_SCHOOLS_URL);
    if (!host) return [];
    return SCHOOL_TABS.map((tab) => ({
      source: `/${tab}`,
      destination: `/school?tab=${tab}`,
      has: [{ type: "host" as const, value: host }],
    }));
  },
  async redirects() {
    return [
      // /homework became /assignments. Permanent, and unconditional: unlike the
      // product-origin rules below this is a rename inside one app, so there is
      // no host to condition on and no loop to avoid. It stays because links to
      // it are already in the wild — a student's bookmark, an installed PWA
      // shortcut — and those outlive the rename.
      { source: "/homework", destination: "/assignments", permanent: true },
      { source: "/homework/:rest*", destination: "/assignments/:rest*", permanent: true },
      ...(await productRedirects()),
      ...productHomeRedirects(),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        /*
         * The three files that describe the site to something that is not a
         * person — a crawler, an install prompt, an app switcher — must never
         * be served from a cache older than the deploy.
         *
         * They had no cache policy at all, which means each layer in front of
         * them (CDN, browser, the OS's own PWA store) picked its own, and the
         * generous ones win: an installed app can keep showing the name and
         * icon from the manifest it was installed with long after both
         * changed, and a crawler can re-read a sitemap it already has instead
         * of noticing the new one. Neither ever surfaces as an error — it
         * surfaces as "why is the old version still there".
         *
         * `must-revalidate` with a short window is the right trade: these are
         * tiny files, and being one hour stale is the worst case rather than
         * the indefinite one.
         */
        source: "/:file(manifest.webmanifest|sitemap.xml|robots.txt)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, must-revalidate",
          },
        ],
      },
      {
        // Raya's manifest is a route handler rather than a file convention,
        // so it needs the rule spelled out separately — same reasoning.
        source: "/raya-manifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
