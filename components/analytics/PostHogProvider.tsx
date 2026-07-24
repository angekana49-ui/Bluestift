"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";
import { getConsent } from "@/lib/analytics/consent";
import { ConsentBanner } from "./ConsentBanner";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialized = false;

/**
 * Initialize PostHog once, opted OUT by default so nothing is captured before the
 * user consents. If a prior "granted" decision is stored, we opt back in as soon
 * as the SDK loads. No-ops entirely when NEXT_PUBLIC_POSTHOG_KEY is unset, so the
 * app runs fine before analytics is configured.
 */
function ensureInit(): void {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Only create a person profile once a user is identified (privacy-friendlier;
    // anonymous visitors stay anonymous until they sign in).
    person_profiles: "identified_only",
    // We send $pageview manually on route change (App Router doesn't do full page
    // loads), so disable the automatic one to avoid duplicates.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: true,
    opt_out_capturing_by_default: true,
    loaded: (ph) => {
      if (getConsent() === "granted") ph.opt_in_capturing();
    },
  });
  initialized = true;
}

/** Send a $pageview on every App Router navigation — only while opted in. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph || !pathname || !ph.has_opted_in_capturing?.()) return;
    let url = window.location.origin + pathname;
    const q = searchParams?.toString();
    if (q) url += `?${q}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

/**
 * Tie PostHog's identity to the Supabase user: identify by user.id on sign-in
 * (including anonymous accounts — that id is stable), reset on sign-out. Guarded
 * by consent so we never identify an opted-out visitor.
 */
function IdentifyBridge() {
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user && ph.has_opted_in_capturing?.()) ph.identify(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ph.has_opted_in_capturing?.()) return;
      if (event === "SIGNED_OUT") ph.reset();
      else if (session?.user) ph.identify(session.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [ph]);

  return null;
}

/** App-wide analytics provider. Passes through untouched when analytics is off. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureInit();
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      {children}
      {/* useSearchParams must sit under a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentifyBridge />
      <ConsentBanner />
    </PHProvider>
  );
}
