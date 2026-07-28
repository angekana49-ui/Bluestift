"use client";

import { reportNetFailure, reportNetSuccess } from "./online";

/**
 * The app's client fetch layer — `lib/entitlements-client.ts` generalized.
 * Every client request should go through here instead of bare `fetch()` so it
 * gets, uniformly: a timeout (no request hangs a spinner forever), optional
 * GET retries with jittered backoff, inflight dedupe, and connectivity
 * reporting into `lib/net/online.ts` (which drives the degraded banner).
 *
 * POSTs are NEVER auto-retried here — mutation retry policy belongs to the
 * caller (see the chat outbox), because blind re-POSTs duplicate writes.
 */

export type NetOpts = {
  /** Abort the request after this long. Default 10s. */
  timeoutMs?: number;
  /** Extra attempts after a failure — honored for GET/HEAD only. Default 0. */
  retries?: number;
  /** Base backoff between attempts (jittered ×1–2). Default 600ms. */
  retryDelayMs?: number;
  /** Concurrent calls sharing a key share one request (responses are cloned). */
  dedupeKey?: string;
};

const inflight = new Map<string, Promise<Response>>();

const RETRIABLE_STATUS = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function netFetch(
  url: string,
  init: RequestInit = {},
  opts: NetOpts = {},
): Promise<Response> {
  const { timeoutMs = 10_000, retryDelayMs = 600, dedupeKey } = opts;
  const method = (init.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  const retries = idempotent ? (opts.retries ?? 0) : 0;

  if (dedupeKey) {
    const shared = inflight.get(dedupeKey);
    if (shared) return (await shared).clone();
  }

  const run = async (): Promise<Response> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(retryDelayMs * attempt * (1 + Math.random()));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        // Any HTTP response means the network worked — even a 500.
        reportNetSuccess();
        if (idempotent && RETRIABLE_STATUS.has(res.status) && attempt < retries) {
          continue;
        }
        return res;
      } catch (e) {
        // Network throw or our timeout abort.
        reportNetFailure();
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  };

  if (!dedupeKey) return run();
  const p = run().finally(() => inflight.delete(dedupeKey));
  inflight.set(dedupeKey, p);
  // The cached promise hands out clones so every awaiter can read the body.
  return (await p).clone();
}

// ── Cached JSON GETs (stale-while-revalidate) ─────────────────────────────
//
// L1: module Map (this tab, this page-lifetime). L2: sessionStorage (survives
// client-side navigations and soft reloads, cleared when the tab closes — we
// deliberately avoid localStorage for DATA on shared school machines).

type CacheEntry = { data: unknown; at: number };

const l1 = new Map<string, CacheEntry>();
const L2_PREFIX = "bsnet:";

function l2Read(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(L2_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    return typeof parsed?.at === "number" ? parsed : null;
  } catch {
    return null; // private mode / quota / corrupt entry
  }
}

function l2Write(key: string, entry: CacheEntry): void {
  try {
    sessionStorage.setItem(L2_PREFIX + key, JSON.stringify(entry));
  } catch {
    // best-effort
  }
}

export type CachedResult<T> = {
  data: T | null;
  /** True when `data` came from cache past its TTL (a refresh is in flight). */
  stale: boolean;
};

/**
 * GET `url` as JSON with an instant-render cache:
 * - fresh cache → returned as-is, no network;
 * - stale cache → returned immediately, refreshed in the background
 *   (`onUpdate` fires with the fresh data when it lands);
 * - no cache → one awaited network try; `{ data: null }` on failure.
 */
export async function getJsonCached<T>(
  url: string,
  opts: NetOpts & {
    cacheKey: string;
    /** How long a cached value counts as fresh. Default 30s. */
    cacheTtlMs?: number;
    onUpdate?: (data: T) => void;
  },
): Promise<CachedResult<T>> {
  const { cacheKey, cacheTtlMs = 30_000, onUpdate, ...net } = opts;
  const cached = l1.get(cacheKey) ?? l2Read(cacheKey);
  const age = cached ? Date.now() - cached.at : Infinity;

  const fetchFresh = async (): Promise<T | null> => {
    try {
      const res = await netFetch(url, {}, { dedupeKey: `json:${cacheKey}`, ...net });
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      const entry = { data, at: Date.now() };
      l1.set(cacheKey, entry);
      l2Write(cacheKey, entry);
      return data;
    } catch {
      return null;
    }
  };

  if (cached && age < cacheTtlMs) {
    l1.set(cacheKey, cached); // promote an L2 hit
    return { data: cached.data as T, stale: false };
  }
  if (cached) {
    void fetchFresh().then((fresh) => {
      if (fresh !== null) onUpdate?.(fresh);
    });
    return { data: cached.data as T, stale: true };
  }
  return { data: await fetchFresh(), stale: false };
}

/** Drop one cached entry (after a mutation that invalidates it). */
export function invalidateCached(cacheKey: string): void {
  l1.delete(cacheKey);
  try {
    sessionStorage.removeItem(L2_PREFIX + cacheKey);
  } catch {
    // best-effort
  }
}

/** Wipe every cached response — call on sign-out (shared school machines). */
export function clearNetCaches(): void {
  l1.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(L2_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // best-effort
  }
}
