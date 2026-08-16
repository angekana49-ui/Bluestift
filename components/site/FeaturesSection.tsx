"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import MediaFrame from "./MediaFrame";
import Reveal from "./Reveal";
import { SectionBlend, bandColumn, bandSection, lead, sectionH2, serifEm } from "./layout";

/**
 * The three surfaces, each with an illustrative clip.
 *
 * These cards used to carry a permanent `floatSm` bob and a looping `shine`
 * sweep. Both are gone: motion with nothing behind it reads as filler, and the
 * sweep would have sat on top of the video. The card is now still until you
 * touch it (`pub-lift`), the clip plays only while it's on screen, and the
 * entrance is a one-shot reveal — motion that responds to the visitor rather
 * than looping at them.
 */

const FEATURES: {
  icon: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  media: string;
  poster: string;
}[] = [
  {
    icon: "K",
    titleKey: "site.features.kernel.title",
    descKey: "site.features.kernel.desc",
    media: "/media/kernel.mp4",
    poster: "/media/kernel.jpg",
  },
  {
    icon: "S",
    titleKey: "site.features.rooms.title",
    descKey: "site.features.rooms.desc",
    media: "/media/session.mp4",
    poster: "/media/session.jpg",
  },
  {
    icon: "C",
    titleKey: "site.features.challenges.title",
    descKey: "site.features.challenges.desc",
    media: "/media/flashcards.mp4",
    poster: "/media/flashcards.jpg",
  },
];

export default function FeaturesSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section style={bandSection(t.sectionAltBg)}>
      {/* Blends down from ConnectionSection (t.cardBg), which now sits above. */}
      <SectionBlend from={t.cardBg} />
      <div style={bandColumn("wide")}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            {/* Two-line heading, so it gets its own measure to break on — the
                only heading on the site that does. */}
            <h2 style={{ ...sectionH2(t), maxWidth: 640, margin: "0 auto" }}>
              {tr("site.features.title.more")}{" "}
              <em style={serifEm}>{tr("site.features.title.em1")}</em>
              <br />
              {tr("site.features.title.more")}{" "}
              <em style={serifEm}>{tr("site.features.title.em2")}</em>
            </h2>
            <p style={lead(t)}>{tr("site.features.sub")}</p>
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
                <MediaFrame theme={t} src={f.media} poster={f.poster} label={tr(f.titleKey)} ratio="16 / 10" />
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
