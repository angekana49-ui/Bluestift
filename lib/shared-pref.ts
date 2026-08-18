"use client";

/**
 * Preferences that must survive an ORIGIN HOP.
 *
 * Theme, language and the analytics decision are answers about the person, not
 * about the page, so they have to hold across thebluestift.com, raya. and
 * schools. once the products split (docs/domains.md). `localStorage` cannot do
 * that — it is per-origin, permanently, with no option and no clean workaround.
 * A cookie can, via a parent `domain`.
 *
 * So both are written, and the cookie is read FIRST. That order is the whole
 * point: after the split, each origin keeps its own `localStorage`, so the
 * copy on the origin you are standing on is exactly the one that can be stale.
 * Toggle to light on raya., come back to the site, and a storage-first read
 * would hand you the dark you left there weeks ago. The cookie is the one store
 * every origin writes to, so the cookie is the one that knows.
 *
 * `localStorage` is still written, for two things a cookie cannot do:
 *
 *  - the `storage` event, which is how a change in one tab reaches the others.
 *    Cookies fire no event; dropping storage would silently break cross-tab
 *    sync that both theme hooks rely on today.
 *  - surviving when cookies are refused but storage is not.
 *
 * Neither store is required. Each write is guarded, each read falls through,
 * and with both unavailable the caller simply gets its default.
 *
 * NOTE: this is preferences only. Anything that is user DATA rather than a
 * setting — the outbox, the blob store — stays deliberately per-origin, because
 * a message queued in Raya has no business being visible from Schools. See
 * lib/net/local-data.ts.
 */

const YEAR = 60 * 60 * 24 * 365;

/**
 * The parent domain the preference cookies are scoped to, e.g.
 * ".thebluestift.com". Unset — which is the case on one origin, in local dev
 * and in every preview deployment, none of which have a shared parent — no
 * `domain` attribute is written at all and the cookie stays host-only, exactly
 * as it behaved before. A `domain` that does not match the host is rejected by
 * the browser silently, which is why this is configured rather than hardcoded.
 */
const DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function fromCookie(key: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function fromStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The stored preference, or null. Never throws; null on the server. */
export function readPref(key: string): string | null {
  if (typeof document === "undefined") return null;
  return fromCookie(key) ?? fromStorage(key);
}

/** Persist to both stores. Never throws; a no-op on the server. */
export function writePref(key: string, value: string, maxAge: number = YEAR): void {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage refused (private mode) — the cookie below still carries it
  }
  try {
    const domain = DOMAIN ? `; domain=${DOMAIN}` : "";
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax` +
      `${domain}${secure}`;
  } catch {
    // cookies refused — localStorage above still carries it, per-origin
  }
}

/**
 * Whether a preference can be persisted AT ALL — probed by round-tripping a
 * throwaway value through each store, because neither one reports its own
 * unavailability honestly: `localStorage` throws, while `document.cookie`
 * silently accepts a write and drops it.
 *
 * This exists for one thing: a prompt that must never nag. Something that shows
 * once and records that it asked is fine when the recording works; when nothing
 * can be stored it would show on every single page load. The right behaviour
 * there is to stay quiet, and that requires telling "not answered" apart from
 * "cannot remember an answer" — which `readPref` alone cannot do, since both
 * come back as null.
 */
export function prefsUsable(): boolean {
  if (typeof document === "undefined") return false;
  const probe = "__bs_probe";
  try {
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // storage refused — a cookie may still work, so keep going
  }
  try {
    document.cookie = `${probe}=1; path=/; max-age=60; samesite=lax`;
    const ok = document.cookie.includes(`${probe}=1`);
    document.cookie = `${probe}=; path=/; max-age=0; samesite=lax`;
    return ok;
  } catch {
    return false;
  }
}
