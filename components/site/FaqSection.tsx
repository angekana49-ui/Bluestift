"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import Reveal from "./Reveal";

/**
 * The five objections that actually come back from teachers and schools.
 *
 * Answers stay open rather than living behind an accordion: they're short, and
 * a visitor deciding whether to trust the product shouldn't have to click five
 * times to read the part that reassures them. It also means the copy is in the
 * server-rendered HTML for search.
 */

const QA: { qKey: MessageKey; aKey: MessageKey }[] = [
  { qKey: "site.faq.q1", aKey: "site.faq.a1" },
  { qKey: "site.faq.q2", aKey: "site.faq.a2" },
  { qKey: "site.faq.q3", aKey: "site.faq.a3" },
  { qKey: "site.faq.q4", aKey: "site.faq.a4" },
  { qKey: "site.faq.q5", aKey: "site.faq.a5" },
];

export default function FaqSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section id="faq" style={{ position: "relative", background: t.cardBg, padding: "96px 24px", scrollMarginTop: 24 }}>
      {/* No top blend: since the roadmap moved to /research, this section now
          follows DifferentiatorsSection, which is already t.cardBg. Fading
          t.sectionAltBg over an identical background would paint a band, not a
          transition. */}

      <div style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "'IBM Plex Sans',sans-serif",
            fontWeight: 900,
            fontSize: "clamp(1.7rem,3.6vw,2.6rem)",
            letterSpacing: "-0.02em",
            margin: 0,
            textAlign: "center",
            color: t.text,
          }}
        >
          {tr("site.faq.title.a")}{" "}
          <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>{tr("site.faq.title.em")}</em>
        </h2>

        <Reveal style={{ marginTop: 40, border: `1px solid ${t.cardBorder}`, borderRadius: 20, overflow: "hidden", background: t.sectionAltBg }}>
          {QA.map((item, i) => (
            <div key={item.qKey} style={{ padding: "22px 26px", borderTop: i === 0 ? "none" : `1px solid ${t.cardBorder}` }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16.5, color: t.text }}>
                <RayaText>{tr(item.qKey)}</RayaText>
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 15, color: t.muted, lineHeight: 1.7 }}>
                <RayaText>{tr(item.aKey)}</RayaText>
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
