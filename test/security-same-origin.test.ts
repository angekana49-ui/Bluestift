import { describe, expect, it, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exemptFromOriginCheck, originAllowed } from "@/lib/security/same-origin";

/**
 * The cross-site write guard.
 *
 * It backs up `SameSite=Lax` rather than replacing it, and the thing worth
 * testing is not that it blocks — anything blocks — but that it blocks ONLY
 * what it means to. A guard on the request path that refuses a payment webhook
 * or a cron is an outage, and an outage caused by a security check is how the
 * check gets deleted.
 */
describe("originAllowed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lets every safe method through, whatever the origin says", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(originAllowed({ method, origin: "https://evil.example", host: "app.test" })).toBe(true);
    }
  });

  it("lets a write from our own page through", () => {
    expect(
      originAllowed({ method: "POST", origin: "https://app.test", host: "app.test" }),
    ).toBe(true);
  });

  it("refuses a write from another site", () => {
    expect(
      originAllowed({ method: "POST", origin: "https://evil.example", host: "app.test" }),
    ).toBe(false);
  });

  it("refuses an opaque origin — a sandboxed frame or a cross-origin redirect", () => {
    expect(originAllowed({ method: "POST", origin: "null", host: "app.test" })).toBe(false);
  });

  it("allows a caller that sends no Origin at all — the aggregator, a cron, curl", () => {
    expect(originAllowed({ method: "POST", origin: null, host: "app.test" })).toBe(true);
  });

  it("follows the request's own host, so previews and localhost need no config", () => {
    expect(
      originAllowed({
        method: "POST",
        origin: "https://bluestift-git-abc.vercel.app",
        host: "bluestift-git-abc.vercel.app",
      }),
    ).toBe(true);
    expect(
      originAllowed({ method: "POST", origin: "http://localhost:3000", host: "localhost:3000" }),
    ).toBe(true);
  });

  it("accepts the OTHER product origins once the domains split", () => {
    vi.stubEnv("NEXT_PUBLIC_RAYA_URL", "https://raya.thebluestift.com");
    expect(
      originAllowed({
        method: "POST",
        origin: "https://raya.thebluestift.com",
        host: "thebluestift.com",
      }),
    ).toBe(true);
  });

  it("does NOT accept a sibling subdomain that isn't one of ours", () => {
    // The exact hole SameSite=Lax leaves open once a cookie domain is set.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://thebluestift.com");
    expect(
      originAllowed({
        method: "POST",
        origin: "https://blog.thebluestift.com",
        host: "thebluestift.com",
      }),
    ).toBe(false);
  });
});

describe("exemptFromOriginCheck", () => {
  it("exempts the endpoints whose caller is never a browser", () => {
    expect(exemptFromOriginCheck("/api/billing/webhook/cinetpay")).toBe(true);
    expect(exemptFromOriginCheck("/api/cron/anon-lifecycle")).toBe(true);
  });

  it("exempts nothing else", () => {
    for (const p of [
      "/api/billing/checkout",
      "/api/account/delete",
      "/api/raya/chat",
      "/api/school/student/record",
    ]) {
      expect(exemptFromOriginCheck(p)).toBe(false);
    }
  });
});

describe("the guard is actually wired into the request path", () => {
  const proxy = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

  it("runs first, before the session refresh and before the nonce", () => {
    expect(proxy).toContain("originAllowed");
    expect(proxy).toContain("exemptFromOriginCheck");
    // Anchored on the CALL, not the import line at the top of the file. A
    // refused request must cost nothing — no Supabase round trip, no nonce.
    expect(proxy.indexOf("!originAllowed({")).toBeGreaterThan(-1);
    expect(proxy.indexOf("!originAllowed({")).toBeLessThan(proxy.indexOf("makeNonce()"));
    expect(proxy.indexOf("!originAllowed({")).toBeLessThan(proxy.indexOf("updateSession("));
  });
});
