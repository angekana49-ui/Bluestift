"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { SocraticShot } from "./ProductShots";
import Reveal from "./Reveal";
import { LEAD, SectionBlend, bandColumn, bandSection, eyebrow, lead, sectionH2, serifEm } from "./layout";

/**
 * The pedagogical model, stated openly — as a stack of cards that climb.
 *
 * Every rung here is a real instruction in the tutor's system prompt
 * (`lib/raya/prompt.ts`, "# EMT escalation"): Raya opens on PUMP, escalates to
 * HINT only after a genuine attempt, to ASSERTION only once hints have failed,
 * and to SUMMARY to close or unblock. The "can't be switched off" claim is
 * literal — the core guardrail is structural, not a toggle a school configures.
 *
 * Why the section exists at all: "our AI is Socratic" is what every ed-tech
 * landing says. Naming the four rungs and what each one refuses to do is the
 * cheapest way to prove it isn't marketing.
 *
 * The scroll-stack: each card pins HEADER_H lower than the one before, so the
 * previous headers stay on screen and pile into a literal ladder while you
 * read. That only works if the sliver left showing is exactly the header strip
 * — hence STICKY_STEP === HEADER_H, and the header being a fixed-height band
 * rather than free-flowing padded content. It degrades to a plain list on short
 * viewports and under prefers-reduced-motion (see `.pub-stack-card`).
 */

const RUNGS: { n: string; nameKey: MessageKey; titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { n: "01", nameKey: "site.ladder.r1.name", titleKey: "site.ladder.r1.title", bodyKey: "site.ladder.r1.body" },
  { n: "02", nameKey: "site.ladder.r2.name", titleKey: "site.ladder.r2.title", bodyKey: "site.ladder.r2.body" },
  { n: "03", nameKey: "site.ladder.r3.name", titleKey: "site.ladder.r3.title", bodyKey: "site.ladder.r3.body" },
  { n: "04", nameKey: "site.ladder.r4.name", titleKey: "site.ladder.r4.title", bodyKey: "site.ladder.r4.body" },
];

/** Header band height, and therefore the offset between two pinned cards. */
const HEADER_H = 56;
/** Clears the sticky navbar (top:12, ~60px tall) with a little air. */
const STICKY_BASE = 92;

export default function LadderSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();

  // Light mode gets dark accents (white glyph on top); dark mode gets light
  // accents (dark glyph). Either way the badge stays well above AA.
  const accents = t.dark
    ? ["#7ab3f7", "#4e9bf5", "#34d399", "#94a3b8"]
    : ["#173d8a", "#2f7fe0", "#059669", "#546578"];
  const softs = t.dark
    ? ["rgba(122,179,247,0.13)", "rgba(78,155,245,0.13)", "rgba(52,211,153,0.13)", "rgba(148,163,184,0.13)"]
    : ["rgba(23,61,138,0.07)", "rgba(47,127,224,0.08)", "rgba(5,150,105,0.08)", "rgba(84,101,120,0.08)"];
  const onAccent = t.dark ? "#0b1220" : "#ffffff";

  return (
    <section id="method" style={bandSection(t.cardBg)}>
      {/* Blends down from FeaturesSection (t.sectionAltBg), which sits above. */}
      <SectionBlend from={t.sectionAltBg} />

      {/* NOTE the section must never gain `overflow: hidden` — it would break
          the sticky scroll-stack below. `bandSection` deliberately omits it. */}
      <div style={bandColumn("text")}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={eyebrow(t)}>{tr("site.ladder.eyebrow")}</div>
          <h2 style={{ ...sectionH2(t), margin: "10px 0 0" }}>
            {tr("site.ladder.title.a")}{" "}
            <em style={serifEm}>{tr("site.ladder.title.em")}</em>
          </h2>
          <p style={lead(t)}>
            <RayaText>{tr("site.ladder.sub")}</RayaText>
          </p>
        </div>

        {/* Wide plate above the stack. It sits OUTSIDE the stack container on
            purpose — a sticky card only travels within its own parent, so
            anything sharing that parent would be dragged into the pile. */}
        <Reveal>
          <div
            className="pub-lift"
            style={{
              marginBottom: 40,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 22,
              overflow: "hidden",
              boxShadow: t.cardShadowLg,
            }}
          >
            <SocraticShot theme={t} />
          </div>
        </Reveal>

        <div>
          {RUNGS.map((r, i) => (
            <article
              key={r.n}
              className="pub-stack-card"
              style={{
                top: STICKY_BASE + i * HEADER_H,
                zIndex: i + 1,
                // Opaque on purpose: the card below has to disappear cleanly as
                // this one slides over it.
                background: t.sectionAltBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 22,
                boxShadow: t.cardShadowLg,
                overflow: "hidden",
                marginBottom: i === RUNGS.length - 1 ? 0 : 24,
              }}
            >
              <div
                style={{
                  height: HEADER_H,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 18px",
                  background: softs[i],
                  borderBottom: `1px solid ${t.cardBorder}`,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    flex: "none",
                    borderRadius: 10,
                    background: accents[i],
                    color: onAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {r.n}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: accents[i] }}>
                  {tr(r.nameKey)}
                </span>

                {/* Four segments, i+1 of them lit: how high this rung sits, no
                    caption needed. Decorative, so it's the first thing to go
                    when the header runs out of width. */}
                <span className="pub-hide-sm" aria-hidden style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 4, height: 20 }}>
                  {[0, 1, 2, 3].map((seg) => (
                    <span
                      key={seg}
                      style={{
                        display: "block",
                        width: 6,
                        height: 6 + seg * 4,
                        borderRadius: 3,
                        background: seg <= i ? accents[i] : t.cardBorder,
                      }}
                    />
                  ))}
                </span>
              </div>

              <div style={{ padding: "clamp(22px,3.6vw,34px)", minHeight: "clamp(150px,20vh,190px)" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(1.15rem,2.6vw,1.6rem)",
                    letterSpacing: "-0.01em",
                    color: t.text,
                    margin: 0,
                  }}
                >
                  {tr(r.titleKey)}
                </h3>
                <p style={{ fontSize: "clamp(14.5px,1.6vw,16px)", color: t.muted, lineHeight: 1.75, margin: "10px 0 0", maxWidth: 620 }}>
                  <RayaText>{tr(r.bodyKey)}</RayaText>
                </p>
              </div>
            </article>
          ))}
        </div>

        <p style={{ maxWidth: LEAD, margin: "40px auto 0", textAlign: "center", fontSize: 14.5, color: t.muted, lineHeight: 1.75 }}>
          <RayaText>{tr("site.ladder.note")}</RayaText>
        </p>
      </div>
    </section>
  );
}
