import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root so Turbopack doesn't infer a parent directory
// (which caused "couldn't find next/package.json" + panics).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== "production";

/** Origin of a configured URL, or "" so an unset env var adds nothing. */
function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const SUPABASE = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const POSTHOG = originOf(process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com");
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy.
 *
 * The previous policy only carried the four framing/injection directives, so
 * there was no `default-src` and therefore nothing at all stopping the page from
 * pulling a script off an arbitrary host.
 *
 * `script-src` keeps `'unsafe-inline'` because Next.js inlines its bootstrap and
 * flight payloads on every page — removing it needs per-request nonces through
 * the proxy, which is a separate job. That does NOT make the directive pointless:
 * `'unsafe-inline'` permits inline code, it does not permit REMOTE code, so
 * `<script src="https://evil/">` is still refused. Same reasoning for `style-src`,
 * where every component styles through the `style` attribute.
 *
 * Third-party origins are derived from the same env vars the app itself reads,
 * so a change of Supabase project or PostHog region can't silently desync the
 * policy from reality.
 *
 * `img-src https:` is deliberately broad — avatars, school logos and shared docs
 * come from signed storage URLs, and a too-tight image rule fails as a blank
 * avatar that nobody reports. It still forbids plaintext `http:`.
 */
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is a dev-only need (Turbopack/React Refresh); never in prod.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE} ${POSTHOG}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // next/font/google self-hosts at build time, so no external font origin.
  "font-src 'self' data:",
  // wss: for Supabase Realtime; ws: for the dev HMR socket.
  `connect-src 'self' ${SUPABASE} ${SUPABASE.replace(/^https:/, "wss:")} ${POSTHOG}${isDev ? " ws: http://localhost:*" : ""}`,
  // The Turnstile widget renders in an iframe.
  `frame-src ${TURNSTILE}`,
  // Voice notes are recorded to a blob before upload.
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: rootDir },
  // Keep native doc parsers out of the bundle (run as Node modules at runtime).
  serverExternalPackages: ["mammoth", "xlsx"],
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
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
