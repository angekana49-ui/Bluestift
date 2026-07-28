import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The outbox is the data-loss backstop: text a student typed survives a failed
 * send, a reload, and a dead connection, and is replayed once a flusher can
 * deliver it. Sign-out must wipe it (shared school machines).
 */

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

async function freshOutbox() {
  vi.resetModules();
  return import("@/lib/net/outbox");
}

beforeEach(() => {
  stubLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("outbox", () => {
  it("persists an entry and lists it back", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: { text: "hello" } });
    const all = ob.listOutbox();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "m1", kind: "chat", attempts: 0 });
    expect(all[0].body).toEqual({ text: "hello" });
  });

  it("survives a reload (reads back from localStorage on a fresh module)", async () => {
    const first = await freshOutbox();
    first.enqueueOutbox({ id: "m1", kind: "chat", body: { text: "still here" } });
    const reloaded = await freshOutbox(); // same stubbed storage
    expect(reloaded.listOutbox()[0].body).toEqual({ text: "still here" });
  });

  it("re-enqueuing the same id replaces rather than duplicates", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: { text: "v1" } });
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: { text: "v2" } });
    expect(ob.listOutbox()).toHaveLength(1);
    expect(ob.listOutbox()[0].body).toEqual({ text: "v2" });
  });

  it("caps growth by dropping the oldest entries", async () => {
    const ob = await freshOutbox();
    for (let i = 0; i < 55; i++) {
      ob.enqueueOutbox({ id: `m${i}`, kind: "chat", body: { text: `#${i}` } });
    }
    const all = ob.listOutbox();
    expect(all).toHaveLength(50);
    expect(all[0].id).toBe("m5"); // the five oldest were dropped
    expect(all.at(-1)!.id).toBe("m54");
  });

  it("flush removes delivered entries and counts attempts on the rest", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "ok", kind: "chat", body: {} });
    ob.enqueueOutbox({ id: "nope", kind: "chat", body: {} });
    ob.registerOutboxFlusher("chat", async (e) => e.id === "ok");
    await ob.flushOutbox();
    const left = ob.listOutbox();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: "nope", attempts: 1 });
  });

  it("leaves entries whose kind has no flusher untouched", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "m1", kind: "other-surface", body: {} });
    ob.registerOutboxFlusher("chat", async () => true);
    await ob.flushOutbox();
    expect(ob.listOutbox()).toHaveLength(1);
  });

  it("a throwing flusher never loses the entry", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: {} });
    ob.registerOutboxFlusher("chat", async () => {
      throw new Error("still offline");
    });
    await ob.flushOutbox();
    expect(ob.listOutbox()).toHaveLength(1);
  });

  it("clearOutbox wipes everything (sign-out on a shared machine)", async () => {
    const ob = await freshOutbox();
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: { text: "private" } });
    ob.clearOutbox();
    expect(ob.listOutbox()).toHaveLength(0);
    const reloaded = await freshOutbox();
    expect(reloaded.listOutbox()).toHaveLength(0);
  });

  it("notifies subscribers on change", async () => {
    const ob = await freshOutbox();
    const seen = vi.fn();
    ob.subscribeOutbox(seen);
    ob.enqueueOutbox({ id: "m1", kind: "chat", body: {} });
    expect(seen).toHaveBeenCalled();
  });

  it("tolerates unavailable storage (private mode) without throwing", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
    });
    const ob = await freshOutbox();
    expect(() => ob.enqueueOutbox({ id: "m1", kind: "chat", body: {} })).not.toThrow();
    expect(ob.listOutbox()).toEqual([]);
  });
});
