"use client";

import React from "react";
import { RAYA_FONT, RayaName, SchoolsName } from "@/components/ui/brand";

// The wordmarks live in components/ui/brand.tsx (server-safe, shared with the
// public site); re-exported here so the auth surfaces keep one import.
export { RAYA_FONT, RayaName, SchoolsName };

/**
 * Shared visual chrome for the full-screen auth surfaces (onboarding + login),
 * so the two stay pixel-identical. Light-only by design (these screens sit
 * outside the themed app shell). Brand colours mirror the public site
 * (components/site/theme.ts, light variant).
 */

export const WORDMARK_A = "#173d8a";
export const WORDMARK_B = "#2f7fe0";
export const HEAD_FONT = "var(--font-plex), 'IBM Plex Sans', sans-serif";
export const HAND_FONT = "var(--font-caveat), 'Caveat', cursive";

// A gull-in-flight silhouette (two swept wings meeting at a slightly dipped body)
// — the universal "bird" mark. Stroked, not filled, so it never reads as a
// butterfly/X. viewBox 0 0 30 12; `wingFlap` (scaleY) makes the wings beat.
export const BIRD_PATH = "M2 9.5 C 6.5 2.5, 11.5 3, 15 8.5 C 18.5 3, 23.5 2.5, 28 9.5";

/** The BlueStift flagship lockup — bird mark + wordmark in the site colours. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bluestift-mark.png" alt="BlueStift" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      <span style={{ fontSize: size * 0.5, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: HEAD_FONT }}>
        <span style={{ color: WORDMARK_A }}>Blue</span>
        <span style={{ color: WORDMARK_B }}>Stift</span>
      </span>
    </span>
  );
}

// BlueStift blue — the flock colour (matches the site wordmark accent).
const BIRD_BLUE = "#2f7fe0";

/** A single static bird (no animation) — decorative, layer-promotion-free. */
export function StaticBird({ size, color = BIRD_BLUE }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 30 12" style={{ display: "block", flexShrink: 0 }} aria-hidden>
      <path d={BIRD_PATH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FlyingBird({ size, anim, flap, color = BIRD_BLUE, top }: { size: number; anim: string; flap: string; color?: string; top?: number | string }) {
  return (
    <span style={{ position: "absolute", top, width: size, height: size * 0.42, pointerEvents: "none", animation: anim }}>
      <svg width={size} height={size * 0.42} viewBox="0 0 30 12" style={{ display: "block", animation: `wingFlap ${flap} ease-in-out infinite`, transformOrigin: "center" }}>
        <path d={BIRD_PATH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// A continuous flock crossing the screen while undulating. Each bird gets its own
// vertical LANE (`top`) plus varied size / duration / delay, so they stay well
// separated — never stacked on one path, never lined up into a row. `top` values
// span the wrapped sentence so the flock flies AROUND it.
const WELCOME_FLOCK = [
  { size: 24, top: -6, dur: 6.6, delay: 0, flap: "0.22s" },
  { size: 16, top: 16, dur: 5.9, delay: 1.7, flap: "0.20s" },
  { size: 20, top: 38, dur: 7.3, delay: 3.4, flap: "0.24s" },
  { size: 14, top: 60, dur: 6.1, delay: 0.9, flap: "0.18s" },
  { size: 22, top: 82, dur: 7.7, delay: 2.6, flap: "0.23s" },
  { size: 15, top: 104, dur: 6.5, delay: 4.3, flap: "0.19s" },
  { size: 18, top: 126, dur: 7.0, delay: 1.2, flap: "0.21s" },
];

// Fills its (positioned) parent as an overlay, so the flock flies AROUND whatever
// it wraps (the welcome sentence). Parent must be position:relative.
export function Flock() {
  return (
    <div style={{ position: "absolute", inset: "-24px -8px", overflow: "visible", pointerEvents: "none" }} aria-hidden>
      {WELCOME_FLOCK.map((b, i) => (
        <FlyingBird key={i} size={b.size} top={b.top} flap={b.flap} anim={`crossFly ${b.dur}s cubic-bezier(0.4,0,0.6,1) ${b.delay}s infinite`} />
      ))}
    </div>
  );
}

/**
 * Full-screen split: a brand pane (landing gradient + logo + handwritten hook +
 * a small flock) beside a centered content panel. The brand pane collapses under
 * 860px (`.onb-brand`/`.onb-panel`, globals.css). Renders the panel logo at top.
 */
export function AuthSplit({ children, back }: { children: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="onb-root" style={{ minHeight: "100vh", width: "100%", display: "flex", background: "#ffffff" }}>
      <aside
        className="onb-brand"
        style={{
          flex: "1 1 44%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          boxSizing: "border-box",
          background: "linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)",
        }}
      >
        <Logo size={38} />
        <div style={{ position: "relative" }}>
          {/* A single static bird — no animation near the form (avoids GPU-layer
              text blur on Windows), and one bird can't read as a row of "x". The
              lively looping flock lives on the welcome screen. */}
          <div style={{ height: 22, marginBottom: 8 }} aria-hidden>
            <StaticBird size={22} />
          </div>
          <h2 style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: "clamp(2rem,3.4vw,3rem)", lineHeight: 1, margin: 0, color: "#0b1220" }}>
            One account.<br />Everything BlueStift.
          </h2>
          <p style={{ maxWidth: 360, marginTop: 16, fontSize: 16, lineHeight: 1.7, color: "#475569" }}>
            Learn with <RayaName />, teach, or run a whole school — set it up once,
            in a few taps.
          </p>
        </div>
        <span style={{ fontSize: 14, color: "#64748b" }}>AI tutor · any level, any subject, anywhere</span>
      </aside>

      <main
        className="onb-panel"
        style={{
          flex: "1 1 56%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {back}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Logo size={30} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

// -------------------------------------------------------- Shared light styles ---
export const heading: React.CSSProperties = {
  fontFamily: HEAD_FONT,
  fontWeight: 800,
  fontSize: 25,
  letterSpacing: "-0.01em",
  margin: "0 0 6px",
  textAlign: "center",
  color: "#0b1220",
};
export const sub: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  color: "#334155",
  textAlign: "center",
  margin: "0 0 24px",
  lineHeight: 1.6,
};
export const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "#1e293b",
  marginBottom: 6,
};
export const fieldInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "#ffffff",
  color: "#0b1220",
  border: "1.5px solid #cbd5e1",
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 16,
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};
export const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  background: "#0b1220",
  color: "#fff",
  border: "none",
  borderRadius: 99,
  padding: 14,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
export const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0b1220",
  border: "1px solid #dde5ee",
  borderRadius: 99,
  padding: "14px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
