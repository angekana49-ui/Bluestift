import { POSTHOG_INGEST_PATH, posthogUpstream } from "@/lib/analytics/posthog-host";

/**
 * The analytics relay: `/ingest/*` on our origin → PostHog.
 *
 * WHY A HANDLER AND NOT A REWRITE. A `rewrites()` entry to an external URL is
 * the textbook setup, and it forwards the browser's request as it came — with
 * its cookies. Here that is the Supabase session (access AND refresh token,
 * scoped to every `.thebluestift.com` origin), which would be handed to the
 * analytics processor on every batch. This relays an allow-list instead:
 * nothing reaches PostHog that the SDK did not put in the body.
 *
 * What it forwards, and why each:
 *   - `content-type`, `content-encoding` — the SDK gzips batches; PostHog has
 *     to know how to read them.
 *   - `user-agent` — browser/OS/device on the event, as a direct call gave.
 *   - the client IP, as `x-forwarded-for` — PostHog's country on the event,
 *     which a direct call also gave. Without it every event would be located
 *     wherever this function happens to run.
 *
 * Only reached by visitors who accepted analytics: the SDK is not downloaded
 * before that (lib/analytics/posthog-lazy.ts). Excluded from the proxy's
 * matcher — no nonce, no session refresh, no cookie writes on the way out.
 */

const FORWARDED_REQUEST_HEADERS = ["content-type", "content-encoding", "user-agent"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag", "last-modified"];

/** A batch that has not reached PostHog in 10s is not going to. */
const UPSTREAM_TIMEOUT_MS = 10_000;

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip");
}

async function relay(request: Request, segments: string[]): Promise<Response> {
  const incoming = new URL(request.url);
  const upstream = posthogUpstream(segments, {
    trailingSlash: incoming.pathname.endsWith("/") && incoming.pathname !== `${POSTHOG_INGEST_PATH}/`,
    search: incoming.search,
  });
  if (!upstream) return new Response(null, { status: 404 });

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip = clientIp(request);
  if (ip) headers.set("x-forwarded-for", ip);

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Analytics is best-effort; the SDK retries a failed batch on its own.
    return new Response(null, { status: 502 });
  }

  // Rebuilt rather than passed through: `fetch` has already decoded the body,
  // so the upstream `content-encoding`/`content-length` would now be lies, and
  // nothing PostHog sets (a cookie, above all) belongs on our origin.
  const out = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Ctx) {
  return relay(request, (await params).path);
}

export async function POST(request: Request, { params }: Ctx) {
  return relay(request, (await params).path);
}
