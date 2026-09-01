import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * public/sw.js is the one file in this repo that runs with no framework, no
 * types, and no import graph — nothing else in the codebase references its
 * internals, so nothing else fails when one of its rules quietly stops holding.
 *
 * Two of those rules are load-bearing beyond performance:
 *
 *   - it must never cache an HTML document. Every page here is a Server
 *     Component rendered per session — app/page.tsx passes `signedIn` and a
 *     session-resolved `homeHref` into the marketing page, so even "/" differs
 *     per visitor. On a shared school machine a cached document would hand the
 *     next student the previous one's chrome.
 *   - it must never touch /api/*, where a stale response is worse than none.
 *
 * The rest of the file is a cache policy, and a cache policy that silently
 * inverts is the kind of bug that only shows up as someone's data bill. These
 * read the source rather than run the worker (there is no ServiceWorkerGlobal
 * in vitest), which is the same trade test/pwa-manifest.test.ts makes.
 */

const SW = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/** The body of a top-level `async function name(...) { ... }`, brace-matched. */
function body(name: string): string {
  const start = SW.indexOf(`async function ${name}(`);
  expect(start, `${name} not found in sw.js`).toBeGreaterThan(-1);
  const open = SW.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < SW.length; i++) {
    if (SW[i] === "{") depth++;
    else if (SW[i] === "}" && --depth === 0) return SW.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("service worker", () => {
  it("never writes a document to a cache", () => {
    // The navigation handler may READ the offline page out of the cache. The
    // moment it starts writing to one, it is storing someone's page.
    const nav = body("networkThenOffline");
    expect(nav).toContain("cache.match(OFFLINE_URL)");
    expect(nav, "the navigation handler caches a document").not.toMatch(/\.put\(/);
  });

  it("leaves /api/* alone", () => {
    expect(SW).toMatch(/url\.pathname\.startsWith\("\/api\/"\)\s*\)\s*return/);
  });

  it("gives the two asset kinds separate budgets", () => {
    // One shared budget let a deploy's chunks evict the icons and brand marks,
    // which then cost data to fetch again. They must not be able to.
    expect(SW).toMatch(/const SHELL_CACHE = `\$\{SHELL_PREFIX\}\$\{VERSION\}`/);
    expect(SW).toMatch(/const BUILD_CACHE = `\$\{BUILD_PREFIX\}\$\{VERSION\}`/);
    expect(SW).toMatch(/cacheFirst\(event, BUILD_CACHE, MAX_BUILD\)/);
    expect(SW).toMatch(/cacheFirst\(event, SHELL_CACHE, MAX_SHELL\)/);
  });

  /**
   * `sweepCaches` is the one piece of this file with logic a regex cannot
   * check — it sorts, keeps one generation and drops the rest — so this runs
   * the real source instead of reading it. The function is lifted out with the
   * brace matcher above and evaluated with `caches` passed in, which is why the
   * constants it closes over are redeclared here rather than imported: sw.js is
   * not a module and has no exports to import.
   */
  function runSweep(names: string[], version = "v7"): Promise<string[]> {
    const remaining = new Set(names);
    const fake = {
      keys: async () => [...remaining],
      delete: async (n: string) => remaining.delete(n),
    };
    const factory = new Function(
      "caches",
      `const SHELL_PREFIX = "bluestift-shell-";
       const BUILD_PREFIX = "bluestift-build-";
       const SHELL_CACHE = SHELL_PREFIX + ${JSON.stringify(version)};
       const BUILD_CACHE = BUILD_PREFIX + ${JSON.stringify(version)};
       return async function sweepCaches() ${body("sweepCaches")};`,
    );
    return factory(fake)().then(() => [...remaining].sort());
  }

  it("never sweeps away the caches it is currently using", async () => {
    // The regression this replaces: a second cache was added without being
    // listed in the old CURRENT array, which would have deleted it on the next
    // activation and silently turned a two-cache design back into one.
    const left = await runSweep(["bluestift-shell-v7", "bluestift-build-v7"]);
    expect(left).toEqual(["bluestift-build-v7", "bluestift-shell-v7"]);
  });

  it("keeps the previous BUILD cache, and drops the previous SHELL cache", async () => {
    /*
     * The asymmetry is the whole point, and it is not an optimisation.
     *
     * This worker calls skipWaiting(), so a new version takes over tabs that
     * are already open and running the PREVIOUS build. Those pages fetch chunks
     * lazily, under content hashes that live in the previous build cache — and
     * after a deploy the server no longer has those hashes. Deleting that cache
     * mid-session is what turns a missing chunk into a blank screen.
     *
     * Shell entries have the opposite property: stable paths the server still
     * serves, so dropping one re-fetches the NEW bytes, which is exactly the
     * bust bumping VERSION is for.
     */
    const left = await runSweep([
      "bluestift-shell-v7",
      "bluestift-build-v7",
      "bluestift-shell-v6",
      "bluestift-build-v6",
    ]);
    expect(left).toContain("bluestift-build-v6");
    expect(left).not.toContain("bluestift-shell-v6");
  });

  it("keeps exactly one previous build generation, whatever order the keys arrive in", async () => {
    // Bounded retention, or storage grows without limit on precisely the
    // low-storage devices this worker exists for. `caches.keys()` order is not
    // something to rely on, hence the shuffle.
    const left = await runSweep([
      "bluestift-build-v5",
      "bluestift-build-v7",
      "bluestift-build-v2",
      "bluestift-build-v6",
      "bluestift-shell-v7",
    ]);
    expect(left).toEqual(["bluestift-build-v6", "bluestift-build-v7", "bluestift-shell-v7"]);
  });

  it("removes a cache from an older naming scheme outright", async () => {
    // Not addressable by this worker any more, so it can only be dead weight.
    const left = await runSweep(["bluestift-v6", "bluestift-shell-v7"]);
    expect(left).toEqual(["bluestift-shell-v7"]);
  });

  it("pins the offline page against eviction, and out of the count", () => {
    const trim = body("trim");
    expect(trim).toContain("!== OFFLINE_URL");
    // Counted from the evictable set, not from every key: counting the pinned
    // entry costs a slot and makes each trim delete one fewer than it meant to.
    expect(trim).toMatch(/evictable\.length - max/);
  });

  it("does not block the response on the cache write", () => {
    // Awaiting put + trim before returning puts a write and a full key
    // enumeration on the critical path of every miss — and a first visit is
    // all misses.
    const cf = body("cacheFirst");
    expect(cf).toContain("event.waitUntil(");
    expect(cf).toMatch(/return res;\s*}$/);
  });

  it("enables navigation preload and consumes it", () => {
    expect(SW).toContain("navigationPreload.enable()");
    // Enabling it without reading event.preloadResponse makes the browser warn
    // and wastes the request it started.
    expect(body("networkThenOffline")).toContain("event.preloadResponse");
  });

  it("passes ranged requests through untouched", () => {
    // cache.match ignores Range and would answer the whole file with a 200.
    expect(SW).toMatch(/req\.headers\.has\("range"\)\s*\)\s*return/);
  });
});
