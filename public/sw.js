/*
 * Bluestift service worker — written by hand, no framework.
 *
 * Two jobs, in priority order:
 *
 *  1. CUT DATA. Everything under /_next/static and every image in /public is
 *     content-hashed or stable, so it is cached and served from disk. After the
 *     first visit a repeat open downloads essentially only the HTML. On a
 *     metered 2G/3G plan that is the difference between ~1MB and ~30KB.
 *
 *  2. OPEN OFFLINE. A navigation with no network falls back to a cached page
 *     that says so honestly. It does NOT pretend the app works: Raya's replies
 *     are generated server-side and every page is an authenticated Server
 *     Component, so there is no logged-in experience to serve from cache. What
 *     it buys is a real screen instead of the browser's dinosaur, plus the
 *     student's queued messages (see lib/net/outbox.ts) surviving until the
 *     link returns.
 *
 * Deliberately NOT cached: any /api/* response and any HTML document — the
 * marketing pages included. app/page.tsx renders `signedIn` and a `homeHref`
 * resolved from the session, so even "/" is a different document per visitor;
 * on a shared school machine a cached copy would hand the next student the
 * previous one's chrome. A stale API response is worse than none.
 *
 * Deliberately NOT stale-while-revalidate. SWR is the reflex for an asset
 * cache and it is the wrong trade here: it pays a request for every asset on
 * every visit to keep a copy fresh that is either content-hashed (cannot go
 * stale) or busted by VERSION below. On a metered plan that spends the
 * visitor's data to solve a problem they do not have.
 */

// Bump on any change to a STABLE public asset. The shell cache never
// revalidates, so a file that keeps its name but changes its bytes (the brand
// marks did) would otherwise be served from the old cache forever. Bumping the
// version renames both caches, and `activate` deletes every cache that is not
// current — that is the only cache-bust this worker has.
const VERSION = "v7";

/*
 * Two caches, because the two kinds of asset have opposite lifetimes and one
 * shared budget let the short-lived kind evict the long-lived one.
 *
 * /_next/static churns completely on every deploy: new content hashes, new
 * filenames, dozens of entries. /public does not change for months. With both
 * in one 120-entry cache, a single deploy's chunks would push the icons, the
 * brand marks and the launch screens out — and the next open would re-download
 * images the visitor had already paid for once. That is precisely the bill
 * this worker exists to avoid, so the two now have separate budgets and cannot
 * evict each other.
 */
const SHELL_CACHE = `bluestift-shell-${VERSION}`;
const BUILD_CACHE = `bluestift-build-${VERSION}`;
const CURRENT = [SHELL_CACHE, BUILD_CACHE];

const OFFLINE_URL = "/offline.html";

/**
 * Caps on cached entries, per cache. Next.js content-hashes its chunks, so
 * every deploy mints new filenames and the old ones would otherwise sit here
 * forever — unbounded growth on exactly the low-storage devices this product
 * targets. /public is a known, small set that barely moves.
 */
const MAX_BUILD = 160;
const MAX_SHELL = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // Nothing else is precached on purpose: pulling the icons and launch
      // screens down on first visit would spend data on files most visitors
      // never see. They are cached lazily, when something actually asks.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /*
       * Navigation preload — the one free latency win available here.
       *
       * A navigation handled by a service worker cannot start until the worker
       * has booted, and on a cold low-end device booting costs real time before
       * a single byte has been requested. With preload enabled the browser
       * fires the network request in parallel with that boot, and
       * `event.preloadResponse` below is that already-in-flight request. It
       * changes nothing about what is cached and costs no extra data — the same
       * one request, started earlier.
       */
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !CURRENT.includes(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Stable public assets: same name for months, so cached until VERSION moves. */
const STABLE_ASSET = /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  /*
   * A ranged request goes straight to the network. `cache.match` ignores the
   * Range header and would answer with the whole file and a 200, which is not
   * what the caller asked for — it breaks seeking in a <video> and confuses
   * any partial-content consumer. Nothing served through this worker is
   * ranged today; this keeps that true if a media file is ever added to the
   * pattern below.
   */
  if (req.headers.has("range")) return;

  const url = new URL(req.url);
  // Same-origin only: a cross-origin response (Supabase, PostHog, fonts on
  // another host) is none of our business and may be opaque.
  if (url.origin !== self.location.origin) return;
  // Never touch the API — see the header comment.
  if (url.pathname.startsWith("/api/")) return;

  // Content-hashed build output. The filename IS the version, so a hit can
  // never be stale and revalidating it could only ever waste a request.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, BUILD_CACHE, MAX_BUILD));
    return;
  }

  if (STABLE_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(event, SHELL_CACHE, MAX_SHELL));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(networkThenOffline(event));
  }
});

/** Serve from cache, fall back to network, and store what we fetch. */
async function cacheFirst(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  if (hit) return hit;

  // A missing asset offline is better left as a network error than faked, so
  // this is deliberately not wrapped: the rejection is the honest answer.
  const res = await fetch(event.request);

  // Only cache a genuine, complete response (not a 206 or an error page).
  if (res.ok && res.status === 200) {
    /*
     * Hand the response back now, pay for the write afterwards.
     *
     * This used to await `cache.put` and then a full `trim` before returning,
     * which put a cache write AND an enumeration of every key in the cache on
     * the critical path of every miss — and on a first visit every asset is a
     * miss. `waitUntil` keeps the worker alive for the write without making
     * the page wait for it.
     */
    const copy = res.clone();
    event.waitUntil(
      (async () => {
        await cache.put(event.request, copy);
        await trim(cache, max);
      })(),
    );
  }
  return res;
}

/** Evict oldest-first past `max`; never evict the offline page. */
async function trim(cache, max) {
  const keys = await cache.keys();
  /*
   * The offline page is pinned, and excluded from the count as well as from
   * the eviction. It was previously skipped only when deleting while still
   * counting towards the budget, which quietly cost one slot and — once the
   * cache was full — meant every trim deleted one entry fewer than it meant
   * to. It is the one entry whose absence turns a failed navigation back into
   * the browser's error screen.
   */
  const evictable = keys.filter((k) => new URL(k.url).pathname !== OFFLINE_URL);
  const excess = evictable.length - max;
  if (excess <= 0) return;
  // Cache keys come back in insertion order, so this drops what was written
  // longest ago — after a deploy, the chunks of the build nobody is running.
  await Promise.all(evictable.slice(0, excess).map((k) => cache.delete(k)));
}

/**
 * Documents always come from the network — never cached, never stale. When the
 * network fails, the offline page explains what's happening.
 */
async function networkThenOffline(event) {
  try {
    // The request the browser started while this worker was waking up. Present
    // only where navigation preload is supported; `fetch` is the same request
    // everywhere else, just started later.
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
    );
  }
}
