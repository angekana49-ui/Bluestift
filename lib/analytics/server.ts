import "server-only";
import { CONSENT_COOKIE } from "@/lib/analytics/consent";

// Server-side product analytics (PostHog). Used for events that only exist on the
// server — most importantly the entitlement "monitor mode" signals: in monitor
// mode a gated action still succeeds, so the client can't see that a gate WOULD
// have blocked. Consent is honoured by reading the cookie the consent banner sets
// (opt-in): nothing is emitted unless the visitor granted consent. No-ops entirely
// when NEXT_PUBLIC_POSTHOG_KEY is unset, and never throws — telemetry must never
// affect a request.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

// posthog-node is imported lazily and only once analytics is configured, so the
// dependency never loads in tests or before setup. flushAt:1 sends each event
// promptly (best-effort on serverless — good enough for pre-launch telemetry).
type PostHogNode = {
  capture: (m: { distinctId: string; event: string; properties?: Record<string, unknown> }) => void;
};
let clientPromise: Promise<PostHogNode | null> | null = null;

async function getClient(): Promise<PostHogNode | null> {
  if (!KEY) return null;
  if (!clientPromise) {
    clientPromise = import("posthog-node")
      .then(({ PostHog }) => new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 }) as unknown as PostHogNode)
      .catch(() => null);
  }
  return clientPromise;
}

/** Has the current request's visitor granted analytics consent? Never throws. */
async function hasConsent(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return store.get(CONSENT_COOKIE)?.value === "granted";
  } catch {
    return false;
  }
}

/**
 * Emit a server-side event for `userId`. No-ops unless analytics is configured,
 * we have a user to attribute it to, AND consent was granted. Best-effort: call
 * as `void captureServer(...)` so it never blocks (or breaks) the request.
 */
export async function captureServer(
  userId: string | null | undefined,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!KEY || !userId) return;
    if (!(await hasConsent())) return;
    const client = await getClient();
    if (!client) return;
    client.capture({ distinctId: userId, event, properties });
  } catch {
    // swallow — analytics must not affect the request
  }
}
