import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capMap, CACHE_MAX_ENTRIES } from "@/lib/bounded-map";

/**
 * The in-process caches keyed by account.
 *
 * Every one of them expires LAZILY — the TTL is checked when a key is read
 * again — so a key nobody reads again is never removed. On serverless the
 * instance is usually recycled before that matters, which is precisely why it
 * survived four audit passes: the leak is invisible until the process lives a
 * while, and `anchoredCache` holds entries for thirty days.
 *
 * These tests hold the ceiling in place. They are cheap and the failure they
 * guard against is slow and silent, which is the worst combination to find in
 * production rather than here.
 */
describe("capMap", () => {
  it("does nothing while the map is within budget", () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 10; i++) m.set(`k${i}`, i);
    capMap(m, 100);
    expect(m.size).toBe(10);
  });

  it("does not clear at exactly the ceiling", () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 5; i++) m.set(`k${i}`, i);
    capMap(m, 5);
    expect(m.size).toBe(5);
  });

  it("clears once past it, so the map cannot grow without bound", () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 6; i++) m.set(`k${i}`, i);
    capMap(m, 5);
    expect(m.size).toBe(0);
  });

  it("carries a ceiling that is generous but finite", () => {
    expect(CACHE_MAX_ENTRIES).toBeGreaterThan(1000);
    expect(Number.isFinite(CACHE_MAX_ENTRIES)).toBe(true);
  });
});

describe("every account-keyed cache is capped", () => {
  const files = [
    ["lib/entitlements.ts", "entitlements by user and school"],
    ["lib/compliance/optional-processing.ts", "the analytics/training consent memo"],
    ["lib/kernel/profile-cache.ts", "the Kernel profile, alerts and analysis slots"],
  ] as const;

  for (const [file, what] of files) {
    it(`${file} — ${what}`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).toContain("capMap(");
      expect(src).toContain("CACHE_MAX_ENTRIES");
    });
  }

  it("leaves the caches keyed by a fixed handful of strings alone", () => {
    // The plan catalogue (3 keys) and the published content (2 keys) cannot
    // grow, so a ceiling there would be noise rather than safety.
    for (const file of ["lib/billing.ts", "lib/content.ts"]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain("capMap(");
    }
  });
});
