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
 * The scroll-stack: each card pins STACK_STEP lower than the one before, so
 * the cards already read stay on screen and pile into a literal ladder while
 * you read the next. What each one leaves showing is its coloured top edge —
 * enough to count the rungs and tell them apart, and cheap enough that four of
 * them don't push the last card off the bottom of the screen. It degrades to a
 * plain list on short viewports and under prefers-reduced-motion (see
 * `.pub-stack-card`).
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
 * The lip a pinned card leaves showing above the next one, and therefore the
 * offset between two pinned cards.
 *
 * There used to be a 46px header band here to be that sliver, holding the rung
 * number. It cost twice: 46px of every card spent on chrome, and 46px of step
 * spent four times over — the last card pins at STICKY_BASE + 3 × STACK_STEP,
 * and everything below it still has to clear a laptop viewport. The number
 * moved into the card's own content and the band went with it. What shows now
 * is the card's coloured top edge, which is all the sliver ever had to be once
 * each rung carries its own hue.
 */
const STACK_STEP = 26;
/** Clears the sticky navbar (top:12, ~60px tall) with a little air. */
const STICKY_BASE = 92;

export default function LadderSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();

  /**
   * One hue per rung, and it is the same hue everywhere that rung appears: the
   * number badge, the card's gradient, its top edge, and the italic title.
   * Four cards that stack on top of each other need to be told apart at a
   * glance, and colour does that faster than reading the number.
   *
   * The order is the climb, in the product's own status palette: violet opens,
   * blue prompts, amber is the intervention (the Kernel's "in progress"), green
   * closes (its "mastered"). The section ends on the colour the profile uses
   * for a concept that has landed, which is the whole point of the last rung.
   *
   * Light mode gets dark accents (white glyph on top), dark mode light ones
   * (dark glyph). Every light-mode value clears 4.7:1 against the card at its
   * most saturated corner, so the same colour is safe on the badge AND as
   * heading text sitting on top of the gradient.
   */
  const accents = t.dark
    ? ["#a78bfa", "#7ab3f7", "#fbbf24", "#34d399"]
    : ["#5b21b6", "#1a4f94", "#7c3a06", "#065f46"];
  /**
   * The channels the tints are mixed from — and in dark mode deliberately NOT
   * the accent. Deepening a gradient there by pouring in more of a pale accent
   * does the opposite of what it sounds like: it lightens the card, and walks
   * the title's contrast down as it goes. Dark mode tints with the deep end of
   * the same hue instead, so more opacity really does mean darker.
   */
  const rgb = t.dark
    ? ["76,29,149", "23,58,109", "124,58,6", "6,78,59"]
    : ["91,33,182", "26,79,148", "124,58,6", "6,95,70"];
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
          background: `linear-gradient(180deg, ${tint(0, t.dark ? 0.2 : 0.08)} 0%, ${tint(1, t.dark ? 0.2 : 0.085)} 34%, ${tint(2, t.dark ? 0.17 : 0.075)} 68%, ${tint(3, t.dark ? 0.18 : 0.08)} 100%)`,
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
                top: STICKY_BASE + i * STACK_STEP,
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
                background: `linear-gradient(${i % 2 === 1 ? 250 : 110}deg, ${tint(i, t.dark ? 0.55 : 0.22)} 0%, ${tint(i, t.dark ? 0.28 : 0.1)} 45%, transparent 88%), ${t.sectionAltBg}`,
                // The rung's colour as a rule along the top edge — this is what
                // shows as the pinned sliver now that the header band is gone,
                // so it has to carry the hue on its own. Every side is set
                // individually rather than `border` plus a `borderTop`
                // override: a shorthand and a longhand for the same property
                // both changing across the theme toggle is undefined order.
                borderTop: `3px solid ${accents[i]}`,
                borderRight: `1px solid ${t.cardBorder}`,
                borderBottom: `1px solid ${t.cardBorder}`,
                borderLeft: `1px solid ${t.cardBorder}`,
                borderRadius: 18,
                boxShadow: t.cardShadowLg,
                overflow: "hidden",
                marginBottom: i === RUNGS.length - 1 ? 0 : 18,
              }}
            >
              {/* Explanation and session, alternating sides. `is-flipped`
                  swaps the two cells in CSS; the markup order never changes,
                  so the narrow layout always reads text first. */}
              <div className={`pub-rung-split${i % 2 === 1 ? " is-flipped" : ""}`}>
                <div className="pub-rung-text">
                  {/* The number and the rung's name, on one line. Both used to
                      live in a 46px band above, which spent that height on
                      chrome and spent it again four times over in the stack's
                      step. Here they cost a single line of the content they
                      were labelling. The number still changes sides with every
                      card, because the whole column does. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
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
                    {/* The rung's name. It used to carry the accent to tie the
                        explanation back to its sliver; the badge beside it and
                        the title below do that now, and three coloured things
                        in a row would leave nothing for the eye to land on. */}
                    <div style={eyebrow(t)}>{tr(r.nameKey)}</div>
                  </div>
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
