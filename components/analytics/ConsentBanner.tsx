"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { getConsent, setConsent } from "@/lib/analytics/consent";
import { createClient } from "@/lib/supabase/client";

/**
 * Opt-in cookie/analytics banner. Shown only until the user makes a choice.
 * Accept → PostHog opts in, then backfills the current pageview + identity.
 * Decline → PostHog opts out and stays silent. Styled neutrally so it reads on
 * both the day and night themes.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);

  // Decide on the client only (localStorage) — avoids an SSR/first-paint flash
  // for visitors who already chose.
  useEffect(() => {
    setShow(getConsent() === null);
  }, []);

  if (!show) return null;

  async function accept() {
    setConsent("granted");
    setShow(false);
    posthog.opt_in_capturing();
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
    posthog.opt_out_capturing();
  }

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 2147483000,
        maxWidth: 380,
        background: "#0b1220",
        color: "#eef2f8",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: "0 16px 40px rgba(4,10,24,0.45)",
        fontSize: 13,
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
            fontSize: 12.5,
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
            fontSize: 12.5,
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
