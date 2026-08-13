"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import Reveal from "./Reveal";

/**
 * What the Cognitive Kernel actually stores, named field by field.
 *
 * The four letters are the real contract, not a metaphor: `ConceptStateOut`
 * carries `k_raw` / `k_effective`, `v_score` and `p_score` per concept, and
 * `MindsetOut.m_score` per student (`lib/kernel/types.ts`). The five alerts are
 * `KernelAlertType` verbatim, and each "response" column restates the handling
 * rule the tutor is given for that alert in `lib/raya/prompt.ts`
 * ("# Active safety alerts").
 *
 * Keep the two in sync: if the kernel contract gains or renames an alert, this
 * table is a public claim about the product and has to move with it.
 */

const DIMENSIONS: { letter: string; nameKey: MessageKey; titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { letter: "K", nameKey: "site.kernel.k.name", titleKey: "site.kernel.k.title", bodyKey: "site.kernel.k.body" },
  { letter: "V", nameKey: "site.kernel.v.name", titleKey: "site.kernel.v.title", bodyKey: "site.kernel.v.body" },
  { letter: "P", nameKey: "site.kernel.p.name", titleKey: "site.kernel.p.title", bodyKey: "site.kernel.p.body" },
  { letter: "M", nameKey: "site.kernel.m.name", titleKey: "site.kernel.m.title", bodyKey: "site.kernel.m.body" },
];

const ALERTS: { nameKey: MessageKey; signalKey: MessageKey; responseKey: MessageKey }[] = [
  { nameKey: "site.kernel.a1.name", signalKey: "site.kernel.a1.signal", responseKey: "site.kernel.a1.response" },
  { nameKey: "site.kernel.a2.name", signalKey: "site.kernel.a2.signal", responseKey: "site.kernel.a2.response" },
  { nameKey: "site.kernel.a3.name", signalKey: "site.kernel.a3.signal", responseKey: "site.kernel.a3.response" },
  { nameKey: "site.kernel.a4.name", signalKey: "site.kernel.a4.signal", responseKey: "site.kernel.a4.response" },
  { nameKey: "site.kernel.a5.name", signalKey: "site.kernel.a5.signal", responseKey: "site.kernel.a5.response" },
];

export default function KernelSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();

  const accents = t.dark
    ? ["#7ab3f7", "#4e9bf5", "#34d399", "#c7d2e3"]
    : ["#173d8a", "#2f7fe0", "#059669", "#0b1220"];
  const onAccent = t.dark ? "#0b1220" : "#ffffff";
  const alertAccent = t.dark ? "#7ab3f7" : "#173d8a";

  return (
    <section id="kernel" style={{ position: "relative", background: t.sectionAltBg, padding: "96px 24px", scrollMarginTop: 24 }}>
      {/* Blends down from LadderSection (t.cardBg). */}
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.cardBg} 0%, transparent 100%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: t.muted, fontWeight: 600 }}>
            {tr("site.kernel.eyebrow")}
          </div>
          <h2
            style={{
              fontFamily: "'IBM Plex Sans',sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.7rem,3.6vw,2.6rem)",
              letterSpacing: "-0.02em",
              margin: "10px 0 0",
              color: t.text,
            }}
          >
            {tr("site.kernel.title.a")}{" "}
            <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>{tr("site.kernel.title.em")}</em>
          </h2>
          <p style={{ maxWidth: 620, margin: "14px auto 0", fontSize: 16, color: t.text, lineHeight: 1.7 }}>
            <RayaText>{tr("site.kernel.sub")}</RayaText>
          </p>
        </Reveal>

        <div className="pub-grid-4" style={{ gap: 16 }}>
          {DIMENSIONS.map((d, i) => (
            <Reveal key={d.letter} delay={i * 70} style={{ height: "100%" }}>
            <div
              className="pub-lift"
              style={{
                height: "100%",
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 20,
                padding: 22,
                boxShadow: t.cardShadow,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: accents[i],
                  color: onAccent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'IBM Plex Sans',sans-serif",
                  fontWeight: 800,
                  fontSize: 20,
                }}
              >
                {d.letter}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: accents[i], marginTop: 16 }}>
                {tr(d.nameKey)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginTop: 6 }}>{tr(d.titleKey)}</div>
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.65, margin: "8px 0 0" }}>
                <RayaText>{tr(d.bodyKey)}</RayaText>
              </p>
            </div>
            </Reveal>
          ))}
        </div>

        <div style={{ marginTop: 24, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, overflow: "hidden" }}>
          <div
            className="pub-alert-row pub-alert-head"
            style={{
              padding: "14px 24px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: t.muted,
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <span>{tr("site.kernel.col.alert")}</span>
            <span>{tr("site.kernel.col.signal")}</span>
            <span>{tr("site.kernel.col.response")}</span>
          </div>

          {ALERTS.map((a, i) => (
            <div
              key={a.nameKey}
              className="pub-alert-row"
              style={{ padding: "18px 24px", borderTop: i === 0 ? "none" : `1px solid ${t.cardBorder}` }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: alertAccent }}>{tr(a.nameKey)}</span>
              {/* The two `pub-alert-label` spans are invisible on desktop, where
                  the column header carries the meaning, and appear only once
                  the row has collapsed into a single stacked column. */}
              <span style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.6 }}>
                <span className="pub-alert-label" style={{ color: t.muted, opacity: 0.75 }}>
                  {tr("site.kernel.col.signal")}
                </span>
                {tr(a.signalKey)}
              </span>
              <span style={{ fontSize: 14.5, color: t.text, lineHeight: 1.6 }}>
                <span className="pub-alert-label" style={{ color: alertAccent }}>
                  {tr("site.kernel.col.response")}
                </span>
                <RayaText>{tr(a.responseKey)}</RayaText>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
