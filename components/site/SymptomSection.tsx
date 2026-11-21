"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { SymptomAttempt, SymptomReturned } from "./SymptomShot";
import Reveal from "./Reveal";
import { LEAD, SectionHeader, bandColumn, bandSection, bandTone, serifEm } from "./layout";

/**
 * Why now — the symptom the thesis opens with.
 *
 * This band used to argue "the layer between the two you already buy", drawn
 * as three lanes on an axis of time with a live gauge and a counterfactual
 * branch. That position was written under time pressure and the project no
 * longer holds it: the line is the dissociation thesis (hero, connection
 * band), and this section is its entry point rather than a second thesis.
 *
 * The entry is the acute symptom, not the mechanism: homework used to be lossy
 * telemetry about how a student thinks, and AI answers come back laundered —
 * perfect and silent. So the illustration is two copies, not a chart
 * (see ./SymptomShot). The close turns back to the product in one line: the
 * signal still exists, it lives in the working, and that is where Raya reads
 * it. Nothing here is quantified — no statistic in this repo could back one.
 */

const CARDS = [SymptomAttempt, SymptomReturned] as const;

export default function SymptomSection({ theme: outer }: { theme: Theme }) {
  const tr = useTranslate();

  /* Tint: KernelSection above and FaqSection below are both the card colour,
     and three bands on one shade is the undifferentiated scroll the tone system
     exists to prevent. */
  const { background, theme: t } = bandTone(outer, "tint");

  return (
    <section id="why-now" style={bandSection(background)}>
      <div style={bandColumn("wide")}>
        <Reveal>
          <SectionHeader
            t={t}
            align="split"
            gap={48}
            eyebrow={tr("site.pos.eyebrow")}
            title={
              <>
                {tr("site.pos.title.a")}{" "}
                <em style={serifEm}>{tr("site.pos.title.em")}</em>
              </>
            }
            lead={<RayaText>{tr("site.pos.sub")}</RayaText>}
          />
        </Reveal>

        {/* Two copies side by side — a plain grid, deliberately not a rail.
            A comparison this short survives stacking: on a phone each card is
            one screenful at most, and swiping between "wrong" and "right"
            would stage them as alternatives rather than as the same exercise
            twice. */}
        <div className="pub-grid-2" style={{ gap: 20, marginTop: 40 }}>
          {CARDS.map((Card, i) => (
            <Reveal key={i} delay={i * 90} style={{ height: "100%" }}>
              <Card theme={t} />
            </Reveal>
          ))}
        </div>

        {/* The turn: the section opens on a loss and must not end on one. Kept
            to the reading measure with the way back into the product beside
            it — the loop that restores the signal lives at #how-it-works. */}
        <p style={{ maxWidth: LEAD, margin: "36px auto 0", textAlign: "center", fontSize: 15.5, lineHeight: 1.7, color: t.muted }}>
          <RayaText>{tr("site.pos.close")}</RayaText>{" "}
          <a href="#how-it-works" className="pub-underline" style={{ color: t.link, fontWeight: 600 }}>
            {tr("site.hero.ctaSecondary")}
          </a>
        </p>
      </div>
    </section>
  );
}
