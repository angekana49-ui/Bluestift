"use client";

import React from "react";
import { HAND_FONT, Logo, SineFlock, primaryBtn } from "@/components/ui/auth-chrome";

/**
 * The layer between onboarding and Schools: the school form and the teacher's
 * join form. Light-only, like the other full-screen auth surfaces.
 *
 * The ground is the welcome screen's blue, so leaving onboarding does not feel
 * like leaving the product. The card is white fading very slightly into that
 * blue, which keeps a long form readable without a hard white slab on top.
 */
export const WELCOME_BLUE = "linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)";

export const layerCard: React.CSSProperties = {
  position: "relative",
  background: "linear-gradient(180deg,#ffffff 0%,#ffffff 55%,rgba(255,255,255,0.88) 100%)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 22,
  boxShadow: "0 24px 60px rgba(23,61,138,0.12), 0 2px 6px rgba(11,18,32,0.05)",
  padding: "32px clamp(18px, 4vw, 40px)",
  boxSizing: "border-box",
};

export function LayerShell({
  children,
  maxWidth = 720,
  top,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  /** A link above the card (switch role, back). */
  top?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: WELCOME_BLUE,
        boxSizing: "border-box",
        paddingInline: 16,
        paddingBlock: "32px 56px",
      }}
    >
      <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <Logo size={34} />
          {top}
        </div>
        <div style={layerCard}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The last card: the sentence, the flock flying sine waves around it, and one
 * black button onward. Also used for a request an admin still has to approve,
 * so the caller chooses words that claim no more than what happened.
 */
export function AllSetCard({
  title,
  body,
  cta,
  onCta,
}: {
  title: React.ReactNode;
  body: React.ReactNode;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div style={{ position: "relative", textAlign: "center", padding: "36px 8px 8px", overflow: "hidden" }}>
      <div style={{ position: "relative", padding: "42px 0" }}>
        <SineFlock />
        <h1
          style={{
            position: "relative",
            zIndex: 1,
            fontFamily: HAND_FONT,
            fontWeight: 700,
            fontSize: "clamp(2.3rem,7vw,3.3rem)",
            lineHeight: 1.05,
            margin: 0,
            color: "#0b1220",
            animation: "writeReveal 2.2s cubic-bezier(0.65,0,0.35,1) 0.2s 1 both",
          }}
        >
          {title}
        </h1>
      </div>
      <p style={{ maxWidth: 440, margin: "10px auto 0", fontSize: 17, lineHeight: 1.7, color: "#475569" }}>{body}</p>
      <button onClick={onCta} style={{ ...primaryBtn, width: "auto", padding: "14px 30px", marginTop: 26 }}>
        {cta}
      </button>
    </div>
  );
}
