"use client";

import { useEffect, useRef, useState } from "react";
import { useResolvedTheme } from "@/components/ui/theme";
import { useTranslate } from "@/components/ui/locale";
import { useOnlineStatus } from "@/lib/net/online";

/**
 * The app's honest-connectivity strip. Renders nothing while the network is
 * healthy; a slim banner when the browser is offline or the link is degraded
 * (repeated fetch failures — see lib/net/online.ts); and a brief "back online"
 * confirmation when connectivity returns, so recovery is as visible as loss.
 *
 * Uses `useResolvedTheme` (context when inside a scaffold, standalone
 * otherwise) — the same trick as `useTranslate` — because this renders on
 * surfaces that sit outside AppThemeProvider, like the chat composer.
 */
export function DegradedBanner() {
  const { dark } = useResolvedTheme();
  const tr = useTranslate();
  const { online, degraded } = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  const wasBad = useRef(false);

  const bad = !online || degraded;
  useEffect(() => {
    if (bad) {
      wasBad.current = true;
      setJustReconnected(false);
      return;
    }
    if (!wasBad.current) return;
    wasBad.current = false;
    setJustReconnected(true);
    const timer = setTimeout(() => setJustReconnected(false), 3000);
    return () => clearTimeout(timer);
  }, [bad]);

  if (!bad && !justReconnected) return null;

  const label = !online
    ? tr("net.offline")
    : degraded
      ? tr("net.degraded")
      : tr("net.reconnected");
  // Amber while degraded/offline, muted green once back.
  const tone = bad
    ? { bg: dark ? "rgba(180,120,0,0.18)" : "rgba(180,120,0,0.10)", fg: dark ? "#eab308" : "#92600a" }
    : { bg: dark ? "rgba(22,163,74,0.16)" : "rgba(22,163,74,0.10)", fg: dark ? "#4ade80" : "#15803d" };

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 13,
        borderRadius: 8,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}
