"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { KernelShot, RoomShot, ToolsShot } from "./ProductShots";
import Reveal from "./Reveal";
import { SectionBlend, bandColumnShowcase, bandSection, lead, sectionH2, serifEm } from "./layout";

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

// Same three accents ProductShots.tsx already draws its illustrations in, and
// the same order ConnectionSection uses its own badges in — one palette
// running across both bands rather than each inventing its own.
const FEATURE_COLOR = ["#4f46e5", "#2f7fe0", "#16a34a"];

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
    <section style={bandSection(t.sectionAltBg)}>
      {/* Blends down from ConnectionSection (t.cardBg), which now sits above. */}
      <SectionBlend from={t.cardBg} />
      <div style={bandColumnShowcase()}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            {/* Two-line heading, so it gets its own measure to break on — the
                only heading on the site that does. Also one of two bands that
                widen past MEASURE.wide on a large screen (bandColumnShowcase)
                — the size grows to match, same reasoning as ConnectionSection. */}
            <h2 style={{ ...sectionH2(t), fontSize: "clamp(1.7rem,4.4vw,3.4rem)", maxWidth: 760, margin: "0 auto" }}>
              {tr("site.features.title.more")}{" "}
              <em style={serifEm}>{tr("site.features.title.em1")}</em>
              <br />
              {tr("site.features.title.more")}{" "}
              <em style={serifEm}>{tr("site.features.title.em2")}</em>
            </h2>
            <p style={{ ...lead(t), maxWidth: 640 }}>{tr("site.features.sub")}</p>
          </div>
        </Reveal>

        <div className="pub-grid-3 pub-rail" style={{ gap: 20 }}>
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
                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 12, background: FEATURE_COLOR[i], color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15 }}>
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
