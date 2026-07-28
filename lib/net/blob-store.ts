"use client";

/**
 * Minimal promisified IndexedDB store for user-authored BLOBS that would
 * otherwise be lost on a network failure: voice recordings whose transcription
 * failed, files whose upload failed. Text goes to the outbox; bytes come here
 * (localStorage can't hold them).
 *
 * Every function is safe to call anywhere: without IndexedDB (SSR, ancient
 * browser, private mode edge cases) reads return null/[] and writes no-op —
 * the caller's retry affordance simply holds the in-memory Blob for the
 * session instead.
 */

const DB_NAME = "bluestift-blobs";
const STORE = "blobs";

export type BlobMeta = Record<string, unknown> & { kind?: string; name?: string };
type StoredBlob = { id: string; blob: Blob; meta: BlobMeta; createdAt: number };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;
  return new Promise<T>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => {
        db.close();
        resolve(req.result as T);
      };
      req.onerror = () => {
        db.close();
        resolve(fallback);
      };
    } catch {
      db.close();
      resolve(fallback);
    }
  });
}

export async function putBlob(id: string, blob: Blob, meta: BlobMeta = {}): Promise<void> {
  const row: StoredBlob = { id, blob, meta, createdAt: Date.now() };
  await withStore("readwrite", (s) => s.put(row), undefined);
}

export async function getBlob(id: string): Promise<{ blob: Blob; meta: BlobMeta } | null> {
  const row = await withStore<StoredBlob | undefined>("readonly", (s) => s.get(id), undefined);
  return row ? { blob: row.blob, meta: row.meta } : null;
}

export async function deleteBlob(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id), undefined);
}

export async function listBlobs(): Promise<{ id: string; meta: BlobMeta; createdAt: number }[]> {
  const rows = await withStore<StoredBlob[]>("readonly", (s) => s.getAll(), []);
  return (rows ?? []).map(({ id, meta, createdAt }) => ({ id, meta, createdAt }));
}

/** Wipe everything — sign-out on shared machines. */
export async function clearBlobs(): Promise<void> {
  await withStore("readwrite", (s) => s.clear(), undefined);
}
