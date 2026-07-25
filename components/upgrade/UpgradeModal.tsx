"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UPGRADE_EVENT, installUpgradeInterceptor, type UpgradeDetail } from "@/lib/upgrade";

/**
 * App-wide "upgrade to continue" modal. Installs the fetch interceptor on mount
 * and opens whenever an entitlement gate fires (or a room action dispatches one).
 * Styled neutrally (dark card over a dimmed overlay) so it reads on both themes,
 * matching the consent banner.
 */
export function UpgradeModal() {
  const [detail, setDetail] = useState<UpgradeDetail | null>(null);

  useEffect(() => {
    installUpgradeInterceptor();
    const onEvt = (e: Event) => setDetail((e as CustomEvent<UpgradeDetail>).detail);
    window.addEventListener(UPGRADE_EVENT, onEvt);
    return () => window.removeEventListener(UPGRADE_EVENT, onEvt);
  }, []);

  if (!detail) return null;

  const isQuota = detail.code === "quota_reached";
  const title = isQuota ? "You've reached a plan limit" : "This is a premium feature";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => setDetail(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483001,
        background: "rgba(4,10,24,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#0b1220",
          color: "#eef2f8",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          padding: "26px 24px",
          boxShadow: "0 24px 60px rgba(4,10,24,0.5)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: "rgba(59,110,245,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l2.5 5.2 5.7.8-4.1 4 1 5.7L12 21l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3z"
              stroke="#8ab4ff"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#cdd6e4", margin: "0 0 20px" }}>
          {detail.message}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={() => setDetail(null)}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "#cdd6e4",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Not now
          </button>
          <Link
            href="/pricing"
            onClick={() => setDetail(null)}
            style={{
              background: "#3b6ef5",
              color: "#ffffff",
              borderRadius: 999,
              padding: "9px 22px",
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            See plans
          </Link>
        </div>
      </div>
    </div>
  );
}
