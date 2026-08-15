"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { KernelShot, RoomShot, ToolsShot } from "./ProductShots";
import Reveal from "./Reveal";

/**
 * The three surfaces, each drawn as the surface itself.
 *
 * These cards used to carry a permanent `floatSm` bob and a looping `shine`
 * sweep. Both are gone: motion with nothing behind it reads as filler. The card
 * is now still until you touch it (`pub-lift`), and the entrance is a one-shot
 * reveal — motion that responds to the visitor rather than looping at them.
 *
 * The illustration slot used to hold a generic AI clip per card. It now holds a
 * drawn mockup of the actual screen being described (see ProductShots.tsx), so
 * the three cards show three different products instead of three variations on
 * the same glowing abstraction.
 */

const FEATURES: {
  icon: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  Shot: (props: { theme: Theme }) => React.ReactElement;
}[] = [
  {
    icon: "K",
    titleKey: "site.features.kernel.title",
    descKey: "site.features.kernel.desc",
    Shot: KernelShot,
  },
  {
    icon: "S",
    titleKey: "site.features.rooms.title",
    descKey: "site.features.rooms.desc",
    Shot: RoomShot,
  },
  {
    icon: "C",
    titleKey: "site.features.challenges.title",
    descKey: "site.features.challenges.desc",
    Shot: ToolsShot,
  },
];

export default function FeaturesSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section style={{ position: "relative", background: t.sectionAltBg, padding: "96px 24px" }}>
      {/* Blends down from ConnectionSection (t.cardBg), which now sits above. */}
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.cardBg} 0%, transparent 100%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "-0.02em", maxWidth: 640, margin: "0 auto", color: t.text }}>
              {tr("site.features.title.more")}{" "}
              <em style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic" }}>
                {tr("site.features.title.em1")}
              </em>
              <br />
              {tr("site.features.title.more")}{" "}
              <em style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic" }}>
                {tr("site.features.title.em2")}
              </em>
            </h2>
            <p style={{ maxWidth: 520, margin: "16px auto 0", fontSize: 16, color: t.text, lineHeight: 1.7 }}>
              {tr("site.features.sub")}
            </p>
          </div>
        </Reveal>

        <div className="pub-grid-3" style={{ gap: 20 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.titleKey} delay={i * 80}>
              <div
                className="pub-lift"
                style={{
                  height: "100%",
                  overflow: "hidden",
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 22,
                  boxShadow: t.cardShadow,
                }}
              >
                <f.Shot theme={t} />
                <div style={{ padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 12, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15 }}>
                      {f.icon}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 600, color: t.text }}>{tr(f.titleKey)}</span>
                  </div>
                  <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.7, margin: "12px 0 0" }}>
                    <RayaText>{tr(f.descKey)}</RayaText>
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
