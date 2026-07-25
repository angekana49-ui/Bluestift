import "server-only";
import { kernel } from "./client";
import type { KernelAlert, LoadProfileResponse } from "./types";

/**
 * Non-blocking learner-profile cache. The chat hot path must NOT await a Kernel
 * round-trip, so we return whatever is cached instantly and refresh in the
 * background when stale. First-ever turn returns null (Raya works without it);
 * the next turn has the profile.
 *
 * In-memory / per-instance — fine for dev and single-instance deploys. For
 * multi-instance serverless, back this with a KV/DB snapshot later.
 */
type Entry = { profile: LoadProfileResponse | null; at: number; refreshing: boolean };
const cache = new Map<string, Entry>();
const TTL_MS = 60_000;

export function getCachedProfile(userId: string): LoadProfileResponse | null {
  const entry = cache.get(userId);
  const now = Date.now();
  if (!entry || (now - entry.at > TTL_MS && !entry.refreshing)) {
    void refresh(userId);
  }
  return entry?.profile ?? null;
}

/** Mark the cached profile stale so the next read refreshes from the Kernel. */
export function invalidateProfile(userId: string): void {
  const entry = cache.get(userId);
  if (entry) cache.set(userId, { ...entry, at: 0 });
}

// Latest pedagogical-safety alerts from the most recent /analyze, per user.
const alertsCache = new Map<string, KernelAlert[]>();

export function setLatestAlerts(userId: string, alerts: KernelAlert[]): void {
  alertsCache.set(userId, alerts ?? []);
}

export function getLatestAlerts(userId: string): KernelAlert[] {
  return alertsCache.get(userId) ?? [];
}

async function refresh(userId: string): Promise<void> {
  const prev = cache.get(userId);
  cache.set(userId, {
    profile: prev?.profile ?? null,
    at: prev?.at ?? 0,
    refreshing: true,
  });
  try {
    const profile = await kernel.loadProfile({ user_id: userId });
    cache.set(userId, { profile, at: Date.now(), refreshing: false });
  } catch {
    // Back off for a full TTL even on failure so we don't hammer a down Kernel.
    cache.set(userId, {
      profile: prev?.profile ?? null,
      at: Date.now(),
      refreshing: false,
    });
  }
}
