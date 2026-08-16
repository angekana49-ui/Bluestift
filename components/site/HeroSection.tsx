"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import CloudBackground from "./CloudBackground";
import DashboardMockup from "./DashboardMockup";
import { GUTTER, LEAD, MEASURE, PAGE_TOP, SECTION_Y } from "./layout";

const BIRD_PATH =
  "M12 6 C9 2 4 1 0 3 C4 4 7 6 9 8 C7 10 4 12 0 13 C4 15 9 14 12 10 C15 14 20 15 24 13 C20 12 17 10 15 8 C17 6 20 4 24 3 C20 1 15 2 12 6 Z";

const CHIP_KEYS = ["site.hero.chip.free", "site.hero.chip.noCard", "site.hero.chip.solo"] as const;

export default function HeroSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        // The bottom used to be 180, which stacked with the next section's own
        // 96 into ~280px of empty sky under the dashboard — long enough to read
        // as the page having ended. SECTION_Y is that same 96, so the hero now
        // closes on the rhythm every band below it keeps.
        padding: `${PAGE_TOP}px ${GUTTER}px ${SECTION_Y}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <CloudBackground theme={t} variant="hero" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: MEASURE.text }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: t.chipBg,
            border: `1px solid ${t.chipBorder}`,
            borderRadius: 999,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 20,
            color: t.text,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.text }} />
          {tr("site.hero.eyebrow")}
        </div>

        <div style={{ position: "relative", display: "inline-block", maxWidth: MEASURE.text }}>
          <h1
            style={{
              fontFamily: "var(--font-caveat),'Caveat',cursive",
              fontWeight: 700,
              fontSize: "clamp(3.2rem,9vw,6.4rem)",
              lineHeight: 0.92,
              margin: 0,
              color: t.text,
              animation: "writeReveal 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both",
            }}
          >
            {tr("site.hero.headline")}
          </h1>
          <span style={{ position: "absolute", width: 22, height: 16, pointerEvents: "none", animation: "birdFly 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both" }}>
            <svg width="22" height="16" viewBox="0 0 24 16" style={{ display: "block", animation: "wingFlap 0.22s ease-in-out infinite", transformOrigin: "center" }}>
              <path d={BIRD_PATH} fill={t.birdColor} />
            </svg>
          </span>
          <span style={{ position: "absolute", width: 16, height: 12, pointerEvents: "none", animation: "birdFly2 2.8s cubic-bezier(0.65,0,0.35,1) 0.55s 1 both" }}>
            <svg width="16" height="12" viewBox="0 0 24 16" style={{ display: "block", animation: "wingFlap 0.19s ease-in-out infinite", transformOrigin: "center" }}>
              <path d={BIRD_PATH} fill={t.birdColor} />
            </svg>
          </span>
        </div>

        <p style={{ maxWidth: LEAD, margin: "20px auto 0", fontSize: 18, lineHeight: 1.7, color: t.text }}>
          <RayaText>{tr("site.hero.sub")}</RayaText>
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <a
            href="/login"
            className="pub-press"
            style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "13px 24px", fontSize: 16, fontWeight: 500, textDecoration: "none" }}
          >
            {tr("site.hero.ctaPrimary")}
          </a>
          <a
            href="#how-it-works"
            className="pub-press"
            style={{ background: t.chipBg, border: `1px solid ${t.chipBorder}`, borderRadius: 999, padding: "13px 22px", fontSize: 16, fontWeight: 500, color: t.text, textDecoration: "none" }}
          >
            {tr("site.hero.ctaSecondary")}
          </a>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {CHIP_KEYS.map((k) => (
            <span key={k} style={{ fontSize: 13, background: t.chipBg, border: `1px solid ${t.chipBorder}`, borderRadius: 999, padding: "5px 12px", color: t.text }}>
              {tr(k)}
            </span>
          ))}
        </div>
      </div>

      {/* Was bobbing on an infinite `floatSm` loop. A product screenshot that
          never stops moving is restless, not alive — and it undercuts the one
          thing this image is here to do, which is let you read it. It now
          arrives once, under the headline, and then holds still. */}
      <div className="pub-hero-rise" style={{ position: "relative", marginTop: 56, width: "100%", maxWidth: MEASURE.wide, zIndex: 1 }}>
        <DashboardMockup theme={t} />
      </div>
    </section>
  );
}
