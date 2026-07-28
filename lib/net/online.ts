"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared connectivity store for the whole app — the network twin of the
 * theme/locale providers, but module-level because connectivity is global.
 *
 * Two signals, deliberately separate:
 * - `online`  — the browser's own `navigator.onLine` (radio off, airplane mode).
 * - `degraded` — OUR recent experience: `navigator.onLine` is true on a dead
 *   hotel wifi, so `netFetch` reports failures/successes here and we call the
 *   link degraded after repeated failures in a short window.
 */

export type OnlineStatus = { online: boolean; degraded: boolean };

const FAILURE_WINDOW_MS = 30_000;
const FAILURES_FOR_DEGRADED = 2;

let failures: number[] = []; // timestamps of recent fetch failures
let browserOnline = true; // mirrors navigator.onLine once listeners attach
let snapshot: OnlineStatus = { online: true, degraded: false };
const listeners = new Set<() => void>();

function recompute(): void {
  const now = Date.now();
  failures = failures.filter((t) => now - t < FAILURE_WINDOW_MS);
  const next: OnlineStatus = {
    online: browserOnline,
    degraded: failures.length >= FAILURES_FOR_DEGRADED,
  };
  // Keep the snapshot referentially stable unless something changed —
  // useSyncExternalStore re-renders on identity.
  if (next.online !== snapshot.online || next.degraded !== snapshot.degraded) {
    snapshot = next;
    listeners.forEach((cb) => cb());
  }
}

/** Called by the fetch layer after a network-level failure (throw/timeout). */
export function reportNetFailure(): void {
  failures.push(Date.now());
  recompute();
}

/** Called by the fetch layer after any completed request — clears "degraded". */
export function reportNetSuccess(): void {
  if (failures.length === 0) return;
  failures = [];
  recompute();
}

/** Subscribe outside React (outbox flush, Realtime resubscribe). */
export function subscribeOnline(cb: (status: OnlineStatus) => void): () => void {
  const wrapped = () => cb(snapshot);
  listeners.add(wrapped);
  attachBrowserListeners();
  return () => {
    listeners.delete(wrapped);
  };
}

let attached = false;
function attachBrowserListeners(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;
  browserOnline = navigator.onLine;
  window.addEventListener("online", () => {
    browserOnline = true;
    // A regained radio is a fresh start — don't keep calling the link degraded.
    failures = [];
    recompute();
  });
  window.addEventListener("offline", () => {
    browserOnline = false;
    recompute();
  });
  recompute();
}

function subscribeStore(cb: () => void): () => void {
  listeners.add(cb);
  attachBrowserListeners();
  return () => {
    listeners.delete(cb);
  };
}

const SERVER_SNAPSHOT: OnlineStatus = { online: true, degraded: false };

/** `const { online, degraded } = useOnlineStatus()` — SSR-safe (assumes online). */
export function useOnlineStatus(): OnlineStatus {
  return useSyncExternalStore(
    subscribeStore,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
}
