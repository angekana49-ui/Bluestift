/**
 * The one place a server-side failure gets reported.
 *
 * Deliberately isomorphic (no `server-only`): `instrumentation.ts` loads this
 * in BOTH the Node.js and the Edge runtime, and neither can import a
 * server-only module the way an RSC does.
 *
 * Two outputs, and the order matters:
 *
 *  1. ALWAYS a single-line JSON record on stderr, prefixed `[bluestift.error]`.
 *     One failure = one log line = one thing a log drain can match on. This
 *     output has no configuration and no dependency, so it is the one that
 *     still works when everything else is down — including the database and
 *     the webhook below.
 *
 *  2. OPTIONALLY a POST of the same record to `ERROR_WEBHOOK_URL` (a Slack /
 *     Discord / Sentry-tunnel / whatever endpoint). Unset = no POST, and the
 *     module is otherwise unchanged: reporting must never depend on setup that
 *     hasn't happened yet.
 *
 * Two hard rules for everything in this file:
 *  - it never throws (a reporter that breaks the request it reports on is
 *    worse than no reporter), and
 *  - it never blocks for long (the webhook is bounded by a short timeout).
 */

export type Severity = "error" | "warning";

export type Requestish = {
  method?: string;
  /**
   * The route PATTERN (`/s/[token]`), never a concrete path: a real path can
   * carry a capability or an identifier, and the pattern debugs just as well.
   */
  route?: string;
  /** `render` | `route` | `action` | `proxy` — where Next.js was when it threw. */
  type?: string;
};

export type IssueInput = {
  /** Dotted area, e.g. `billing.webhook`. Groups alerts; keep the set small. */
  scope: string;
  message: string;
  /** `error` pages someone; `warning` is for "expected sometimes, never fine in bulk". */
  severity?: Severity;
  name?: string;
  /** React's error digest, when the failure came through a render. */
  digest?: string;
  stack?: string;
  request?: Requestish;
  /** Small, non-secret facts that make the record actionable (ids, provider). */
  tags?: Record<string, string | number | boolean | null | undefined>;
};

export type IssueRecord = {
  ts: string;
  severity: Severity;
  scope: string;
  name: string;
  message: string;
  fingerprint: string;
  env: string;
  runtime: string;
  release?: string;
  digest?: string;
  stack?: string;
  request?: Requestish;
  tags?: Record<string, string | number | boolean>;
  /** Occurrences of this fingerprint dropped since the last delivered one. */
  suppressed?: number;
};

/** Matched by whatever consumes the logs — keep it stable. */
export const LOG_PREFIX = "[bluestift.error]";

const WEBHOOK_TIMEOUT_MS = 2500;
const MESSAGE_MAX = 500;
const STACK_MAX = 2000;

// ---- Redaction -------------------------------------------------------------
// An error message is written by whoever threw it, so it can contain anything
// that was in scope: an address, a key, a session token. These records leave
// the process (to a log drain, maybe to a third-party webhook), so the message
// is scrubbed on the way out. UUIDs are deliberately KEPT — a payment id is
// what makes a money-path record actionable, and on its own it identifies
// nobody outside our database.

const UUID_SRC = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_G = new RegExp(UUID_SRC, "gi");
const UUID_EXACT = new RegExp(`^${UUID_SRC}$`, "i");

export function redact(text: string): string {
  return text
    .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g, "<jwt>")
    .replace(
      /\b(bearer|authorization|token|api[_-]?key|secret|password|passwd|pwd)\b([=:\s"']+)[^\s"',;}]+/gi,
      "$1$2<redacted>",
    )
    .replace(/[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, (m) => (UUID_EXACT.test(m) ? m : "<redacted>"));
}

/**
 * A stable key for "the same failure again", so alerting can group and
 * de-duplicate. Every varying part of the message is normalized away: ids,
 * hashes and numbers change per occurrence and would otherwise make each one
 * look new.
 */
export function fingerprint(scope: string, name: string, message: string): string {
  const shape = message
    .replace(UUID_G, "<id>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return `${scope}|${name}|${shape}`;
}

// ---- Flood control ---------------------------------------------------------
// A failure in a hot path fires once per request. The log line is cheap and
// stays complete; the webhook is not, so it gets at most MAX_PER_WINDOW
// deliveries per fingerprint per window, and the next delivered record says
// how many it stands for. Per-instance by nature (serverless has no shared
// memory) — that is fine, the point is bounding a runaway loop, not exact counts.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_TRACKED = 500;

type Slot = { start: number; sent: number; suppressed: number };
const slots = new Map<string, Slot>();

function takeSlot(key: string, now: number): { deliver: boolean; suppressed: number } {
  // Cheap eviction: a process seeing 500 distinct failure shapes is already in
  // trouble, and dropping the table only costs us one window of counts.
  if (slots.size > MAX_TRACKED) slots.clear();

  const slot = slots.get(key);
  if (!slot || now - slot.start >= WINDOW_MS) {
    slots.set(key, { start: now, sent: 1, suppressed: 0 });
    return { deliver: true, suppressed: slot ? slot.suppressed : 0 };
  }
  if (slot.sent < MAX_PER_WINDOW) {
    slot.sent += 1;
    const carried = slot.suppressed;
    slot.suppressed = 0;
    return { deliver: true, suppressed: carried };
  }
  slot.suppressed += 1;
  return { deliver: false, suppressed: slot.suppressed };
}

// ---- Building and emitting -------------------------------------------------

/** Narrow an `unknown` catch value into the fields we report. */
export function describeError(err: unknown): { name: string; message: string; digest?: string; stack?: string } {
  if (err instanceof Error) {
    const digest = "digest" in err && err.digest != null ? String(err.digest) : undefined;
    return { name: err.name || "Error", message: err.message || String(err), digest, stack: err.stack };
  }
  if (err && typeof err === "object") {
    const o = err as { name?: unknown; message?: unknown; digest?: unknown };
    return {
      name: typeof o.name === "string" ? o.name : "NonError",
      message: typeof o.message === "string" ? o.message : safeStringify(err),
      digest: o.digest == null ? undefined : String(o.digest),
    };
  }
  return { name: "NonError", message: String(err) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function cleanTags(tags: IssueInput["tags"]): Record<string, string | number | boolean> | undefined {
  if (!tags) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === "string" ? redact(v).slice(0, 200) : v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildRecord(input: IssueInput, now: number): IssueRecord {
  const name = input.name ?? "Error";
  const message = redact(input.message).slice(0, MESSAGE_MAX);
  return {
    ts: new Date(now).toISOString(),
    severity: input.severity ?? "error",
    scope: input.scope,
    name,
    message,
    fingerprint: fingerprint(input.scope, name, input.message),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    runtime: process.env.NEXT_RUNTIME ?? "node",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    digest: input.digest,
    stack: input.stack ? redact(input.stack).slice(0, STACK_MAX) : undefined,
    request: input.request,
    tags: cleanTags(input.tags),
  };
}

async function deliver(record: IssueRecord): Promise<void> {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // The console line above is the durable record; a webhook that is down
    // must not turn one failure into two.
  }
}

/**
 * Report a failure that did not arrive as a thrown value — a call that
 * returned `{ ok: false }`, a reconciliation that found nothing to reconcile.
 * These are the ones that otherwise disappear.
 */
export async function reportIssue(input: IssueInput): Promise<void> {
  try {
    const now = Date.now();
    const record = buildRecord(input, now);
    const gate = takeSlot(record.fingerprint, now);
    if (gate.suppressed > 0) record.suppressed = gate.suppressed;

    // Logged unconditionally: the drain must see every occurrence, including
    // the ones the webhook is throttling.
    console.error(LOG_PREFIX, JSON.stringify(record));

    if (gate.deliver) await deliver(record);
  } catch {
    // Reporting is the last thing that may break a request.
  }
}

/** Report a thrown value. `scope` groups it; `extra` adds request context and tags. */
export async function reportError(
  scope: string,
  err: unknown,
  extra?: Pick<IssueInput, "severity" | "request" | "tags">,
): Promise<void> {
  const described = describeError(err);
  await reportIssue({ scope, ...described, ...extra });
}
