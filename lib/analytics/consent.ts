"use client";

// Analytics consent decision, persisted client-side. Opt-in: until the user
// grants consent, PostHog stays opted OUT and captures nothing. A denial is
// remembered too, so the banner doesn't reappear every visit.

export type ConsentDecision = "granted" | "denied";
/** Shared by the client (localStorage + cookie) and the server (reads the cookie). */
export const CONSENT_COOKIE = "bs_analytics_consent";
const STORAGE_KEY = CONSENT_COOKIE;
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Anything that isn't one of the two decisions is "hasn't chosen yet". */
function parse(value: string | null | undefined): ConsentDecision | null {
  return value === "granted" || value === "denied" ? value : null;
}

function fromStorage(): ConsentDecision | null {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function fromCookie(): ConsentDecision | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`));
    return parse(m ? decodeURIComponent(m[1]) : null);
  } catch {
    return null;
  }
}

/**
 * The stored decision, or null if the user hasn't chosen yet. Never throws.
 *
 * Reads BOTH stores, because `setConsent` writes both and either write can be
 * the one that survived:
 *
 *  - In private mode the localStorage write throws and only the cookie lands.
 *    Reading storage alone made that user re-answer the banner every single
 *    visit, with their decision sitting in a cookie the whole time.
 *  - localStorage is per-origin and can never be shared across one; a cookie
 *    can. When the products split across subdomains (docs/domains.md) the
 *    cookie is what carries the answer from one to the next.
 *
 * Storage is read first because it is what this function has always read, so
 * nobody's answer changes meaning; the cookie only ever supplies one where
 * there was none.
 */
export function getConsent(): ConsentDecision | null {
  if (typeof window === "undefined") return null;
  return fromStorage() ?? fromCookie();
}

/**
 * Persist the user's choice in BOTH localStorage (for the banner) and a cookie
 * (so server routes can honour consent before emitting server-side events). The
 * cookie is intentionally not httpOnly — the client writes it. Never throws.
 */
export function setConsent(decision: ConsentDecision): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, decision);
  } catch {
    // storage unavailable (private mode / disabled) — the cookie below still lands
  }
  try {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${decision}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
  } catch {
    // cookie write blocked — server-side events just stay off
  }
}
