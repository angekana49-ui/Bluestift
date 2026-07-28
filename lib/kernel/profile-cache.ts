import "server-only";
import { kernel } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/net/timeout";
import type { KernelAlert, LoadProfileResponse } from "./types";

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
const TTL_MS = 60_000;
const L2_TTL_MS = 5 * 60_000;
const L2_READ_BUDGET_MS = 250;

// Latest pedagogical-safety alerts from the most recent /analyze, per user.
const alertsCache = new Map<string, { alerts: KernelAlert[]; at: number }>();

type SnapshotRow = {
  profile: LoadProfileResponse | null;
  alerts: KernelAlert[] | null;
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
  let l1Fresh = l1 != null && now - l1.at <= TTL_MS;

  // L1 miss on either half → one bounded snapshot read fills both.
  if ((!l1 || !l1Alerts) && (profile === null || alerts === null)) {
    const row = await withTimeout(
      (async () => {
        const { data } = await snapshots()
          .select("profile, alerts, profile_updated_at, alerts_updated_at")
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
        l1Fresh = now - at <= L2_TTL_MS;
      }
      if (!l1Alerts && row.alerts) {
        alerts = row.alerts;
        alertsCache.set(userId, { alerts: row.alerts, at: now });
      }
    }
  }

  if (!l1Fresh) void refresh(userId);
  return { profile, alerts: alerts ?? [] };
}

/** Mark the cached profile stale and refresh it from the Kernel right away. */
export function invalidateProfile(userId: string): void {
  const entry = cache.get(userId);
  if (entry) cache.set(userId, { ...entry, at: 0 });
  void refresh(userId);
}

/** Store the latest /analyze alerts — L1 now, L2 fire-and-forget. */
export function setLatestAlerts(userId: string, alerts: KernelAlert[]): void {
  alertsCache.set(userId, { alerts: alerts ?? [], at: Date.now() });
  void (async () => {
    try {
      await snapshots().upsert({
        user_id: userId,
        alerts: alerts ?? [],
        alerts_updated_at: new Date().toISOString(),
      });
    } catch {
      // best-effort
    }
  })();
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
  } catch {
    // Back off for a full TTL even on failure so we don't hammer a down Kernel.
    cache.set(userId, {
      profile: prev?.profile ?? null,
      at: Date.now(),
      refreshing: false,
    });
  }
}
