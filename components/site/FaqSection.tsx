"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionBlend, bandColumn, bandSection, sectionH2, serifEm } from "./layout";

/**
 * The six objections a sceptical school actually arrives with.
 *
 * Hardest first, because that is the order a sceptic reads in: the model is
 * bought, we already pay for an LMS, and you are training on our children. All
 * three are answerable from this repo rather than from a brochure — see the
 * note on `site.faq.*` in lib/i18n/en.ts for what each answer is checked
 * against, and for the two questions that were dropped because the bands above
 * already demonstrate them at length.
 *
 * Built on native `<details>`, not on a JavaScript accordion. That matters for
 * one reason beyond the code being shorter: this section used to argue against
 * collapsing at all, because an answer behind a click is an answer a crawler
 * and a hurried reader never see. `<details>` settles that — the copy is in the
 * server-rendered HTML whether or not it is open, it works with JavaScript off,
 * and the keyboard and screen-reader behaviour is the browser's rather than
 * something re-implemented here with `aria-expanded` and a keydown handler.
 *
 * The shared `name` makes the group exclusive: opening one closes the last, so
 * the section stays one screen tall however long the answers get. The first is
 * open on load, because a column of six closed bars reads as an empty page.
 */

const QA: { q: MessageKey; a: MessageKey }[] = [
  { q: "site.faq.model.q", a: "site.faq.model.a" },
  { q: "site.faq.lms.q", a: "site.faq.lms.a" },
  { q: "site.faq.sees.q", a: "site.faq.sees.a" },
  { q: "site.faq.training.q", a: "site.faq.training.a" },
  { q: "site.faq.curriculum.q", a: "site.faq.curriculum.a" },
  { q: "site.faq.offline.q", a: "site.faq.offline.a" },
];

export default function FaqSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <section id="faq" style={bandSection(t.cardBg)}>
      {/* This section used to have no top blend, correctly: it followed
          DifferentiatorsSection when that band was also t.cardBg, and fading a
          colour over an identical background paints a band rather than a
          transition. Differentiators is tint now — it breaks up a run of three
          card-coloured bands between the Kernel and here — so there is a real
          edge again and the blend has work to do. */}
      <SectionBlend from={t.sectionAltBg} />

      {/* `prose`, not `text`. A question is one line and an answer is three;
          at 820 the answers ran past the width the eye can return from, and a
          collapsed list makes that worse — every open answer starts at a
          different height, so a long line has no neighbour to measure against. */}
      <div style={bandColumn("prose")}>
        <h2 style={{ ...sectionH2(t), textAlign: "center" }}>
          {tr("site.faq.title.a")}{" "}
          <em style={serifEm}>{tr("site.faq.title.em")}</em>
        </h2>

        <Reveal style={{ marginTop: 40, border: `1px solid ${t.cardBorder}`, borderRadius: 20, overflow: "hidden", background: t.sectionAltBg }}>
          {QA.map((item, i) => (
            <details
              key={item.q}
              className="pub-faq"
              name="site-faq"
              open={i === 0}
              style={{ borderTop: i === 0 ? "none" : `1px solid ${t.cardBorder}` }}
            >
              <summary className="pub-faq-q" style={{ color: t.text }}>
                <span>
                  <RayaText>{tr(item.q)}</RayaText>
                </span>
                {/* A plus that becomes a cross by turning 45°. One glyph, two
                    states, and nothing to keep in sync with the open state —
                    the stylesheet reads `[open]` straight off the element. */}
                <span className="pub-faq-mark" style={{ color: t.mutedLight }} aria-hidden>
                  +
                </span>
              </summary>
              <div className="pub-faq-a" style={{ color: t.muted }}>
                <RayaText>{tr(item.a)}</RayaText>
              </div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
