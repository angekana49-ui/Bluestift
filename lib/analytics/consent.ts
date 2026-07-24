"use client";

// Analytics consent decision, persisted client-side (localStorage). Opt-in: until
// the user grants consent, PostHog stays opted OUT and captures nothing. A denial
// is remembered too, so the banner doesn't reappear every visit.

export type ConsentDecision = "granted" | "denied";
/** Shared by the client (localStorage + cookie) and the server (reads the cookie). */
export const CONSENT_COOKIE = "bs_analytics_consent";
const STORAGE_KEY = CONSENT_COOKIE;
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The stored decision, or null if the user hasn't chosen yet. Never throws. */
export function getConsent(): ConsentDecision | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
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
    // storage unavailable (private mode / disabled) — analytics simply stays off
  }
  try {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${decision}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
  } catch {
    // cookie write blocked — server-side events just stay off
  }
}
