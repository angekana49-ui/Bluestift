import type { CSSProperties } from "react";
import type { Theme } from "./theme";

/**
 * The public site's page template — measures, vertical rhythm and display type,
 * in one place.
 *
 * Before this file every page invented its own numbers. The measures in use were
 * 560 / 640 / 720 / 760 / 820 / 900 / 940 / 1000 / 1080 / 1100 — ten of them, six
 * on the landing page alone, so the content edge moved under the visitor as they
 * scrolled. Page tops were 140 on some routes and 150 on others. The same section
 * heading was copied five times at three different sizes (2.6 / 2.8 / 2.9rem),
 * and the paragraph under it existed at 440, 520, 560, 580, 600 and 620.
 *
 * None of that was decided; it accumulated. What follows is decided.
 *
 * Rule of thumb when adding a page: pick the measure by ROLE, not by how the
 * content happens to look today. If a new role genuinely appears, add a token
 * here rather than a number over there.
 */

/** The four measures. Nothing on the public site may use a fifth. */
export const MEASURE = {
  /** One column of inputs — Contact, Feedback, Survey. */
  form: 560,
  /** Long-form reading — the legal pages and blog articles. At 15px this is
   *  ~80 characters a line, near the top of the comfortable range; wider
   *  (the legal pages used to be 720) and the eye loses the line return. */
  prose: 680,
  /** Text carrying cards, rows or tabs — FAQ, blog index, the ladder. */
  text: 820,
  /** Grids and media — the 3- and 4-up sections, hero mockup, nav, footer. */
  wide: 1080,
} as const;

export type Measure = keyof typeof MEASURE;

/** The paragraph under a centred heading. One width, everywhere. */
export const LEAD = 560;

/** Horizontal page gutter. */
export const GUTTER = 24;
/** Clears the sticky navbar (top:12, ~60px tall) and leaves it room to breathe. */
export const PAGE_TOP = 150;
/** Air between the last block of a page and the footer. */
export const PAGE_BOTTOM = 96;
/** Vertical rhythm between landing sections. */
export const SECTION_Y = 96;

/**
 * Outer <section> for a standalone page (Research, Pricing, legal, forms).
 * `overflow: hidden` is safe here — no standalone page uses position:sticky
 * inside. Landing sections must NOT get it: it would kill LadderSection's
 * scroll-stack.
 */
export const pageSection: CSSProperties = {
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
  padding: `${PAGE_TOP}px ${GUTTER}px 0`,
};

/** Inner column of a standalone page. */
export function pageColumn(measure: Measure): CSSProperties {
  return {
    maxWidth: MEASURE[measure],
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    paddingBottom: PAGE_BOTTOM,
  };
}

/** Outer <section> for a landing band. */
export function bandSection(background: string): CSSProperties {
  return {
    position: "relative",
    background,
    padding: `${SECTION_Y}px ${GUTTER}px`,
    scrollMarginTop: GUTTER,
  };
}

/** Inner column of a landing band — sits above the band's blend layer. */
export function bandColumn(measure: Measure): CSSProperties {
  return { position: "relative", maxWidth: MEASURE[measure], margin: "0 auto" };
}

/* ------------------------------------------------------------------ type --- */

/** The italic serif half of every heading on the site. */
export const serifEm: CSSProperties = {
  fontFamily: "'Instrument Serif',serif",
  fontStyle: "italic",
};

/** Page title (h1) — standalone pages. */
export function pageH1(t: Theme): CSSProperties {
  return {
    fontFamily: "'IBM Plex Sans',sans-serif",
    fontWeight: 900,
    fontSize: "clamp(1.6rem,4vw,2.4rem)",
    letterSpacing: "-0.02em",
    margin: "0 0 10px",
    color: t.text,
  };
}

/** Section title (h2) — landing bands. One size, not three. */
export function sectionH2(t: Theme): CSSProperties {
  return {
    fontFamily: "'IBM Plex Sans',sans-serif",
    fontWeight: 900,
    fontSize: "clamp(1.7rem,3.6vw,2.6rem)",
    letterSpacing: "-0.02em",
    margin: 0,
    color: t.text,
  };
}

/** Small uppercase label above a section title. */
export function eyebrow(t: Theme): CSSProperties {
  return {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: t.muted,
    fontWeight: 600,
  };
}

/** The paragraph under a centred heading. */
export function lead(t: Theme): CSSProperties {
  return {
    maxWidth: LEAD,
    margin: "14px auto 0",
    fontSize: 16,
    color: t.text,
    lineHeight: 1.7,
  };
}

/* ----------------------------------------------------------------- blend --- */

/**
 * The fade that joins one landing band to the one above it. The `from` colour
 * must be the PREVIOUS section's background — fading a colour into an identical
 * background paints a visible band instead of a transition, which is why
 * FaqSection deliberately has none.
 */
export function SectionBlend({ from }: { from: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: "0 0 auto 0",
        height: 140,
        background: `linear-gradient(180deg, ${from} 0%, transparent 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}
