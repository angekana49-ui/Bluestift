"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { PostHog } from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import {
  analyticsAvailable,
  capturing,
  disableAnalytics,
  onPostHogReady,
  posthogIfLoaded,
  restoreAnalyticsConsent,
} from "@/lib/analytics/posthog-lazy";
import { setConsent } from "@/lib/analytics/consent";
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

/**
 * Minors cannot validly consent to product analytics, so for them the banner is
 * not shown and any consent already on the device is revoked — including one
 * granted before they signed in, or before they told us their age.
 *
 * The server is the authority (lib/compliance/optional-processing.ts gates
 * server-side events regardless of what the browser does); this exists so the
 * SDK is never downloaded and no event is captured in the first place.
 * Signed-out visitors get a 401 and are left alone — we know nothing about
 * their age, and the banner is the right answer for an unknown visitor.
 */
function useMinorLockout(): boolean {
  const [minor, setMinor] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/account/age");
        if (!res.ok) return;
        const { band } = (await res.json()) as { band: string | null };
        if (!active || band === "adult") return;
        setMinor(true);
        setConsent("denied");
        disableAnalytics();
      } catch {
        // Unreachable check → leave the banner alone. The server-side gate
        // still holds, so this failing can't turn analytics ON for a minor.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return minor;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // A returning visitor who already accepted gets the SDK back — at idle, so it
  // never competes with the first paint.
  useEffect(() => {
    restoreAnalyticsConsent();
  }, []);

  const minor = useMinorLockout();

  if (!analyticsAvailable()) return <>{children}</>;

  return (
    <>
      {children}
      {/* useSearchParams must sit under a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentifyBridge />
      {!minor && <ConsentBanner />}
    </>
  );
}
