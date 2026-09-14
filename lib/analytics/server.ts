import "server-only";
import { CONSENT_COOKIE } from "@/lib/analytics/consent";
import { optionalProcessingAllowed } from "@/lib/compliance/optional-processing";
import { posthogHost } from "@/lib/analytics/posthog-host";
import type { ProductEvent } from "@/lib/analytics/events";

// Server-side product analytics (PostHog). Used for events that only exist on the
// server — most importantly the entitlement "monitor mode" signals: in monitor
// mode a gated action still succeeds, so the client can't see that a gate WOULD
// have blocked. Consent is honoured by reading the cookie the consent banner sets
// (opt-in): nothing is emitted unless the visitor granted consent. No-ops entirely
// when NEXT_PUBLIC_POSTHOG_KEY is unset, and never throws — telemetry must never
// affect a request.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Straight to PostHog, not through /ingest: a server has no content blocker to
// get past, and a hop back through our own deployment would only add latency.
const HOST = posthogHost();

// posthog-node is imported lazily and only once analytics is configured, so the
// dependency never loads in tests or before setup. flushAt:1 queues each event to
// send immediately; the actual network delivery is drained via `flush()` inside an
// `after()` callback (see captureServer) so a frozen serverless function can't drop it.
type PostHogNode = {
  capture: (m: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
    timestamp?: Date;
  }) => void;
  flush: () => Promise<void>;
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
 *
 * `timestamp` is for an event that happened before we were allowed to record
 * it — see `signed_up` in app/api/account/age/route.ts. Default: now.
 */
export async function captureServer(
  userId: string | null | undefined,
  event: ProductEvent,
  properties?: Record<string, unknown>,
  options?: { timestamp?: Date },
): Promise<void> {
  try {
    if (!KEY || !userId) return;
    if (!(await hasConsent())) return;
    // Consent is necessary but not sufficient: a minor cannot validly give it,
    // so the age band overrides the cookie. Checked here rather than at each
    // call site so no future event can forget.
    if (!(await optionalProcessingAllowed(userId))) return;
    const client = await getClient();
    if (!client) return;
    client.capture({ distinctId: userId, event, properties, timestamp: options?.timestamp });
    // Drain the send AFTER the response is flushed to the user: `after()` keeps the
    // serverless function alive until the network delivery resolves, so events aren't
    // lost when the function would otherwise freeze. Outside a request scope (or on any
    // failure) we fall back silently — flushAt:1 already made a best-effort attempt.
    try {
      const { after } = await import("next/server");
      after(async () => {
        try {
          await client.flush();
        } catch {
          /* delivery is best-effort */
        }
      });
    } catch {
      /* not in a request scope — nothing more to do */
    }
  } catch {
    // swallow — analytics must not affect the request
  }
}
