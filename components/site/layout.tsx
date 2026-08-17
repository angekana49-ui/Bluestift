import type { CSSProperties, ReactNode } from "react";
import { getTheme, type Theme } from "./theme";

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

/* --------------------------------------------------------------- rhythm --- */

/**
 * The vertical rhythm, as a CSS length rather than a number.
 *
 * PAGE_TOP and SECTION_Y are desktop values, and they were being applied
 * verbatim at every width. On a 390px phone that meant 96px above and below all
 * nine landing bands — measured, 1536px, or 1.8 screens of the page spent on
 * nothing, on the device with the least room to spend. Space that reads as
 * composure at 1440px reads as an empty page on a phone, because what the eye
 * judges is the gap relative to the column, and the column got four times
 * narrower while the gap did not move at all.
 *
 * The floors are the point of the clamps. `SECTION_Y_MIN` still separates two
 * bands clearly at 390px; `PAGE_TOP_MIN` still clears the sticky navbar (top:12
 * plus ~60px tall) with room under it, which is the one thing page-top padding
 * must not stop doing.
 *
 * The numeric constants stay exported and stay the maxima: they are what the
 * clamps reach, and what test/site-layout.test.ts pins.
 */
export const SECTION_Y_MIN = 56;
export const PAGE_TOP_MIN = 104;

/** Band-to-band rhythm. Reaches SECTION_Y at ~1200px and floors on a phone. */
export const sectionY = `clamp(${SECTION_Y_MIN}px, 8vw, ${SECTION_Y}px)`;
/** Top of a standalone page. Reaches PAGE_TOP at ~1250px and floors on a phone. */
export const pageTop = `clamp(${PAGE_TOP_MIN}px, 12vw, ${PAGE_TOP}px)`;

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
  padding: `${pageTop} ${GUTTER}px 0`,
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
    padding: `${sectionY} ${GUTTER}px`,
    scrollMarginTop: GUTTER,
  };
}

/** Inner column of a landing band — sits above the band's blend layer. */
export function bandColumn(measure: Measure): CSSProperties {
  return { position: "relative", maxWidth: MEASURE[measure], margin: "0 auto" };
}

/* ------------------------------------------------------------------ tone --- */

/**
 * A band's tone — the page's punctuation, and the reason it has any.
 *
 * Measured on the live landing page, every band from the hero to the footer was
 * one of two near-white shades: `#ffffff` five times, `#eef2f8` twice, the rest
 * transparent over the page gradient. Ten screens with no darker moment except
 * the closing CTA, so the sections stopped reading as sections and became one
 * undifferentiated scroll.
 *
 *  - `base` — the card colour. The default; most bands are this.
 *  - `tint` — one step off it. Separates two adjacent bands, nothing more.
 *  - `ink`  — inverted. Reserved for the one band that earns it.
 *
 * `ink` is the interesting one, and it is deliberately cheap to implement: the
 * site already maintains a full palette for a dark page, so an inverted band
 * simply hands its children `getTheme(true)` and every card, border and muted
 * colour inside it is already correct. Nothing needs an on-dark variant.
 *
 * A consequence worth knowing before using it: an ink band looks the same in
 * light and dark mode (only the band colour behind the cards shifts). That is
 * the intent — the band is a place, and the place doesn't change when the
 * lights do.
 *
 * Use it once. Two inverted bands on one page is a stripe, not an accent.
 */
export type Tone = "base" | "tint" | "ink";

/**
 * The band's own style plus the theme its children must use.
 *
 * Always read `theme` back out and pass it down — for `ink` it is NOT the theme
 * you handed in, and using the outer one inside an inverted band renders dark
 * text on a dark field.
 */
export function bandTone(t: Theme, tone: Tone): { background: string; theme: Theme } {
  if (tone === "ink") {
    return {
      // Darker than the dark palette's own page background, so the band still
      // reads as a distinct plate when the whole site is already dark.
      background: t.dark ? "#06090f" : "#0b1220",
      theme: getTheme(true),
    };
  }
  return { background: tone === "tint" ? t.sectionAltBg : t.cardBg, theme: t };
}

/* ------------------------------------------------------------------ type --- */

/**
 * The two font stacks the site's headings use.
 *
 * The `var(--font-*)` half is the one that actually resolves: app/layout.tsx
 * loads the faces through next/font and exposes each as a custom property, so
 * naming the family alone would only hit it if the visitor happened to have it
 * installed. The quoted names stay behind it as the fallback they always were.
 */
const DISPLAY_FONT = "var(--font-plex),'IBM Plex Sans',sans-serif";
const ACCENT_FONT = "var(--font-instrument-serif),'Instrument Serif',serif";

/** The italic serif half of every heading on the site. */
export const serifEm: CSSProperties = {
  fontFamily: ACCENT_FONT,
  fontStyle: "italic",
};

/** Page title (h1) — standalone pages. */
export function pageH1(t: Theme): CSSProperties {
  return {
    fontFamily: DISPLAY_FONT,
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
    fontFamily: DISPLAY_FONT,
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

/**
 * The header every landing band opens with — eyebrow, title, lead.
 *
 * This existed nine times as copy-pasted markup, and all nine were centred. On
 * a ten-screen page that is the whole problem: the eye gets the same shape at
 * the same width in the same place nine times running, so nothing announces
 * that a new argument has started and the page reads as one long section.
 *
 * `split` is the fix — title left, lead right, bottom-aligned. It is not
 * decoration: an asymmetric header is also faster to read at this measure,
 * because the title stops spanning 1080px and the lead stops being a centred
 * island. Use it for the middle of an argument and keep `center` for its
 * opening and its close, so the change of shape carries meaning rather than
 * alternating for its own sake.
 *
 * Callers wrap this in <Reveal> themselves — keeping the animation out of here
 * means one less reason for the layout module to depend on a component.
 */
export function SectionHeader({
  t,
  eyebrow: eb,
  title,
  lead: ld,
  align = "center",
  gap = 44,
}: {
  t: Theme;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "split";
  /** Space between the header and the band's content. */
  gap?: number;
}) {
  const split = align === "split";
  return (
    <div
      className={split ? "pub-band-split" : undefined}
      style={split ? { marginBottom: gap } : { textAlign: "center", marginBottom: gap }}
    >
      <div>
        {eb ? <div style={eyebrow(t)}>{eb}</div> : null}
        <h2 style={{ ...sectionH2(t), margin: eb ? "10px 0 0" : 0 }}>{title}</h2>
      </div>
      {ld ? (
        // Centred, the lead is a fixed 560 island under the title. Split, it owns
        // its column and the grid decides the measure.
        <p style={split ? { ...lead(t), maxWidth: "none", margin: 0 } : lead(t)}>{ld}</p>
      ) : null}
    </div>
  );
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
