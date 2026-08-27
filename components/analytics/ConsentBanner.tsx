"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/analytics/consent";
import { enableAnalytics, disableAnalytics } from "@/lib/analytics/posthog-lazy";
import { createClient } from "@/lib/supabase/client";

// The banner's own inset from the viewport edge (see `bottom` below) — read
// back into the published height so a stacking neighbour clears the banner
// itself, not just its content box.
const BOTTOM_INSET = 16;

/**
 * Opt-in cookie/analytics banner. Shown only until the user makes a choice.
 * Accept → PostHog opts in, then backfills the current pageview + identity.
 * Decline → PostHog opts out and stays silent. Styled neutrally so it reads on
 * both the day and night themes.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Decide on the client only (localStorage) — avoids an SSR/first-paint flash
  // for visitors who already chose.
  useEffect(() => {
    setShow(getConsent() === null);
  }, []);

  // Publish the banner's real footprint as a CSS var so anything else that
  // also anchors to the bottom of the viewport (the public site's first-visit
  // LanguagePrompt) can stack above it instead of guessing a pixel offset —
  // or, worse, both landing at `bottom: 0` and overlapping outright, which is
  // exactly what used to hide the language bar behind this banner's much
  // higher z-index on most laptop/mobile widths. Falls back to 0px (flush
  // with the viewport edge) wherever this banner isn't showing.
  useEffect(() => {
    const el = boxRef.current;
    if (!show || !el) {
      document.documentElement.style.removeProperty("--bs-consent-h");
      return;
    }
    const GAP = 12;
    const publish = () => {
      document.documentElement.style.setProperty("--bs-consent-h", `${BOTTOM_INSET + el.offsetHeight + GAP}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--bs-consent-h");
    };
  }, [show]);

  if (!show) return null;

  async function accept() {
    setConsent("granted");
    setShow(false);
    // Accepting is what downloads the SDK — until this moment the visitor has
    // paid nothing for analytics.
    const posthog = await enableAnalytics();
    if (!posthog) return;
    posthog.capture("$pageview");
    try {
      const { data } = await createClient().auth.getUser();
      if (data.user) posthog.identify(data.user.id);
    } catch {
      // identity is best-effort; capturing is already on
    }
  }

  function decline() {
    setConsent("denied");
    setShow(false);
    // Nothing to opt out of — the SDK was never loaded.
    disableAnalytics();
  }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Analytics consent"
      style={{
        position: "fixed",
        left: 16,
        bottom: BOTTOM_INSET,
        zIndex: 2147483000,
        maxWidth: 380,
        background: "#0b1220",
        color: "#eef2f8",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: "0 16px 40px rgba(4,10,24,0.45)",
        fontSize: 15,
        lineHeight: 1.55,
      }}
    >
      <p style={{ margin: "0 0 12px" }}>
        We use privacy-friendly analytics to understand how Bluestift is used and make it better —
        no ads, and we never sell your data. You can decline and keep using everything.{" "}
        <Link href="/privacy" style={{ color: "#8ab4ff", textDecoration: "underline" }}>
          Privacy
        </Link>
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={decline}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "#cdd6e4",
            borderRadius: 999,
            padding: "7px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            border: "none",
            background: "#3b6ef5",
            color: "#ffffff",
            borderRadius: 999,
            padding: "7px 18px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
