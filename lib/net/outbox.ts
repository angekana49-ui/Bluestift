"use client";

import { subscribeOnline } from "./online";

/**
 * Durable queue for user-authored TEXT payloads that failed to send (chat
 * messages first; the shape is generic). localStorage-backed so a message
 * survives a reload or a dead connection — the data-loss rule of the
 * resilience work: nothing a student typed is ever silently dropped.
 *
 * The outbox does not know how to SEND anything: surfaces register a flusher
 * for their `kind` (the chat engine replays a send through its own streaming
 * flow). The outbox persists entries, caps growth, and drives flush attempts
 * on reconnect + on an interval while entries exist.
 *
 * Privacy: chat text on shared school machines must not outlive the session —
 * `clearOutbox()` is part of sign-out (see clearLocalData in lib/net/local-data).
 */

export type OutboxEntry = {
  /** Stable client id (doubles as the chat clientMsgId for server dedupe). */
  id: string;
  kind: string;
  body: Record<string, unknown>;
  createdAt: number;
  attempts: number;
};

const KEY = "bluestift-outbox";
const MAX_ENTRIES = 50;
const FLUSH_INTERVAL_MS = 30_000;

type Flusher = (entry: OutboxEntry) => Promise<boolean>; // true = delivered

const flushers = new Map<string, Flusher>();
const listeners = new Set<() => void>();
let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let onlineHooked = false;

function read(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // best-effort (private mode / quota)
  }
  listeners.forEach((cb) => cb());
  ensureTimers();
}

function ensureTimers(): void {
  if (typeof window === "undefined") return;
  if (!onlineHooked) {
    onlineHooked = true;
    subscribeOnline((s) => {
      if (s.online) void flushOutbox();
    });
  }
  const hasEntries = read().length > 0;
  if (hasEntries && timer == null) {
    timer = setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS);
  } else if (!hasEntries && timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

export function listOutbox(kind?: string): OutboxEntry[] {
  const all = read();
  return kind ? all.filter((e) => e.kind === kind) : all;
}

export function enqueueOutbox(entry: Omit<OutboxEntry, "createdAt" | "attempts">): void {
  const all = read().filter((e) => e.id !== entry.id);
  all.push({ ...entry, createdAt: Date.now(), attempts: 0 });
  // Cap: drop the oldest beyond the limit — better to lose the stalest
  // undelivered text than to wedge storage.
  write(all.slice(-MAX_ENTRIES));
}

export function removeFromOutbox(id: string): void {
  write(read().filter((e) => e.id !== id));
}

/** Notified whenever the queue changes (UI badges, retry chips). */
export function subscribeOutbox(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** How a `kind` gets replayed. One flusher per kind; last registration wins. */
export function registerOutboxFlusher(kind: string, flusher: Flusher): void {
  flushers.set(kind, flusher);
  ensureTimers();
}

/** Try to deliver everything that has a registered flusher. Never throws. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const entry of read()) {
      const flusher = flushers.get(entry.kind);
      if (!flusher) continue;
      let delivered = false;
      try {
        delivered = await flusher(entry);
      } catch {
        delivered = false;
      }
      if (delivered) {
        removeFromOutbox(entry.id);
      } else {
        write(read().map((e) => (e.id === entry.id ? { ...e, attempts: e.attempts + 1 } : e)));
      }
    }
  } finally {
    flushing = false;
    ensureTimers();
  }
}

/** Wipe the queue — sign-out on shared machines. */
export function clearOutbox(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
  listeners.forEach((cb) => cb());
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
