"use client";

import type { ReactNode } from "react";
import type { Theme } from "./theme";
import { RayaText, SchoolsName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { SectionBlend, bandColumn, bandSection, lead, sectionH2, serifEm } from "./layout";

export default function PricingSection({
  theme: t,
  soloPrices,
  schoolPrices,
}: {
  theme: Theme;
  /**
   * Price lines from the live plan catalogue (see `pricingLine` in lib/billing).
   * Null when it could not be read — the line is then omitted rather than
   * guessed: the CTA still leads to /pricing, which is authoritative.
   */
  soloPrices?: string | null;
  schoolPrices?: string | null;
}) {
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
  //
  // These cards each used to carry a blurred blob morphing on an infinite loop.
  // Three of them, on slightly different periods, right next to the one
  // decision the page actually asks a visitor to make — motion with nothing to
  // say, pulling the eye off the prices. Gone: the cards hold still, and the
  // only thing that moves is the CTA when you reach for it.
  const gatewayCard = (opts: {
    title: string;
    lines: string[];
    meta: ReactNode;
    cta: string;
    href: string;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", background: t.cardBg, borderRadius: 24, padding: 28, boxShadow: t.cardShadowLg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "relative", fontSize: "1.5rem", fontWeight: 900, color: t.text, letterSpacing: "-0.02em" }}>{opts.title}</div>
      {lineList(opts.lines, t.muted, t.greenSolid)}
      {/* Absent when the catalogue could not be read: the row collapses rather
          than leaving a margin where a price used to be. */}
      {opts.meta && (
        <div style={{ position: "relative", fontSize: 14, fontWeight: 600, color: t.wordmarkB, marginTop: 16 }}>{opts.meta}</div>
      )}
      <a href={opts.href} className="pub-press" style={{ position: "relative", display: "block", textAlign: "center", marginTop: 18, background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "11px 20px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
        {opts.cta}
      </a>
    </div>
  );

  return (
    <section id="pricing" style={bandSection(t.pricingBg)}>
      <SectionBlend from={t.cardBg} />
      <div style={bandColumn("wide")}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={sectionH2(t)}>
            {tr("site.pricing.title.a")}{" "}
            <em style={serifEm}>{tr("site.pricing.title.em")}</em>
          </h2>
          <p style={lead(t)}>{tr("site.pricing.sub")}</p>
        </div>

        {/* Rail on phones: three plans are peers, and a visitor choosing between
            them has to be able to hold two side by side. Stacked, the choice
            becomes a memory test. */}
        <div className="pub-grid-3 pub-rail" style={{ gap: 20, alignItems: "stretch" }}>
          {/* 1 — Solo (individual) */}
          {gatewayCard({
            title: tr("site.pricing.solo.title"),
            lines: [
              tr("site.pricing.solo.l1"),
              tr("site.pricing.solo.l2"),
              tr("site.pricing.solo.l3"),
              tr("site.pricing.solo.l4"),
            ],
            meta: soloPrices ?? undefined,
            cta: tr("site.pricing.solo.cta"),
            href: "/pricing?for=solo",
          })}

          {/* 2 — Schools (recommended, dark) */}
          {/* No "recommended" badge here, deliberately. These three cards are
              three AUDIENCES — solo learner, school, bespoke — not three tiers
              of one ladder. A visitor is not choosing the best value among
              peers; they already know which one they are, and telling a teacher
              that the school plan is "recommended" over the solo plan is not a
              recommendation, it is noise in front of a decision that was never
              theirs to make. The badge belongs on /pricing, where the three
              cards ARE a ladder within one audience. */}
          <div style={{ display: "flex", flexDirection: "column", background: "#0b1220", color: "white", borderRadius: 24, padding: 28, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,0.25)" }}>
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
            {schoolPrices && (
              <div style={{ position: "relative", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 16 }}>{schoolPrices}</div>
            )}
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
