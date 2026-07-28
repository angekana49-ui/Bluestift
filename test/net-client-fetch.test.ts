import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  netFetch,
  getJsonCached,
  invalidateCached,
  clearNetCaches,
} from "@/lib/net/client-fetch";

/**
 * The client fetch layer's contract: timeouts abort, retries are GET-only,
 * dedupe shares one request, and the JSON cache renders stale data instantly
 * while revalidating in the background. All network is mocked — Response is
 * the platform global (Node 18+).
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch that never responds and rejects with AbortError when aborted. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  );
}

// In-memory sessionStorage for the Node test env.
function stubSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
}

beforeEach(() => {
  stubSessionStorage();
  clearNetCaches();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("netFetch", () => {
  it("returns the response on the happy path", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: 1 })));
    const res = await netFetch("/api/x");
    expect(res.status).toBe(200);
  });

  it("aborts a hung request at the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const p = netFetch("/api/slow", {}, { timeoutMs: 1000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBeInstanceOf(DOMException);
  });

  it("retries a GET on network failure, then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = netFetch("/api/x", {}, { retries: 1, retryDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(5000); // covers the jittered backoff
    const res = await p;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a GET on 503", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = netFetch("/api/x", {}, { retries: 1, retryDelayMs: 50 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await p).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("NEVER auto-retries a POST, even when asked to", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      netFetch("/api/x", { method: "POST" }, { retries: 3 }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent calls sharing a key onto one request", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ n: 42 }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([
      netFetch("/api/x", {}, { dedupeKey: "x" }),
      netFetch("/api/x", {}, { dedupeKey: "x" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Both callers can read the body independently (clones).
    expect(await a.json()).toEqual({ n: 42 });
    expect(await b.json()).toEqual({ n: 42 });
  });
});

describe("getJsonCached", () => {
  it("misses → fetches → caches; second call is served without network", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ v: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await getJsonCached<{ v: number }>("/api/data", { cacheKey: "d" });
    expect(first).toEqual({ data: { v: 1 }, stale: false });
    const second = await getJsonCached<{ v: number }>("/api/data", { cacheKey: "d" });
    expect(second).toEqual({ data: { v: 1 }, stale: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves stale data instantly and revalidates in the background", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ v: 1 })));
    await getJsonCached("/api/data", { cacheKey: "d", cacheTtlMs: 0 });

    let updated: unknown = null;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ v: 2 })));
    const res = await getJsonCached<{ v: number }>("/api/data", {
      cacheKey: "d",
      cacheTtlMs: 0,
      onUpdate: (d) => (updated = d),
    });
    expect(res).toEqual({ data: { v: 1 }, stale: true }); // instant, old value
    await vi.waitFor(() => expect(updated).toEqual({ v: 2 })); // refresh landed
  });

  it("returns null data (not a throw) when offline with no cache", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const res = await getJsonCached("/api/data", { cacheKey: "empty" });
    expect(res.data).toBeNull();
  });

  it("invalidateCached forces the next call back to the network", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ v: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await getJsonCached("/api/data", { cacheKey: "d" });
    invalidateCached("d");
    await getJsonCached("/api/data", { cacheKey: "d" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
