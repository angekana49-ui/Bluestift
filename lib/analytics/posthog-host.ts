/**
 * Where PostHog lives, in one place — read by the browser SDK, the server
 * client and the `/ingest` relay (app/ingest/[...path]/route.ts).
 *
 * WHY US. The project is on PostHog's US cloud. Until September 2026 every
 * reader here defaulted to the EU host instead, while production carried the
 * US project's key: the EU cluster answered each event with a 401, silently,
 * and PostHog received nothing from launch onward. A key is only valid on the
 * cluster that issued it, so the default must name the cluster the key came
 * from. Moving the project means changing this AND the PostHog row on the
 * sub-processors page (components/site/pages/SubprocessorsView.tsx).
 */

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * The same-origin path the browser SDK sends to, relayed to PostHog. Events
 * leave from our own origin: a content blocker that drops every request to
 * `*.posthog.com` lets this through, and the CSP no longer names a third party.
 */
export const POSTHOG_INGEST_PATH = "/ingest";

function normalise(url: string | undefined): string {
  const value = url?.trim();
  if (!value) return DEFAULT_HOST;
  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_HOST;
  }
}

const CLOUD = /^https:\/\/(eu|us)\.i\.posthog\.com$/;

/** Ingestion origin (`https://us.i.posthog.com`). */
export function posthogHost(env: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_HOST): string {
  return normalise(env);
}

/**
 * Origin of the SDK's lazily-loaded scripts and remote config. PostHog Cloud
 * serves them from a separate `*-assets` host; a self-hosted instance serves
 * everything from one.
 */
export function posthogAssetsHost(env?: string): string {
  return posthogHost(env).replace(CLOUD, "https://$1-assets.i.posthog.com");
}

/**
 * The dashboard origin. The SDK uses it for links back into PostHog, which
 * must not point at the relayed path.
 */
export function posthogUiHost(env?: string): string {
  return posthogHost(env).replace(CLOUD, "https://$1.posthog.com");
}

/**
 * The upstream URL for a request to `/ingest/<segments>`, or null for one the
 * relay should refuse.
 *
 * Every segment is re-encoded before it is joined, so nothing in the path —
 * `..`, an encoded slash, `//other.host` — can move the request off PostHog.
 * `static/` and `array/` are assets; everything else is ingestion.
 */
export function posthogUpstream(
  segments: string[],
  opts: { trailingSlash: boolean; search: string },
  env?: string,
): URL | null {
  if (segments.length === 0 || segments.some((s) => !s || s === "." || s === "..")) return null;
  const origin = segments[0] === "static" || segments[0] === "array" ? posthogAssetsHost(env) : posthogHost(env);
  const path = "/" + segments.map(encodeURIComponent).join("/") + (opts.trailingSlash ? "/" : "");
  const url = new URL(path, origin);
  if (url.origin !== origin) return null;
  url.search = opts.search;
  return url;
}
