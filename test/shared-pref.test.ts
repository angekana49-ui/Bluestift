import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * The store behind theme, language and the analytics decision. Its one job is
 * to survive an origin hop, which localStorage cannot do — so what these tests
 * actually pin down is the cookie/storage precedence, and the fact that neither
 * store is required.
 */

/** A cookie jar that behaves like the real one: writes accumulate, max-age=0 deletes. */
function cookieJar(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  return {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(str: string) {
      const [pair, ...attrs] = str.split(";").map((s) => s.trim());
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      if (attrs.some((a) => a.toLowerCase() === "max-age=0")) jar.delete(name);
      else jar.set(name, pair.slice(i + 1));
    },
  };
}

/** Attributes of the most recent write per cookie name, which the jar discards. */
const lastWrite = new Map<string, string>();

type Opts = { storage?: Record<string, string> | "throws"; cookies?: Record<string, string> | "refused"; domain?: string };

async function load({ storage = {}, cookies = {}, domain }: Opts = {}) {
  const store = storage === "throws" ? null : { ...storage };
  const jar = cookies === "refused" ? null : cookieJar(cookies);
  lastWrite.clear();

  const doc = {
    get cookie() {
      return jar ? jar.cookie : "";
    },
    set cookie(v: string) {
      const name = v.slice(0, v.indexOf("="));
      lastWrite.set(name, v);
      if (jar) jar.cookie = v; // a browser with cookies off drops the write silently
    },
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => {
        if (!store) throw new Error("disabled");
        return store[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (!store) throw new Error("disabled");
        store[k] = v;
      },
      removeItem: (k: string) => {
        if (!store) throw new Error("disabled");
        delete store[k];
      },
    },
    location: { protocol: "https:" },
  });

  if (domain) vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", domain);
  else vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "");
  vi.resetModules();
  return { ...(await import("@/lib/shared-pref")), store, attrs: (n: string) => lastWrite.get(n) ?? "" };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("readPref", () => {
  it("prefers the COOKIE over localStorage when they disagree", async () => {
    // The reason the whole module exists. After the split each origin keeps its
    // own localStorage, so the local copy is the one that goes stale: set dark
    // on the site, turn it off on raya., come back. Storage-first would hand
    // back the value you already abandoned.
    const { readPref } = await load({
      storage: { "bluestift-dark": "1" },
      cookies: { "bluestift-dark": "0" },
    });
    expect(readPref("bluestift-dark")).toBe("0");
  });

  it("falls back to localStorage when there is no cookie", async () => {
    const { readPref } = await load({ storage: { "bluestift-locale": "fr" } });
    expect(readPref("bluestift-locale")).toBe("fr");
  });

  it("survives either store being unavailable", async () => {
    expect((await load({ storage: "throws", cookies: { k: "v" } })).readPref("k")).toBe("v");
    expect((await load({ cookies: "refused", storage: { k: "v" } })).readPref("k")).toBe("v");
    expect((await load({ storage: "throws", cookies: "refused" })).readPref("k")).toBeNull();
  });

  it("decodes an encoded value and ignores a name that merely ends with ours", async () => {
    const enc = await load({ cookies: { k: encodeURIComponent("a b") } });
    expect(enc.readPref("k")).toBe("a b");
    const near = await load({ cookies: { x_k: "v" } });
    expect(near.readPref("k")).toBeNull();
  });

  it("is null on the server, where neither store exists", async () => {
    vi.resetModules();
    const { readPref } = await import("@/lib/shared-pref");
    expect(readPref("k")).toBeNull();
  });
});

describe("writePref", () => {
  it("writes both stores, so the cookie can cross origins and storage can fire", async () => {
    // localStorage is kept purely for the `storage` event — cookies fire none,
    // and both theme hooks sync across tabs with it.
    const { writePref, readPref, store } = await load();
    writePref("bluestift-dark", "1");
    expect(store?.["bluestift-dark"]).toBe("1");
    expect(readPref("bluestift-dark")).toBe("1");
  });

  it("writes no domain attribute when none is configured", async () => {
    const { writePref, attrs } = await load();
    writePref("k", "v");
    expect(attrs("k")).not.toContain("domain=");
    expect(attrs("k")).toContain("path=/");
    expect(attrs("k")).toContain("samesite=lax");
  });

  it("scopes to the parent domain when one is configured", async () => {
    const { writePref, attrs } = await load({ domain: ".thebluestift.com" });
    writePref("k", "v");
    expect(attrs("k")).toContain("domain=.thebluestift.com");
  });

  it("still records the value when one store is refused", async () => {
    const noStore = await load({ storage: "throws" });
    expect(() => noStore.writePref("k", "v")).not.toThrow();
    expect(noStore.readPref("k")).toBe("v");

    const noCookie = await load({ cookies: "refused" });
    noCookie.writePref("k", "v");
    expect(noCookie.readPref("k")).toBe("v");
  });
});

describe("prefsUsable", () => {
  it("is true when either store works, false when neither does", async () => {
    expect((await load()).prefsUsable()).toBe(true);
    expect((await load({ storage: "throws" })).prefsUsable()).toBe(true);
    expect((await load({ cookies: "refused" })).prefsUsable()).toBe(true);
    expect((await load({ storage: "throws", cookies: "refused" })).prefsUsable()).toBe(false);
  });

  it("leaves nothing behind", async () => {
    const { prefsUsable, readPref, store } = await load();
    prefsUsable();
    expect(readPref("__bs_probe")).toBeNull();
    expect(store?.__bs_probe).toBeUndefined();
  });
});
