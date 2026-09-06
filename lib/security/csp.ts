/**
 * The Content-Security-Policy, built fresh for each request around a one-time
 * nonce.
 *
 * WHY IT MOVED HERE. The policy used to live in `next.config.ts`, which is
 * evaluated once at build time — and a nonce that is the same for every visitor
 * is not a nonce, it is a password an attacker reads out of the page. A policy
 * with a nonce in it can only be built where a request exists, so it is built
 * in the proxy and this module holds the shape.
 *
 * WHAT `'strict-dynamic'` BUYS. Without it, `script-src` is a list of allowed
 * ORIGINS, and any script anywhere on an allowed origin passes — an old file on
 * a CDN, a JSONP endpoint, anything. With it, the browser ignores the origin
 * list entirely and trusts exactly two things: a script carrying this request's
 * nonce, and a script loaded by one that did. So the question stops being
 * "where did this come from" and becomes "did our code ask for it".
 *
 * That is what makes Turnstile keep working, incidentally: the widget's script
 * is injected by our own bundle (components/turnstile.tsx), so it inherits
 * trust rather than needing a nonce we cannot give it. The Cloudflare and
 * PostHog origins stay in the list anyway, for browsers old enough to ignore
 * `'strict-dynamic'` — they fall back to origin matching, which is weaker but
 * is what those browsers were already getting.
 *
 * WHY STYLES STILL CARRY `'unsafe-inline'`, and why that is not an oversight.
 * A nonce applies to `<style>` ELEMENTS. It does nothing for `style="…"`
 * ATTRIBUTES, which CSP governs separately and which this codebase uses on
 * roughly a hundred components — the design system is built on them. Removing
 * it would not tighten anything a nonce covers; it would blank the interface.
 * The exposure that remains is CSS injection, which needs the same HTML-injection
 * foothold the script rules now deny, and buys far less when it lands.
 */

const TURNSTILE = "https://challenges.cloudflare.com";

/** Origin of a configured URL, or "" so an unset variable adds nothing. */
function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * A fresh nonce. 16 random bytes, base64 — well past guessing, and inside the
 * alphabet Next's own parser accepts when it reads the nonce back out of the
 * header (`^'nonce-([A-Za-z0-9+/_-]+={0,2})'$`).
 *
 * Web Crypto and `btoa` rather than `randomUUID` and `Buffer`, because the
 * proxy may run in either the Edge or the Node runtime and these two exist in
 * both. `Math.random` would be catastrophic here and is worth naming: a
 * predictable nonce is an allow-list of one that the attacker is on.
 */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * The policy for one request.
 *
 * `isDev` adds `'unsafe-eval'`, which React needs in development to rebuild
 * server stack traces in the browser, and the dev websocket to `connect-src`.
 * Neither is ever emitted in production.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const posthog = originOf(process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com");
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  return [
    "default-src 'self'",
    // 'self' and the two origins are the pre-'strict-dynamic' fallback; a
    // modern browser ignores all three and goes by the nonce alone.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE} ${posthog}`,
    // See the note above: this covers `style="…"`, which no nonce can.
    "style-src 'self' 'unsafe-inline'",
    // Deliberately broad: avatars, school logos and shared documents arrive as
    // signed storage URLs, and a too-tight image rule fails as a blank avatar
    // nobody reports. Plaintext http: is still refused.
    "img-src 'self' data: blob: https:",
    // next/font self-hosts at build time, so no external font origin.
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} ${posthog}${isDev ? " ws: http://localhost:*" : ""}`,
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
}
