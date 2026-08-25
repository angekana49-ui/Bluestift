"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { PositionShot } from "./PositionShot";
import Reveal from "./Reveal";
import { LEAD, SectionHeader, bandColumn, bandSection, bandTone, serifEm } from "./layout";

/**
 * Where this product sits — stated, not compared.
 *
 * This band was a ✕/✓ table scoring four categories of competitor. It was
 * wrong on three counts and only one of them was about taste.
 *
 * It defined the product by negation: four sentences about other people's
 * software, on our own page. It was self-refuting, because this runs on bought
 * frontier models, so marking the model layer wrong invites "he is attacking
 * the API he pays for" — and after that thought the rest of the page is
 * suspect. And every claim of the form "they cannot do X" is closed by
 * someone's next release; that already happened here once, when frontier
 * models shipped long context and killed the old "the difference is the
 * memory" line.
 *
 * The durable answer is not a comparison at all. It is a position: neither a
 * gradebook nor a tutor, and the layer between them that nothing occupies.
 * That answers "how is this different from ChatGPT" without naming anybody,
 * and it answers "what stops an incumbent shipping it" too — a layer is a
 * product shape, and a shape is not closed by a feature.
 *
 * Two lines from the old table survive, as our own arguments rather than as a
 * verdict on someone else: the model is the floor, and the record is narrow on
 * purpose. Both are checkable. The second one is checkable in this repo —
 * lib/school-admin.ts reads concept and mindset state, insights and follow-ups,
 * and no message table at all.
 *
 * See ./PositionShot for the drawing, which makes the argument on time.
 */

export default function DifferentiatorsSection({ theme: outer }: { theme: Theme }) {
  const tr = useTranslate();

  /* Tint: KernelSection above and FaqSection below are both the card colour,
     and three bands on one shade is the undifferentiated scroll the tone system
     exists to prevent. (This used to say it was absorbing a step down from an
     inverted Kernel band. That band stopped being inverted — the choice
     outlived its reason, so the reason here is now the one that holds.) */
  const { background, theme: t } = bandTone(outer, "tint");

  /** The plate the drawing sits on — same chrome as the Kernel band's. */
  const plate = {
    marginTop: 40,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 22,
    overflow: "hidden",
    boxShadow: t.cardShadowLg,
  } as const;

  const note = (key: MessageKey) => (
    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: t.muted }}>
      <RayaText>{tr(key)}</RayaText>
    </p>
  );

  return (
    <section id="position" style={bandSection(background)}>
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

        <Reveal>
          <div style={plate}>
            <PositionShot theme={t} />
          </div>
        </Reveal>

        {/* The two claims that survived the comparison table, now made about
            this product rather than against another one. Kept to the reading
            measure — they are prose, and prose at the drawing's width is a
            paragraph nobody finishes. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 320px), 1fr))`,
            gap: "18px clamp(24px, 4vw, 56px)",
            maxWidth: LEAD * 1.6,
            marginTop: 40,
          }}
        >
          {note("site.pos.note.model")}
          {note("site.pos.note.privacy")}
        </div>
      </div>
    </section>
  );
}
