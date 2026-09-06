import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root so Turbopack doesn't infer a parent directory
// (which caused "couldn't find next/package.json" + panics).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Host (with port, without scheme) of a configured URL, or "" if unset/invalid. */
function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: rootDir },
  // Keep native doc parsers out of the bundle (run as Node modules at runtime).
  serverExternalPackages: ["mammoth", "xlsx"],
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
    ];
  },
};

export default nextConfig;
