"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import Reveal from "./Reveal";
import { FocusShot, GuidedShot, ReturnShot } from "./ProductShots";
import { SectionBlend, bandColumn, bandSection, lead, sectionH2, serifEm } from "./layout";

/**
 * The thesis band — the section the old "memory" landing didn't have.
 *
 * Positioning: what's broken in a classroom isn't recall (frontier models solved
 * that), it's DISSOCIATION. A teacher distributes, a student ingests, and all
 * they share is a syllabus and a grade. AI made it worse, not better: both sides
 * now have one, privately, and homework — the last channel that carried any
 * signal about how a student actually thinks — comes back laundered.
 *
 * So this section states the loop the product already implements: teacher
 * intent travels down through Raya (class_instructions / school_directives,
 * which enter the tutor's system prompt as advisory guidance), and cognitive
 * state travels back up (the Kernel's per-concept mastery, not transcripts).
 * The "understanding, not surveillance" line is a product commitment, not a
 * slogan: the teacher surfaces read derived state, never the conversations.
 *
 * Each step carries its own shot, and the three are deliberately not one
 * diagram: the claim is that intent crosses between two people who never see
 * each other's screen, so the illustration has to be BOTH screens — the
 * teacher's composer, the student's session, the teacher's list again.
 */

const STEPS: {
  n: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  Shot: (props: { theme: Theme }) => React.ReactElement;
}[] = [
  { n: "1", titleKey: "site.connection.step1.title", bodyKey: "site.connection.step1.body", Shot: FocusShot },
  { n: "2", titleKey: "site.connection.step2.title", bodyKey: "site.connection.step2.body", Shot: GuidedShot },
  { n: "3", titleKey: "site.connection.step3.title", bodyKey: "site.connection.step3.body", Shot: ReturnShot },
];

export default function ConnectionSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section id="how-it-works" style={bandSection(t.cardBg)}>
      {/* This band now sits directly under the hero, so it inherits the
          hero-to-section blend that FeaturesSection used to carry. */}
      <SectionBlend from={t.heroEndSolid} />
      <div style={bandColumn("wide")}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={sectionH2(t)}>
            {tr("site.connection.title.a")}{" "}
            <em style={serifEm}>{tr("site.connection.title.em")}</em>{" "}
            {tr("site.connection.title.b")}
          </h2>
          <p style={lead(t)}>
            <RayaText>{tr("site.connection.sub")}</RayaText>
          </p>
        </div>

        <div className="pub-grid-3 pub-rail" style={{ gap: 20, alignItems: "stretch" }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} style={{ height: "100%" }}>
            <div
              className="pub-lift"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: t.sectionAltBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 22,
                boxShadow: t.cardShadowSm,
              }}
            >
              {/* The surface this step happens on, above the words that name
                  it — same arrangement the feature cards use, so the two bands
                  read as one grammar rather than two. */}
              <s.Shot theme={t} />
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: t.ctaBg,
                    color: t.ctaText,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 16,
                    flex: "none",
                  }}
                >
                  {s.n}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: t.text }}>{tr(s.titleKey)}</div>
                <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.7, margin: "8px 0 0" }}>
                  <RayaText>{tr(s.bodyKey)}</RayaText>
                </p>
              </div>
            </div>
            </Reveal>
          ))}
        </div>

        {/* The guardrail, stated as plainly as the promise. A student who thinks
            they're being read stops admitting what they don't understand — which
            would destroy the very signal this loop runs on. */}
        <div
          style={{
            marginTop: 24,
            border: `1px solid ${t.diffRowBorder}`,
            background: t.diffRowBg,
            borderRadius: 18,
            padding: "18px 22px",
            textAlign: "center",
            fontSize: 15,
            lineHeight: 1.7,
            color: t.diffSoft,
          }}
        >
          <strong style={{ color: t.diffStrong }}>{tr("site.connection.guard.strong")}</strong>{" "}
          {tr("site.connection.guard.body")}
        </div>
      </div>
    </section>
  );
}
