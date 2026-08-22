import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Analytics is opt-in: nothing is captured until the user says yes, and their
 * answer must be asked for exactly once. `setConsent` has always written the
 * decision to BOTH localStorage and a cookie, but `getConsent` only read the
 * first — so whenever the storage write was the one that failed, the banner came
 * back on every visit with the answer sitting in the cookie beside it.
 */

type Env = { storage?: Record<string, string> | "throws"; cookie?: string };

/** Install a browser-ish global env, then load a fresh copy of the module. */
async function load({ storage = {}, cookie = "" }: Env = {}) {
  const store = storage === "throws" ? null : { ...storage };
  vi.stubGlobal("window", {
    localStorage: {
      getItem(k: string) {
        if (!store) throw new Error("localStorage is disabled");
        return store[k] ?? null;
      },
      setItem(k: string, v: string) {
        if (!store) throw new Error("localStorage is disabled");
        store[k] = v;
      },
    },
    location: { protocol: "https:" },
  });
  const doc = { cookie };
  vi.stubGlobal("document", doc);
  vi.resetModules();
  const mod = await import("@/lib/analytics/consent");
  return { ...mod, store, doc };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getConsent", () => {
  it("reads the decision from localStorage", async () => {
    const { getConsent, CONSENT_COOKIE } = await load({
      storage: { bs_analytics_consent: "granted" },
    });
    expect(CONSENT_COOKIE).toBe("bs_analytics_consent");
    expect(getConsent()).toBe("granted");
  });

  it("falls back to the cookie when localStorage holds nothing", async () => {
    const { getConsent } = await load({ cookie: "bs_analytics_consent=denied" });
    expect(getConsent()).toBe("denied");
  });

  it("falls back to the cookie when localStorage throws (private mode)", async () => {
    // The exact shape of the bug: setConsent's storage write threw, the cookie
    // write landed, and the banner reappeared anyway.
    const { getConsent } = await load({
      storage: "throws",
      cookie: "bs_analytics_consent=granted",
    });
    expect(getConsent()).toBe("granted");
  });

  it("finds the cookie among others, wherever it sits", async () => {
    for (const cookie of [
      "bs_analytics_consent=granted; sb-access-token=x",
      "sb-access-token=x; bs_analytics_consent=granted",
      "a=1; bs_analytics_consent=granted; b=2",
    ]) {
      const { getConsent } = await load({ cookie });
      expect(getConsent(), cookie).toBe("granted");
    }
  });

  it("does not match a cookie whose name merely ends with ours", async () => {
    const { getConsent } = await load({ cookie: "x_bs_analytics_consent=granted" });
    expect(getConsent()).toBeNull();
  });

  it("is null when neither store has an answer", async () => {
    expect((await load()).getConsent()).toBeNull();
  });

  it("treats anything that is not a decision as no answer", async () => {
    for (const v of ["", "yes", "true", "GRANTED", "1"]) {
      const fromStorage = await load({ storage: { bs_analytics_consent: v } });
      expect(fromStorage.getConsent(), `storage ${v}`).toBeNull();
      const fromCookie = await load({ cookie: `bs_analytics_consent=${v}` });
      expect(fromCookie.getConsent(), `cookie ${v}`).toBeNull();
    }
  });

  it("returns null on the server, where neither store exists", async () => {
    vi.resetModules();
    const { getConsent } = await import("@/lib/analytics/consent");
    expect(typeof window).toBe("undefined");
    expect(getConsent()).toBeNull();
  });
});

describe("setConsent", () => {
  it("writes both stores, so either one can answer later", async () => {
    const { setConsent, store, doc } = await load();
    setConsent("granted");
    expect(store?.bs_analytics_consent).toBe("granted");
    expect(doc.cookie).toContain("bs_analytics_consent=granted");
    expect(doc.cookie).toContain("path=/");
    expect(doc.cookie).toContain("samesite=lax");
    expect(doc.cookie).toContain("secure"); // stubbed protocol is https
  });

  it("still records the decision when localStorage is unavailable", async () => {
    const { setConsent, getConsent, doc } = await load({ storage: "throws" });
    expect(() => setConsent("denied")).not.toThrow();
    expect(doc.cookie).toContain("bs_analytics_consent=denied");
    expect(getConsent()).toBe("denied");
  });
});
