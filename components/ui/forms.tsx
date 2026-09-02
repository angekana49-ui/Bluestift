import type { CSSProperties } from "react";
import { radius, text, type AppTheme } from "./tokens";

/** Themed building blocks for the small form/detail cards across the app. */

/**
 * A card. It sits ON the content ground, so it takes `cardBg` — the ground is
 * `contentBg` and the two are deliberately different values now. It used to
 * take `cardBg2`, which on a white page made an off-white slab with a 1.2:1
 * hairline: a card you had to look for.
 */
export const panelCard = (t: AppTheme): CSSProperties => ({
  background: t.cardBg,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: radius.card,
  padding: 20,
  marginBottom: 16,
});

export const cardTitle = (t: AppTheme): CSSProperties => ({
  fontSize: text.lg,
  fontWeight: 700,
  color: t.text,
  margin: "0 0 6px",
});

/**
 * 16px is not a style choice here: below it, every iOS browser zooms the page
 * on focus and the layout the student was looking at jumps. It is also the body
 * size the rest of the app reads at (`text.base`), so a field stops being the
 * one place the type shrinks.
 */
export const textInput = (t: AppTheme): CSSProperties => ({
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: radius.control,
  padding: "11px 14px",
  width: "100%",
  fontSize: text.base,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
});

/**
 * The primary action of a card — Create, Generate, Save, Start.
 *
 * Brand blue, not the near-black it used to be. Black is the body ink, so the
 * one button that does the thing looked like a paragraph in a rounded box, and
 * on a card with two or three buttons nothing said which one was the point.
 */
export const ctaButton = (t: AppTheme): CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "1px solid transparent",
  borderRadius: radius.pill,
  padding: "10px 20px",
  fontSize: text.sm,
  fontWeight: 650,
  fontFamily: "inherit",
  lineHeight: 1.2,
  cursor: "pointer",
});

/**
 * The neutral solid — file pickers, and anything that FEEDS an action rather
 * than performing one.
 *
 * Picking a file is a step on the way to Generate, not a rival to it, so the
 * two must be told apart at a glance and must not both be blue. See
 * `neutralBg` in tokens.ts for why this is not literally "black" in dark mode.
 */
export const neutralButton = (t: AppTheme): CSSProperties => ({
  background: t.neutralBg,
  color: t.neutralText,
  border: "1px solid transparent",
  borderRadius: radius.pill,
  padding: "9px 16px",
  fontSize: text.sm,
  fontWeight: 650,
  fontFamily: "inherit",
  lineHeight: 1.2,
  cursor: "pointer",
});

/**
 * The row a card's actions sit in — pinned to the TRAILING edge.
 *
 * Primary actions used to sit hard left, under whatever field they submitted,
 * which put them at the start of the reading order rather than at its end: the
 * button was the first thing the eye met on the way down a form instead of the
 * last. Trailing-edge is where a form's commit belongs, and doing it in one
 * shared style keeps the twenty-odd cards agreeing on it.
 *
 * `wrap: "wrap-reverse"` so that when a hint sits beside the button and the row
 * has to break, the BUTTON stays on top rather than being pushed under its own
 * explanation.
 */
export const formActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap-reverse",
  gap: 12,
  marginTop: 16,
};

/**
 * The secondary button. Its old form — `cardBg2` fill, a 1.2:1 border, 13px
 * text in the muted tone — was the single least legible control in the app:
 * on a white page it was an off-white rectangle with grey text and no edge.
 * It now takes the card surface (so it lifts off the ground), `controlBorder`
 * (the interactive tier, ~3:1, which is where a control's outline has to be to
 * be findable) and the primary ink.
 */
export const ghostButton = (t: AppTheme): CSSProperties => ({
  background: t.cardBg,
  color: t.text,
  border: `1px solid ${t.controlBorder}`,
  borderRadius: radius.pill,
  padding: "8px 16px",
  fontSize: text.sm,
  fontWeight: 650,
  fontFamily: "inherit",
  lineHeight: 1.2,
  cursor: "pointer",
});

/** Destructive confirm. Always a filled button — a red outline on a pale fill
 *  reads as a warning label, not as the thing that does the deleting. */
export const dangerButton = (): CSSProperties => ({
  background: "#dc2626",
  color: "#ffffff",
  border: "1px solid transparent",
  borderRadius: radius.pill,
  padding: "10px 20px",
  fontSize: text.sm,
  fontWeight: 650,
  fontFamily: "inherit",
  lineHeight: 1.2,
  cursor: "pointer",
});

export const linkText = (t: AppTheme): CSSProperties => ({
  color: t.link,
  textDecoration: "none",
  fontSize: text.sm,
  fontWeight: 600,
});
