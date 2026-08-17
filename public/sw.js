/*
 * Bluestift service worker — written by hand, no framework.
 *
 * Two jobs, in priority order:
 *
 *  1. CUT DATA. Everything under /_next/static and every image in /public is
 *     content-hashed or stable, so it is cached forever and served from disk.
 *     After the first visit a repeat open downloads essentially only the HTML.
 *     On a metered 2G/3G plan that is the difference between ~1MB and ~30KB.
 *
 *  2. OPEN OFFLINE. A navigation with no network falls back to a cached page
 *     that says so honestly. It does NOT pretend the app works: Raya's replies
 *     are generated server-side and every page is an authenticated Server
 *     Component, so there is no logged-in experience to serve from cache. What
 *     it buys is a real screen instead of the browser's dinosaur, plus the
 *     student's queued messages (see lib/net/outbox.ts) surviving until the
 *     link returns.
 *
 * Deliberately NOT cached: any /api/* response and any HTML document. Caching
 * authenticated HTML on a shared school machine would leak one student's page
 * to the next, and a stale API response is worse than none.
 */

// Bump on any change to a STABLE public asset. `cacheFirst` never revalidates a
// /public image, so a file that keeps its name but changes its bytes (the brand
// marks did) would otherwise be served from the old cache forever. Bumping the
// version renames the cache, and `activate` deletes every cache but the current
// one — that is the only cache-bust this worker has.
const VERSION = "v4";
const STATIC_CACHE = `bluestift-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
/**
 * Cap on cached entries. Next.js content-hashes its chunks, so every deploy
 * mints new filenames and the old ones would otherwise sit here forever —
 * unbounded growth on exactly the low-storage devices this product targets.
 */
const MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // Take over as soon as this version is ready — the previous worker's
      // caches are dropped in `activate`, so we never mix two builds.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Immutable build output + stable public assets: safe to cache forever. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Same-origin only: a cross-origin response (Supabase, PostHog, fonts on
  // another host) is none of our business and may be opaque.
  if (url.origin !== self.location.origin) return;
  // Never touch the API — see the header comment.
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(networkThenOffline(req));
  }
});

/** Serve from cache, fall back to network, and store what we fetch. */
async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Only cache a genuine, complete response (not a 206 or an error page).
    if (res.ok && res.status === 200) {
      await cache.put(req, res.clone());
      await trim(cache);
    }
    return res;
  } catch (err) {
    // A missing asset offline is better left as a network error than faked.
    throw err;
  }
}

/** Evict oldest-first past MAX_ENTRIES; never evict the offline page. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const excess = keys.length - MAX_ENTRIES;
  let removed = 0;
  for (const key of keys) {
    if (removed >= excess) break;
    if (new URL(key.url).pathname === OFFLINE_URL) continue;
    await cache.delete(key);
    removed++;
  }
}

/**
 * Documents always come from the network — never cached, never stale. When the
 * network fails, the offline page explains what's happening.
 */
async function networkThenOffline(req) {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
    );
  }
}
