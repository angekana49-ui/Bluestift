import "server-only";
import { kernel } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/net/timeout";
import { reportError } from "@/lib/observability/report";
import { sanitizeConceptLabel } from "./signals";
import type { AnalyzeResponse, KernelAlert, LoadProfileResponse } from "./types";

/**
 * Non-blocking learner-profile cache, two layers deep:
 *
 *  - L1: per-instance Map — instant, but on Vercel serverless it is almost
 *    always cold (each request may land on a fresh instance).
 *  - L2: learning.kernel_profile_snapshots — durable, service-role only,
 *    written on every Kernel refresh, so a WARM profile survives cold starts
 *    and Raya keeps her cognitive context on ~every turn.
 *
 * The chat hot path still must NOT wait on the Kernel: reads return whatever
 * is cached within a hard 250ms budget (L2 is one primary-key select) and
 * refresh from the Kernel in the background. First-ever turn returns null.
 */
type Entry = { profile: LoadProfileResponse | null; at: number; refreshing: boolean };
const cache = new Map<string, Entry>();
const L2_READ_BUDGET_MS = 250;

/**
 * How long a cached profile may sit before a read is worth waking the Kernel.
 *
 * Deliberately long. The profile changes when the Kernel commits evidence, and
 * both places that cause that — the post-conversation analyse and a graded
 * submission — call invalidateProfile() directly, which refreshes immediately.
 * What this bound covers is the one thing no event announces: K_effective
 * decaying as a student forgets, which moves over days, not minutes.
 */
const STALE_REFRESH_MS = 6 * 60 * 60_000;

/** Backoff before retrying a profile we have never managed to fetch. */
const EMPTY_RETRY_MS = 10 * 60_000;

// Latest pedagogical-safety alerts from the most recent /analyze, per user.
const alertsCache = new Map<string, { alerts: KernelAlert[]; at: number }>();

/**
 * The cross-concept half of /analyze: the root cause the Kernel walked to, and
 * the order it wants the concepts taught in. `/load_profile` cannot supply this
 * — it returns per-concept state, not the chain between concepts — so it has to
 * ride along from the last analysis or be lost, which is what used to happen:
 * the route kept `alerts` and dropped `root_gap` on the floor.
 */
export type LatestAnalysis = {
  root_gap: string | null;
  detection_path: string[];
  recommended_path: string[];
  confidence: number | null;
  at: number;
};

/** A root cause older than this describes a session that has moved on. */
const ANALYSIS_TTL_MS = 30 * 60_000;

const analysisCache = new Map<string, LatestAnalysis>();

type SnapshotRow = {
  profile: LoadProfileResponse | null;
  alerts: KernelAlert[] | null;
  latest_analysis: LatestAnalysis | null;
  profile_updated_at: string | null;
  alerts_updated_at: string | null;
};

/**
 * Single cast point for a table newer than the generated Database types
 * (same pattern as adminRpc in lib/supabase/admin.ts). Re-running gen:types
 * would let this narrow back to the typed client.
 */
function snapshots() {
  const client = createAdminClient() as unknown as {
    schema: (s: "learning") => {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: "user_id",
            v: string,
          ) => {
            maybeSingle: () => Promise<{
              data: SnapshotRow | null;
              error: { message: string } | null;
            }>;
          };
        };
        upsert: (
          row: Partial<SnapshotRow> & { user_id: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  return client.schema("learning").from("kernel_profile_snapshots");
}

export type CognitiveContext = {
  profile: LoadProfileResponse | null;
  alerts: KernelAlert[];
  /** null when there has been no analysis, or it is older than the TTL. */
  analysis: LatestAnalysis | null;
};

/**
 * Profile + alerts for a chat turn, bounded to L2_READ_BUDGET_MS total.
 * Never throws, never blocks on the Kernel. Await it INSIDE the route's
 * parallel context wave, not as its own serial hop.
 */
export async function getCognitiveContext(userId: string): Promise<CognitiveContext> {
  const now = Date.now();
  const l1 = cache.get(userId);
  const l1Alerts = alertsCache.get(userId);

  let profile = l1?.profile ?? null;
  let alerts = l1Alerts?.alerts ?? null;
  let analysis = analysisCache.get(userId) ?? null;

  // L1 miss on any part → one bounded snapshot read fills all three.
  if ((!l1 || !l1Alerts || !analysis) && (profile === null || alerts === null || analysis === null)) {
    const row = await withTimeout(
      (async () => {
        const { data } = await snapshots()
          .select("profile, alerts, latest_analysis, profile_updated_at, alerts_updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        return data;
      })().catch(() => null),
      L2_READ_BUDGET_MS,
      null,
    );
    if (row) {
      if (!l1 && row.profile) {
        profile = row.profile;
        const at = row.profile_updated_at ? Date.parse(row.profile_updated_at) : 0;
        cache.set(userId, { profile, at, refreshing: false });
      }
      if (!l1Alerts && row.alerts) {
        alerts = row.alerts;
        alertsCache.set(userId, { alerts: row.alerts, at: now });
      }
      if (!analysis && row.latest_analysis) {
        analysis = row.latest_analysis;
        analysisCache.set(userId, row.latest_analysis);
      }
    }
  }

  // Expiry is applied on read, not on write: a stale row is harmless in the
  // table and this keeps the one clock that matters in one place.
  if (analysis && now - analysis.at > ANALYSIS_TTL_MS) analysis = null;

  if (shouldRefresh(cache.get(userId), now)) void refresh(userId);
  return { profile, alerts: alerts ?? [], analysis };
}

/** Mark the cached profile stale and refresh it from the Kernel right away. */
export function invalidateProfile(userId: string): void {
  const entry = cache.get(userId);
  if (entry) cache.set(userId, { ...entry, at: 0 });
  void refresh(userId);
}

/**
 * Store everything the last /analyze produced — L1 now, L2 fire-and-forget.
 *
 * Replaces `setLatestAlerts`, which kept `alerts` and discarded the rest of the
 * response. `root_gap` and `recommended_path` are the Kernel's cross-concept
 * reasoning; nothing else in the app can reconstruct them.
 */
export function setLatestAnalysis(userId: string, res: AnalyzeResponse): void {
  const alerts = res.alerts ?? [];
  const analysis: LatestAnalysis = {
    // Kernel-authored, but built from student conversations — sanitised here so
    // no caller can forget to, since these end up inside a system prompt.
    root_gap: res.root_gap ? sanitizeConceptLabel(res.root_gap) : null,
    detection_path: (res.detection_path ?? []).slice(0, 8).map(sanitizeConceptLabel).filter(Boolean),
    recommended_path: (res.recommended_path ?? []).slice(0, 8).map(sanitizeConceptLabel).filter(Boolean),
    confidence: typeof res.confidence === "number" ? res.confidence : null,
    at: Date.now(),
  };

  alertsCache.set(userId, { alerts, at: Date.now() });
  analysisCache.set(userId, analysis);

  void (async () => {
    try {
      await snapshots().upsert({
        user_id: userId,
        alerts,
        latest_analysis: analysis,
        alerts_updated_at: new Date().toISOString(),
      });
    } catch {
      // best-effort
    }
  })();
}

/**
 * Whether a background refresh is worth waking the Kernel for.
 *
 * This gate used to be "is the in-process L1 cold?", which on Vercel is true on
 * nearly every request — so an ordinary chat message woke a sleeping Kernel
 * container purely to warm a cache. Worse, the client's 6s budget is shorter
 * than a Python cold start, so the call that woke the container usually timed
 * out before it returned anything: the wake was billed and the cache stayed
 * stale. The Kernel should run when an upper layer needs an answer, not
 * because a serverless instance happened to be new.
 */
function shouldRefresh(entry: Entry | undefined, now: number): boolean {
  if (entry?.refreshing) return false;
  // Nothing cached at all: RAYA would run with no cognitive context, so one
  // call is worth it. The entry timestamp doubles as the backoff clock, so a
  // Kernel that is down — or simply has nothing for a brand-new student — is
  // not retried on every turn.
  if (!entry || entry.profile === null) {
    return !entry || now - entry.at > EMPTY_RETRY_MS;
  }
  return now - entry.at > STALE_REFRESH_MS;
}

async function refresh(userId: string): Promise<void> {
  const prev = cache.get(userId);
  if (prev?.refreshing) return;
  cache.set(userId, {
    profile: prev?.profile ?? null,
    at: prev?.at ?? 0,
    refreshing: true,
  });
  try {
    const profile = await kernel.loadProfile({ user_id: userId });
    cache.set(userId, { profile, at: Date.now(), refreshing: false });
    // Durable copy for the next cold instance (best-effort).
    try {
      await snapshots().upsert({
        user_id: userId,
        profile,
        profile_updated_at: new Date().toISOString(),
      });
    } catch {
      // the L1 write above already succeeded
    }
  } catch (e) {
    // Back off for a full TTL even on failure so we don't hammer a down Kernel.
    cache.set(userId, {
      profile: prev?.profile ?? null,
      at: Date.now(),
      refreshing: false,
    });
    // SAY SO. This catch used to be empty, and that silence is how a Kernel
    // that had been returning 404 for seventeen days went unnoticed: every
    // layer above degrades politely, so a dead Kernel and a brand-new student
    // produce the identical result — an empty profile and a tutor with no
    // cognitive context. Non-blocking on purpose (the chat turn must still go
    // through), but no longer invisible.
    void reportKernelDown("kernel.loadProfile", e);
  }
}

/**
 * One report per scope per window, because this fires on a per-user, per-turn
 * path: a Kernel outage during class would otherwise emit a line per student
 * per message. The window is what makes an outage one alert instead of a flood,
 * and short enough that a recovery followed by a relapse is still reported.
 */
const DOWN_REPORT_WINDOW_MS = 5 * 60_000;
const lastReported = new Map<string, number>();

export function reportKernelDown(scope: string, e: unknown): void {
  const now = Date.now();
  const last = lastReported.get(scope) ?? 0;
  if (now - last < DOWN_REPORT_WINDOW_MS) return;
  lastReported.set(scope, now);
  void reportError(scope, e, {
    // `warning`, not `error`: one failed call is genuinely expected sometimes
    // (a cold container, a dropped connection). What is never fine is a lot of
    // them, which is exactly what the rate limit above turns into a steady
    // drip rather than a spike.
    severity: "warning",
    tags: { dependency: "kernel" },
  });
}
