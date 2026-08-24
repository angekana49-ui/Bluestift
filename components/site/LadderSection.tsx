"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { RungShot, SocraticShot } from "./ProductShots";
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
 *
 * Each card is split: the explanation on one side, the session that
 * demonstrates it on the other (RungShot — a real chat surface, one subject per
 * rung). The sides alternate, so the four cards can't blur into one repeated
 * card as they stack. See `.pub-rung-split`.
 */

const RUNGS: { n: string; nameKey: MessageKey; titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { n: "01", nameKey: "site.ladder.r1.name", titleKey: "site.ladder.r1.title", bodyKey: "site.ladder.r1.body" },
  { n: "02", nameKey: "site.ladder.r2.name", titleKey: "site.ladder.r2.title", bodyKey: "site.ladder.r2.body" },
  { n: "03", nameKey: "site.ladder.r3.name", titleKey: "site.ladder.r3.title", bodyKey: "site.ladder.r3.body" },
  { n: "04", nameKey: "site.ladder.r4.name", titleKey: "site.ladder.r4.title", bodyKey: "site.ladder.r4.body" },
];

/**
 * Header band height, and therefore the offset between two pinned cards.
 *
 * Every pixel here is paid four times over: the last card pins at
 * STICKY_BASE + 3 × HEADER_H, and everything below that has to still fit on
 * screen or the pile is never visible as a pile. 46 is the smallest band the
 * badge, the rung name and the segment gauge sit in comfortably.
 */
const HEADER_H = 46;
/** Clears the sticky navbar (top:12, ~60px tall) with a little air. */
const STICKY_BASE = 92;

export default function LadderSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();

  /**
   * One hue per rung, and it is the same hue everywhere that rung appears: the
   * number badge, the card's gradient, the header sliver, and the italic title.
   * Four cards that stack on top of each other need to be told apart at a
   * glance, and colour does that faster than reading the number.
   *
   * The order is the climb, in the product's own status palette: violet opens,
   * blue prompts, amber is the intervention (the Kernel's "in progress"), green
   * closes (its "mastered"). The section ends on the colour the profile uses
   * for a concept that has landed, which is the whole point of the last rung.
   *
   * Light mode gets dark accents (white glyph on top), dark mode light ones
   * (dark glyph). Every light-mode value clears 5:1 on white, so the same
   * colour is safe on the badge AND as heading text.
   */
  const accents = t.dark
    ? ["#a78bfa", "#7ab3f7", "#fbbf24", "#34d399"]
    : ["#6d28d9", "#1f5fb0", "#9a4a08", "#047857"];
  /** The same four as rgba, for tints. Kept separate from `accents` because a
   *  tint needs the channels, not the hex. */
  const rgb = t.dark
    ? ["167,139,250", "122,179,247", "251,191,36", "52,211,153"]
    : ["109,40,217", "31,95,176", "154,74,8", "4,120,87"];
  const tint = (i: number, a: number) => `rgba(${rgb[i]},${a})`;
  const onAccent = t.dark ? "#0b1220" : "#ffffff";

  return (
    <section id="method" style={bandSection(t.cardBg)}>
      {/* A single soft wash down the whole band, tracking the four rung
          accents. It's rgba over the band's own solid colour, so the section
          still starts and ends on t.cardBg and both neighbouring SectionBlends
          stay correct — a band that changed colour at its edges would leave a
          seam above and below. Painted before the blend so the blend covers it. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${tint(0, t.dark ? 0.07 : 0.05)} 0%, ${tint(1, t.dark ? 0.07 : 0.055)} 34%, ${tint(2, t.dark ? 0.06 : 0.05)} 68%, ${tint(3, t.dark ? 0.06 : 0.05)} 100%)`,
        }}
      />
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
                // this one slides over it. The rung's gradient is an rgba layer
                // ON TOP of that solid colour — a card whose only background was
                // a gradient would let the card underneath show through as it
                // passed. The angle follows the flip so the colour falls on the
                // explanation side; under the session it would be invisible
                // anyway, since a shot carries its own opaque surface. Three
                // stops rather than two: a single fade to transparent reads as
                // a smudge in the corner, where a gradient that travels most of
                // the card reads as the card having a colour.
                background: `linear-gradient(${i % 2 === 1 ? 250 : 110}deg, ${tint(i, t.dark ? 0.2 : 0.15)} 0%, ${tint(i, t.dark ? 0.09 : 0.06)} 44%, transparent 82%), ${t.sectionAltBg}`,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 18,
                boxShadow: t.cardShadowLg,
                overflow: "hidden",
                marginBottom: i === RUNGS.length - 1 ? 0 : 18,
              }}
            >
              <div
                className={`pub-rung-head${i % 2 === 1 ? " is-flipped" : ""}`}
                style={{
                  height: HEADER_H,
                  // The sliver carries the rung's colour along its own axis, so
                  // four stacked headers read as four colours rather than four
                  // grey strips with a coloured dot on them.
                  background: `linear-gradient(${i % 2 === 1 ? 270 : 90}deg, ${tint(i, t.dark ? 0.22 : 0.16)} 0%, ${tint(i, t.dark ? 0.08 : 0.05)} 100%)`,
                  borderBottom: `1px solid ${t.cardBorder}`,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    flex: "none",
                    borderRadius: 9,
                    background: accents[i],
                    color: onAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {r.n}
                </span>
                {/* The rung's name used to sit here and now opens the
                    explanation instead. What's left is the band's real job:
                    it IS the stacked sliver — four of these pile up as you
                    scroll, and the number is the only thing that has to stay
                    legible at 46px. It changes sides with the split below it
                    (see .pub-rung-head), so it always sits over the
                    explanation and the four numbers zig-zag down the pile
                    instead of lining up into one rail. A four-segment climbing
                    gauge also lived here; four ascending bars in the corner of
                    a header is the universal signal-strength glyph, so on a
                    page about a tutor it read as network status. */}
              </div>

              {/* Explanation and session, alternating sides. `is-flipped`
                  swaps the two cells in CSS; the markup order never changes,
                  so the narrow layout always reads text first. */}
              <div className={`pub-rung-split${i % 2 === 1 ? " is-flipped" : ""}`}>
                <div className="pub-rung-text">
                  {/* The rung's name, moved down out of the header band. It
                      used to carry the accent to tie the explanation back to
                      its sliver; the title below does that now, and two
                      coloured lines stacked would leave nothing for the eye to
                      land on first. */}
                  <div style={{ ...eyebrow(t), marginBottom: 6 }}>{tr(r.nameKey)}</div>
                  <h3
                    style={{
                      // The site's own display italic — the same face that
                      // carries the emphasised half of every heading on the
                      // page. It's what stops four card titles in a stack from
                      // reading as four rows of a table.
                      ...serifEm,
                      fontWeight: 400,
                      fontSize: "clamp(1.25rem,2.3vw,1.65rem)",
                      lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                      // The title takes the rung's own colour, the one on its
                      // badge and in its gradient. Safe as text because every
                      // accent is chosen to clear 5:1 on the card behind it.
                      color: accents[i],
                      margin: 0,
                    }}
                  >
                    {tr(r.titleKey)}
                  </h3>
                  <p style={{ fontSize: "clamp(13.5px,1.25vw,15px)", color: t.muted, lineHeight: 1.65, margin: "10px 0 0" }}>
                    <RayaText>{tr(r.bodyKey)}</RayaText>
                  </p>
                </div>

                <div
                  className="pub-rung-shot"
                  style={{
                    borderRadius: 13,
                    overflow: "hidden",
                    border: `1px solid ${t.cardBorder}`,
                    boxShadow: t.cardShadowSm,
                  }}
                >
                  <RungShot theme={t} rung={i} />
                </div>
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
