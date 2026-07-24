"use client";

// Analytics consent decision, persisted client-side (localStorage). Opt-in: until
// the user grants consent, PostHog stays opted OUT and captures nothing. A denial
// is remembered too, so the banner doesn't reappear every visit.

export type ConsentDecision = "granted" | "denied";
const STORAGE_KEY = "bs_analytics_consent";

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

/** Persist the user's choice. Never throws. */
export function setConsent(decision: ConsentDecision): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, decision);
  } catch {
    // storage unavailable (private mode / disabled) — analytics simply stays off
  }
}
