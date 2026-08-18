"use client";

// Analytics consent decision. Opt-in: until the user grants consent, PostHog
// stays opted OUT and captures nothing. A denial is remembered too, so the
// banner doesn't reappear every visit.

import { readPref, writePref } from "@/lib/shared-pref";

export type ConsentDecision = "granted" | "denied";
/** Shared by the client (localStorage + cookie) and the server (reads the cookie). */
export const CONSENT_COOKIE = "bs_analytics_consent";

/**
 * The stored decision, or null if the user hasn't chosen yet. Never throws.
 *
 * Both stores are read (see lib/shared-pref.ts). Two things were wrong with
 * reading only localStorage, as this did:
 *
 *  - in private mode the storage write throws and only the cookie lands, so
 *    someone who HAD answered was asked again on every single visit;
 *  - server routes gate on the cookie (`CONSENT_COOKIE`), so the banner and the
 *    server could disagree about whether consent existed at all.
 *
 * The cookie wins on read, which matters most here of anywhere: it is the store
 * that spans origins, so it is the one that holds a WITHDRAWAL made elsewhere.
 * Honouring a stale "granted" would mean processing without consent.
 */
export function getConsent(): ConsentDecision | null {
  const v = readPref(CONSENT_COOKIE);
  return v === "granted" || v === "denied" ? v : null;
}

/**
 * Persist the user's choice in BOTH localStorage (for the banner and the
 * cross-tab event) and a cookie (so server routes can honour consent before
 * emitting server-side events). The cookie is intentionally not httpOnly — the
 * client writes it. Never throws.
 */
export function setConsent(decision: ConsentDecision): void {
  writePref(CONSENT_COOKIE, decision);
}
