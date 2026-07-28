"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { PostHog } from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import {
  analyticsAvailable,
  capturing,
  onPostHogReady,
  posthogIfLoaded,
  restoreAnalyticsConsent,
} from "@/lib/analytics/posthog-lazy";
import { ConsentBanner } from "./ConsentBanner";

/**
 * App-wide analytics wiring. The SDK itself is NOT imported here — it is
 * downloaded only once consent is granted (see lib/analytics/posthog-lazy.ts),
 * so a visitor who declines, or hasn't chosen yet, pays zero bytes for it.
 * Passes through untouched when analytics is unconfigured.
 */

/** Re-renders once the SDK is actually available. */
function useLoadedPostHog(): PostHog | null {
  const [ph, setPh] = useState<PostHog | null>(() => posthogIfLoaded());
  useEffect(() => onPostHogReady(setPh), []);
  return ph;
}

/** Send a $pageview on every App Router navigation — only while opted in. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = useLoadedPostHog();

  useEffect(() => {
    if (!ph || !pathname || !capturing()) return;
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
 * by consent so we never identify an opted-out visitor. Only mounts a Supabase
 * auth listener once the SDK is loaded, i.e. only for consenting visitors.
 */
function IdentifyBridge() {
  const ph = useLoadedPostHog();

  useEffect(() => {
    if (!ph) return;
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user && capturing()) ph.identify(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!capturing()) return;
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

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // A returning visitor who already accepted gets the SDK back — at idle, so it
  // never competes with the first paint.
  useEffect(() => {
    restoreAnalyticsConsent();
  }, []);

  if (!analyticsAvailable()) return <>{children}</>;

  return (
    <>
      {children}
      {/* useSearchParams must sit under a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentifyBridge />
      <ConsentBanner />
    </>
  );
}
