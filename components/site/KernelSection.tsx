"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { ConceptGraphShot, KernelLoopShot } from "./KernelDiagrams";
import Reveal from "./Reveal";
import { LEAD, SectionHeader, bandColumn, bandSection, bandTone, serifEm } from "./layout";

/**
 * What the Cognitive Kernel actually stores, and how it reaches the apps.
 *
 * The four letters are the real contract, not a metaphor: `ConceptStateOut`
 * carries `k_raw` / `k_effective`, `v_score` and `p_score` per concept, and
 * `MindsetOut.m_score` per student (`lib/kernel/types.ts`) — which is why each
 * card names its field rather than only its letter. The five alerts are
 * `KernelAlertType` verbatim, and each "response" column restates the handling
 * rule the tutor is given for that alert in `lib/raya/prompt.ts`
 * ("# Active safety alerts").
 *
 * Keep the two in sync: if the kernel contract gains or renames an alert, this
 * table is a public claim about the product and has to move with it.
 *
 * The section used to be those two lists and nothing else — an accurate
 * description of a data structure, which is not the same as evidence that
 * anything is running. The two drawings are the evidence: the first is the
 * shape of the system, with the learner at the centre of it and traffic on
 * every bond, and the second shows the one inference nothing else in the stack
 * can produce — a cause in a different subject from the failure. See
 * ./KernelDiagrams.
 *
 * The `site.kernel.map.*` keys are named for a drawing that no longer exists
 * (there was a route map here once). They caption the loop now; renaming them
 * would touch MessageKey and four locale files for nothing.
 */

const DIMENSIONS: { letter: string; field: string; nameKey: MessageKey; titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { letter: "K", field: "k_raw · k_effective", nameKey: "site.kernel.k.name", titleKey: "site.kernel.k.title", bodyKey: "site.kernel.k.body" },
  { letter: "V", field: "v_score", nameKey: "site.kernel.v.name", titleKey: "site.kernel.v.title", bodyKey: "site.kernel.v.body" },
  { letter: "P", field: "p_score", nameKey: "site.kernel.p.name", titleKey: "site.kernel.p.title", bodyKey: "site.kernel.p.body" },
  { letter: "M", field: "m_score", nameKey: "site.kernel.m.name", titleKey: "site.kernel.m.title", bodyKey: "site.kernel.m.body" },
];

const ALERTS: { nameKey: MessageKey; signalKey: MessageKey; responseKey: MessageKey }[] = [
  { nameKey: "site.kernel.a1.name", signalKey: "site.kernel.a1.signal", responseKey: "site.kernel.a1.response" },
  { nameKey: "site.kernel.a2.name", signalKey: "site.kernel.a2.signal", responseKey: "site.kernel.a2.response" },
  { nameKey: "site.kernel.a3.name", signalKey: "site.kernel.a3.signal", responseKey: "site.kernel.a3.response" },
  { nameKey: "site.kernel.a4.name", signalKey: "site.kernel.a4.signal", responseKey: "site.kernel.a4.response" },
  { nameKey: "site.kernel.a5.name", signalKey: "site.kernel.a5.signal", responseKey: "site.kernel.a5.response" },
];

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

export default function KernelSection({ theme: outer }: { theme: Theme }) {
  const tr = useTranslate();

  /**
   * This band used to be `ink` — permanently inverted, the same near-black in
   * light mode and in dark. That was defensible while the section was two lists
   * of text: a dark plate says "engine room" before a word is read.
   *
   * It stopped being defensible once the section became two drawings. An ink
   * band renders identically in both modes by design, so half the visitors to
   * the site would never see either diagram in the palette their page is in,
   * and the two of them would sit inside the page looking like something
   * pasted onto it. Following the page's own mode is what lets both drawings
   * be seen in the palette the visitor chose — which is why every colour in
   * ./KernelDiagrams comes in two.
   *
   * `base` rather than `tint`, for a boring reason: DifferentiatorsSection sits
   * directly below and is already `tint`, and two adjacent bands on the same
   * shade is the undifferentiated scroll the tone system exists to prevent.
   * Above, LadderSection paints its own four-accent wash over `cardBg`, so it
   * does not read as this band's shade even though it nominally is one.
   *
   * The page therefore has no inverted band any more. That is a real loss and
   * it is a design decision, not an oversight — see the note in
   * test/site-layout.test.ts.
   */
  const { background, theme: t } = bandTone(outer, "base");

  // Both columns clear 4.5:1 on the card behind them; the letter badges carry
  // `onAccent` on top, which is the other side of the same check.
  const accents = t.dark
    ? ["#7ab3f7", "#a78bfa", "#34d399", "#fbbf24"]
    : ["#1d4ed8", "#6d28d9", "#047857", "#b45309"];
  const onAccent = t.dark ? "#0b1220" : "#ffffff";
  const alertAccent = t.dark ? "#7ab3f7" : "#1d4ed8";

  /** The plate both diagrams sit on — same chrome as the ladder's wide shot. */
  const plate = {
    marginTop: 20,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 22,
    overflow: "hidden",
    boxShadow: t.cardShadowLg,
  } as const;

  /** The line that says what the drawing under it is. */
  const caption = (titleKey: MessageKey, bodyKey: MessageKey) => (
    <div style={{ maxWidth: LEAD, marginTop: 56 }}>
      <h3
        style={{
          ...serifEm,
          fontWeight: 400,
          fontSize: "clamp(1.35rem,2.6vw,1.8rem)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: t.text,
          margin: 0,
        }}
      >
        {tr(titleKey)}
      </h3>
      <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.7, margin: "10px 0 0" }}>
        <RayaText>{tr(bodyKey)}</RayaText>
      </p>
    </div>
  );

  return (
    <section id="kernel" style={bandSection(background)}>

      <div style={bandColumn("wide")}>
        <Reveal>
          <SectionHeader
            t={t}
            align="split"
            gap={48}
            eyebrow={tr("site.kernel.eyebrow")}
            title={
              <>
                {tr("site.kernel.title.a")}{" "}
                <em style={serifEm}>{tr("site.kernel.title.em")}</em>
              </>
            }
            lead={<RayaText>{tr("site.kernel.sub")}</RayaText>}
          />
        </Reveal>

        {/* 1 — the shape of it. Placed before the four cards on purpose: the
            letters mean very little until you can see who computes them and
            who reads them back. */}
        <Reveal>{caption("site.kernel.map.title", "site.kernel.map.body")}</Reveal>
        <Reveal>
          <div style={plate}>
            <KernelLoopShot theme={t} />
          </div>
        </Reveal>

        {/* 2 — the four fields, each named as the column it really is. */}
        <div className="pub-grid-4 pub-rail" style={{ gap: 16, marginTop: 56 }}>
          {DIMENSIONS.map((d, i) => (
            <Reveal key={d.letter} delay={i * 70} style={{ height: "100%" }}>
            <div
              className="pub-lift"
              style={{
                height: "100%",
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 20,
                padding: 22,
                boxShadow: t.cardShadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    flex: "none",
                    borderRadius: 14,
                    background: accents[i],
                    color: onAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
                    fontWeight: 800,
                    fontSize: 20,
                  }}
                >
                  {d.letter}
                </div>
                {/* The column it is stored in. A letter is a metaphor until it
                    has a field name next to it; this is the cheapest way to
                    say the four are a schema and not a diagram of one. */}
                <code
                  style={{
                    fontFamily: MONO,
                    fontSize: 11.5,
                    color: t.mutedLight,
                    background: t.inputFieldBg,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: 8,
                    padding: "4px 7px",
                    lineHeight: 1.2,
                  }}
                >
                  {d.field}
                </code>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: accents[i], marginTop: 16 }}>
                {tr(d.nameKey)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginTop: 6 }}>{tr(d.titleKey)}</div>
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.65, margin: "8px 0 0" }}>
                <RayaText>{tr(d.bodyKey)}</RayaText>
              </p>
            </div>
            </Reveal>
          ))}
        </div>

        {/* 3 — the graph, and the one inference the four numbers alone cannot
            produce: `/load_profile` returns per-concept state, never the chain
            between concepts (lib/kernel/profile-cache.ts says exactly that). */}
        <Reveal>{caption("site.kernel.graph.title", "site.kernel.graph.body")}</Reveal>
        <Reveal>
          <div style={plate}>
            <ConceptGraphShot theme={t} />
          </div>
        </Reveal>

        {/* 4 — what the walk raises when it finds something. */}
        <div style={{ marginTop: 56, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, overflow: "hidden" }}>
          <div
            className="pub-alert-row pub-alert-head"
            style={{
              padding: "14px 24px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: t.muted,
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <span>{tr("site.kernel.col.alert")}</span>
            <span>{tr("site.kernel.col.signal")}</span>
            <span>{tr("site.kernel.col.response")}</span>
          </div>

          {ALERTS.map((a, i) => (
            <div
              key={a.nameKey}
              className="pub-alert-row"
              style={{ padding: "18px 24px", borderTop: i === 0 ? "none" : `1px solid ${t.cardBorder}` }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: alertAccent }}>{tr(a.nameKey)}</span>
              {/* The two `pub-alert-label` spans are invisible on desktop, where
                  the column header carries the meaning, and appear only once
                  the row has collapsed into a single stacked column. */}
              <span style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.6 }}>
                <span className="pub-alert-label" style={{ color: t.muted, opacity: 0.75 }}>
                  {tr("site.kernel.col.signal")}
                </span>
                {tr(a.signalKey)}
              </span>
              <span style={{ fontSize: 14.5, color: t.text, lineHeight: 1.6 }}>
                <span className="pub-alert-label" style={{ color: alertAccent }}>
                  {tr("site.kernel.col.response")}
                </span>
                <RayaText>{tr(a.responseKey)}</RayaText>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
