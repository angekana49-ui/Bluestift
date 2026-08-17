"use client";

import Link from "next/link";
import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import Reveal from "./Reveal";
import { GUTTER, LEAD, MEASURE, sectionH2, serifEm } from "./layout";

/**
 * Closing band, between pricing and the footer.
 *
 * The section background is `footerBg` on purpose: PricingSection's gradient
 * resolves to exactly that colour at its bottom edge, so this slots in without
 * a visible seam and the footer continues it. Only the inner card is dark.
 *
 * The offer wording tracks the hero chips ("Free to start", "No card required")
 * — there is no fixed-length trial to promise, and inventing one here would be
 * the fastest way to make the rest of the page look invented too.
 */

export default function FinalCtaSection({ theme: t, signedIn, homeHref = "/chat" }: { theme: Theme; signedIn?: boolean; homeHref?: string }) {
  const tr = useTranslate();

  const cardBg = t.dark
    ? "linear-gradient(135deg,#12234a 0%,#1e4f9e 100%)"
    : "linear-gradient(135deg,#0b1220 0%,#173d8a 100%)";

  // No top padding and no blend: this band continues PricingSection's
  // background rather than starting a new one, so `bandSection` doesn't apply.
  // Only the measure and the type come from the shared template.
  return (
    <section style={{ background: t.footerBg, padding: `0 ${GUTTER}px 104px` }}>
      <Reveal
        style={{
          maxWidth: MEASURE.wide,
          margin: "0 auto",
          background: cardBg,
          borderRadius: 28,
          // Fixed 40px side padding left ~230px of usable width on a 360px
          // phone once the section's own 24px is taken out.
          padding: "clamp(38px,6vw,64px) clamp(22px,5vw,40px)",
          textAlign: "center",
          boxShadow: t.cardShadowLg,
        }}
      >
        {/* Same heading as every other band; only the colour changes, because
            this one sits on a dark card. */}
        <h2 style={{ ...sectionH2(t), color: "#ffffff" }}>
          <RayaText>{tr("site.finalCta.title.a")}</RayaText>{" "}
          <em style={serifEm}>{tr("site.finalCta.title.em")}</em>
        </h2>

        <p style={{ margin: "16px auto 0", maxWidth: LEAD, color: "rgba(255,255,255,0.82)", fontSize: 16, lineHeight: 1.7 }}>
          <RayaText>{tr("site.finalCta.sub")}</RayaText>
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
          <Link
            href={signedIn ? homeHref : "/login"}
            className="pub-press"
            style={{ background: "#ffffff", color: "#0b1220", borderRadius: 999, padding: "13px 28px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}
          >
            {tr(signedIn ? "site.nav.openApp" : "site.finalCta.ctaPrimary")}
          </Link>
          <Link
            href="/contact"
            className="pub-press"
            style={{ border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff", borderRadius: 999, padding: "13px 26px", fontSize: 15, fontWeight: 600, textDecoration: "none" }}
          >
            {tr("site.finalCta.ctaSecondary")}
          </Link>
        </div>

        <p style={{ margin: "20px 0 0", color: "rgba(255,255,255,0.6)", fontSize: 13.5 }}>{tr("site.finalCta.note")}</p>
      </Reveal>
    </section>
  );
}
