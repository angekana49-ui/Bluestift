"use client";

import type { PostHog } from "posthog-js";
import { getConsent } from "./consent";

/**
 * PostHog, loaded ON DEMAND.
 *
 * The SDK used to be a static import in the provider, so ~60KB of analytics
 * shipped in the shared bundle of every page — including for the majority of
 * visitors who never consent, and on the metered connections this product is
 * built for. Now nothing is downloaded until consent is actually granted.
 *
 * Everything here is best-effort and silent: analytics must never be able to
 * break, block or slow a page.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let instance: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const readyCallbacks = new Set<(ph: PostHog) => void>();

/** Configured and enabled? Cheap, synchronous, no download. */
export function analyticsAvailable(): boolean {
  return Boolean(POSTHOG_KEY);
}

/** The loaded SDK, or null if it isn't loaded — never triggers a download. */
export function posthogIfLoaded(): PostHog | null {
  return instance;
}

/** True when we're allowed to capture right now. */
export function capturing(): boolean {
  return Boolean(instance?.has_opted_in_capturing?.());
}

/**
 * Download + initialise PostHog. Call this ONLY once consent is granted (or
 * restored from a previous visit). Concurrent calls share one download.
 */
export function loadPostHog(): Promise<PostHog | null> {
  if (instance) return Promise.resolve(instance);
  if (loading) return loading;
  if (!POSTHOG_KEY || typeof window === "undefined") return Promise.resolve(null);

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Only create a person profile once a user is identified (privacy-friendlier;
        // anonymous visitors stay anonymous until they sign in).
        person_profiles: "identified_only",
        // We send $pageview manually on route change (App Router doesn't do full
        // page loads), so disable the automatic one to avoid duplicates.
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: true,
        // Still opt-out by default: the SDK only loads after consent, but this
        // keeps "loaded" and "allowed to capture" as two separate facts.
        opt_out_capturing_by_default: true,
      });
      instance = posthog;
      readyCallbacks.forEach((cb) => cb(posthog));
      return posthog;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** Load + opt in, in one step (the Accept button). */
export async function enableAnalytics(): Promise<PostHog | null> {
  const ph = await loadPostHog();
  ph?.opt_in_capturing();
  return ph;
}

/** Opt out. Nothing to do if the SDK was never downloaded. */
export function disableAnalytics(): void {
  instance?.opt_out_capturing();
}

/**
 * Restore a previous "granted" decision, deferred to idle so analytics never
 * competes with the first paint. No-ops for everyone else — which is the point.
 */
export function restoreAnalyticsConsent(): void {
  if (!POSTHOG_KEY || getConsent() !== "granted") return;
  const start = () => void enableAnalytics();
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 1500);
  }
}

/** Run `cb` when (and if) the SDK becomes available. Returns an unsubscribe. */
export function onPostHogReady(cb: (ph: PostHog) => void): () => void {
  if (instance) {
    cb(instance);
    return () => {};
  }
  readyCallbacks.add(cb);
  return () => {
    readyCallbacks.delete(cb);
  };
}
