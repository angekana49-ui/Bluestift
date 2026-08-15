"use client";

import type { ReactNode } from "react";
import type { Theme } from "./theme";
import { RayaText, SchoolsName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";

export default function PricingSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  // Short scannable lines beat a paragraph — one idea per row, small accent dot.
  const lineList = (lines: string[], color: string, dot: string) => (
    <ul style={{ position: "relative", listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
      {lines.map((line, i) => (
        <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 15, color, lineHeight: 1.45 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0, transform: "translateY(-1px)" }} />
          <span><RayaText>{line}</RayaText></span>
        </li>
      ))}
    </ul>
  );

  // Audience gateway card — no single price; sells the segment, then deep-links
  // into /pricing with the right tab preselected.
  const gatewayCard = (opts: {
    title: string;
    lines: string[];
    meta: ReactNode;
    cta: string;
    href: string;
    blobDur: string;
    blobDelay: string;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", background: t.cardBg, borderRadius: 24, padding: 28, boxShadow: t.cardShadowLg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: "-15%", bottom: "-15%", width: "75%", height: "75%", background: "rgba(11,18,32,0.05)", filter: "blur(30px)", animation: `morphBlob ${opts.blobDur} ease-in-out infinite`, animationDelay: opts.blobDelay, pointerEvents: "none" }} />
      <div style={{ position: "relative", fontSize: "1.5rem", fontWeight: 900, color: t.text, letterSpacing: "-0.02em" }}>{opts.title}</div>
      {lineList(opts.lines, t.muted, t.greenSolid)}
      <div style={{ position: "relative", fontSize: 14, fontWeight: 600, color: t.wordmarkB, marginTop: 16 }}>{opts.meta}</div>
      <a href={opts.href} className="pub-press" style={{ position: "relative", display: "block", textAlign: "center", marginTop: 18, background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "11px 20px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
        {opts.cta}
      </a>
    </div>
  );

  return (
    <section id="pricing" style={{ position: "relative", padding: "112px 24px", background: t.pricingBg }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.cardBg} 0%, transparent 100%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "clamp(1.9rem,4vw,2.9rem)", letterSpacing: "-0.02em", color: t.text }}>
            {tr("site.pricing.title.a")}{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic" }}>{tr("site.pricing.title.em")}</em>
          </h2>
          <p style={{ fontSize: 16, color: t.muted, marginTop: 12, maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
            {tr("site.pricing.sub")}
          </p>
        </div>

        <div className="pub-grid-3" style={{ gap: 20, alignItems: "stretch" }}>
          {/* 1 — Solo (individual) */}
          {gatewayCard({
            title: tr("site.pricing.solo.title"),
            lines: [
              tr("site.pricing.solo.l1"),
              tr("site.pricing.solo.l2"),
              tr("site.pricing.solo.l3"),
              tr("site.pricing.solo.l4"),
            ],
            meta: "Free · Plus $20 · Max $40 / mo",
            cta: tr("site.pricing.solo.cta"),
            href: "/pricing?for=solo",
            blobDur: "10.5s",
            blobDelay: "0s",
          })}

          {/* 2 — Schools (recommended, dark) */}
          <div style={{ display: "flex", flexDirection: "column", background: "#0b1220", color: "white", borderRadius: 24, padding: 28, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,0.25)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ position: "absolute", right: "-15%", bottom: "-15%", width: "75%", height: "75%", background: "rgba(255,255,255,0.09)", filter: "blur(30px)", animation: "morphBlob 7.5s ease-in-out infinite", animationDelay: "0.8s" }} />
            </div>
            <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "white", color: "#0b1220", fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, letterSpacing: "0.1em", zIndex: 1 }}>
              {tr("site.pricing.schools.badge")}
            </span>
            <div style={{ position: "relative", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}><SchoolsName /></div>
            {lineList(
              [
                tr("site.pricing.schools.l1"),
                tr("site.pricing.schools.l2"),
                tr("site.pricing.schools.l3"),
                tr("site.pricing.schools.l4"),
              ],
              "rgba(255,255,255,0.78)",
              t.greenSolid,
            )}
            <div style={{ position: "relative", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 16 }}>Standard $2 · Plus $4 / student / mo</div>
            <a href="/pricing?for=schools" className="pub-press" style={{ position: "relative", display: "block", textAlign: "center", marginTop: 18, background: "white", color: "#0b1220", borderRadius: 999, padding: "11px 20px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              {tr("site.pricing.schools.cta")}
            </a>
          </div>

          {/* 3 — Custom (bespoke power) */}
          {gatewayCard({
            title: tr("site.pricing.custom.title"),
            lines: [
              tr("site.pricing.custom.l1"),
              tr("site.pricing.custom.l2"),
              tr("site.pricing.custom.l3"),
              tr("site.pricing.custom.l4"),
            ],
            meta: tr("site.pricing.custom.meta"),
            cta: tr("site.pricing.custom.cta"),
            href: "/pricing?for=schools",
            blobDur: "9s",
            blobDelay: "1.6s",
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 36 }}>
          <a href="/pricing" className="pub-focus" style={{ fontSize: 15, fontWeight: 600, color: t.link, textDecoration: "none", borderBottom: `1px solid ${t.link}`, paddingBottom: 2 }}>
            {tr("site.pricing.compare")}
          </a>
        </div>
      </div>
    </section>
  );
}
