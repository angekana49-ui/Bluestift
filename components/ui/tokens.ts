/**
 * App design tokens — single source of truth for the connected app shell
 * (Raya student app + Schools admin/teacher app). Every color is derived from
 * `getTheme(isDark)`; a component should never hardcode a surface/text color —
 * it reads from the returned `AppTheme`. Values are ported verbatim from the
 * design handoff references (`design_handoff_raya_schools_app/reference-*.html`).
 *
 * The light/dark/system answer lives in lib/theme-mode.ts, shared across both
 * apps and the marketing site. Read it on mount only (see components/ui/theme.tsx)
 * — never during SSR, to avoid a hydration mismatch.
 */

export type AppTheme = {
  dark: boolean;
  pageBase: string;
  cloudOpacity: number;
  cloudFilter: string;
  hazeOverlay: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarActiveBg: string;
  sidebarDivider: string;
  /** Right notifications panel — its own tone, less blue than the sidebar. */
  rightBg: string;
  rightBorder: string;
  /**
   * The GROUND of the content zone — the surface a page's cards sit ON.
   *
   * Distinct from `cardBg` on purpose. Both used to be the same value (#ffffff
   * light, #0b111f dark), which meant a card was told from the page it sat on by
   * a single ~1.2:1 hairline and nothing else: a dashboard read as one
   * undifferentiated field, and a popover had no visible edge at all. Keeping
   * the ground one step back from the card restores figure/ground without
   * adding the shadows the flat language rules out.
   */
  contentBg: string;
  cardBg: string;
  cardBg2: string;
  cardBorder: string;
  /** Stronger border for anything INTERACTIVE (inputs, buttons, controls),
   *  where a structural hairline is not enough to find the hit area. */
  controlBorder: string;
  cardShadow: string;
  text: string;
  muted: string;
  mutedLight: string;
  /** Link colour. Links must read as links, and stay legible as body-size text. */
  link: string;
  /**
   * The PRIMARY ACTION — Create, Generate, Send, Save, Refresh.
   *
   * Brand blue rather than near-black, so the one button that does the thing is
   * the one coloured thing on the card. It used to be `#0b1220`, which is the
   * same ink as the body text: the action carried no more signal than a
   * paragraph, and on a screen with several buttons nothing said which one was
   * the point.
   */
  ctaBg: string;
  ctaText: string;
  /**
   * The NEUTRAL solid — file pickers, and anything that supplies input to an
   * action rather than performing one.
   *
   * Deliberately the opposite end from `ctaBg`: choosing a file is a step on the
   * way to Generate, not a rival to it, so the two must not compete. In dark
   * mode "black" is the page, so the neutral inverts to near-white — the same
   * role (maximum contrast, no hue) expressed for the surface it lands on.
   */
  neutralBg: string;
  neutralText: string;
  inputBg: string;
  inputBorder: string;
  bubbleBg: string;
  /**
   * The learner's OWN bubble. Its own token because it was borrowing `ctaBg`,
   * which coupled "what colour is a message I sent" to "what colour is the
   * button that does the thing" — two decisions with nothing in common. Keeping
   * them joined meant recolouring the primary action silently recoloured half
   * the conversation.
   */
  bubbleMineBg: string;
  bubbleMineText: string;
  bubbleAccentBg: string;
  rowActiveBg: string;
  pillTrackBg: string;
  gaugeTrack: string;
  switchTrackBg: string;
  switchBorder: string;
  switchKnobBg: string;
};

/* Flat two-surface language (no cloud backdrop): panels are OPAQUE and told
   apart by one 1px border, exactly like the sign-in split. `sidebarBg` is the
   tinted panel, `cardBg` the plain one — never translucent, nothing floats. */
const light: AppTheme = {
  dark: false,
  // The shell ground. Same value as `contentBg`: a panel gap or an unclaimed
  // strip should read as the page continuing, not as a white seam between two
  // tinted panels. It is also what the browser chrome mirrors (APP_THEME_COLORS).
  pageBase: "#f5f7fb",
  cloudOpacity: 0,
  cloudFilter: "none",
  hazeOverlay: "transparent",
  sidebarBg: "#eef3f9",
  sidebarBorder: "rgba(15,23,42,0.10)",
  sidebarText: "#0b1220",
  sidebarMuted: "#4a5a70",
  sidebarActiveBg: "rgba(15,23,42,0.07)",
  sidebarDivider: "rgba(15,23,42,0.10)",
  rightBg: "#f4f6f9",
  rightBorder: "rgba(15,23,42,0.14)",
  contentBg: "#f5f7fb",
  cardBg: "#ffffff",
  cardBg2: "#eaeff7",
  cardBorder: "rgba(15,23,42,0.15)",
  controlBorder: "rgba(15,23,42,0.26)",
  cardShadow: "none",
  text: "#0b1220",
  // Light-mode secondary text used to sit at #64748b (~4.8:1 on white, and it
  // dropped under AA on the tinted card/section backgrounds), with a tertiary
  // tier at #8a97a8 that was barely legible (~3:1). Both moved one step darker:
  // muted is now ~7.7:1 on white and mutedLight ~4.8:1, so secondary copy reads
  // on every surface it lands on. Dark mode was already fine and is untouched.
  //
  // mutedLight went one step darker again (#64748b → #58687d) when cardBg2 was
  // deepened to #eaeff7: at the old value it landed on 3.96:1 there, under AA.
  // It now clears 4.9:1 on the DARKEST surface it is used on, which is the only
  // number that matters — a tertiary tone that only passes on white is a tone
  // that fails wherever it is actually used.
  muted: "#44546a",
  mutedLight: "#58687d",
  // Darker than the brand blue #2f7fe0 (only ~3.6:1 on white), which links used
  // to take and which read as decoration rather than text.
  link: "#1b5fc1",
  // 6.1:1 with white, 5.7:1 against the content ground — readable as a label
  // and findable as a shape. Same value in both themes: one action colour for
  // the product, not a light one and a dark one that read as different brands.
  ctaBg: "#1f66c2",
  ctaText: "#ffffff",
  neutralBg: "#0b1220",
  neutralText: "#ffffff",
  // A field is where you type: it reads as an opening in the surface, so it goes
  // lighter than the (now tinted) ground, with a border you can actually see.
  // #dde5ee was ~1.2:1 against its own fill — an input with no visible edge.
  inputBg: "#ffffff",
  inputBorder: "#b9c6d8",
  // Raya's own bubbles. White ON the tinted ground, rather than a tint on
  // white: the reply is the thing being read, so it gets the cleanest surface
  // in the app and a visible edge (see chat-surface), instead of an off-white
  // block that dissolved into the page behind it.
  bubbleBg: "#ffffff",
  bubbleMineBg: "#0b1220",
  bubbleMineText: "#ffffff",
  bubbleAccentBg: "#fef3c7",
  rowActiveBg: "#e3eaf5",
  pillTrackBg: "rgba(0,0,0,0.05)",
  gaugeTrack: "#e2e8f0",
  switchTrackBg: "linear-gradient(180deg,#d7e9f7,#f3f9fd)",
  switchBorder: "rgba(255,255,255,0.7)",
  switchKnobBg: "#ffffff",
};

const dark: AppTheme = {
  dark: true,
  pageBase: "#0b111f",
  cloudOpacity: 0,
  cloudFilter: "none",
  hazeOverlay: "transparent",
  sidebarBg: "#070c17",
  sidebarBorder: "rgba(255,255,255,0.09)",
  sidebarText: "#ffffff",
  sidebarMuted: "#94a3b8",
  sidebarActiveBg: "rgba(255,255,255,0.1)",
  sidebarDivider: "rgba(255,255,255,0.09)",
  rightBg: "#10141c",
  rightBorder: "rgba(255,255,255,0.13)",
  contentBg: "#0b111f",
  // Was #0b111f — the same value as pageBase and contentBg, so a card, a modal
  // and a popover were all invisible against the surface behind them.
  cardBg: "#131c30",
  cardBg2: "#1c2742",
  cardBorder: "rgba(255,255,255,0.14)",
  controlBorder: "rgba(255,255,255,0.28)",
  cardShadow: "none",
  text: "#eef2f8",
  muted: "#9aa7bd",
  // #7c8aa3 landed on 4.25:1 against cardBg2 (#1c2742), under AA — and cardBg2
  // is most of where this tone renders. One step brighter clears 5.4:1 there
  // while staying visibly dimmer than `muted`.
  mutedLight: "#8b98af",
  link: "#7ab3f7",
  // The brand blue #2f7fe0 carries white at only 4.0:1 — the primary BUTTON
  // LABEL, under AA, on the most-pressed control in the dark app. A deeper blue
  // from the same family takes white to 5.6:1 and still clears 3:1 against the
  // dark ground, so the button is both readable and findable.
  ctaBg: "#1f66c2",
  ctaText: "#ffffff",
  // Inverted, not "black": a #0b1220 button on a #0b111f page would be a hole.
  // The role is "maximum contrast, no hue", and on a dark ground that is light.
  neutralBg: "#e9eef7",
  neutralText: "#0b1220",
  inputBg: "#0a1120",
  inputBorder: "rgba(255,255,255,0.26)",
  bubbleBg: "#1c2742",
  bubbleMineBg: "#1f66c2",
  bubbleMineText: "#ffffff",
  bubbleAccentBg: "#3a3010",
  rowActiveBg: "#1c2742",
  pillTrackBg: "rgba(255,255,255,0.06)",
  gaugeTrack: "rgba(255,255,255,0.12)",
  switchTrackBg: "linear-gradient(180deg,#111b2a,#0b1220)",
  switchBorder: "rgba(255,255,255,0.15)",
  switchKnobBg: "#0b1220",
};

export function getTheme(isDark: boolean): AppTheme {
  return isDark ? dark : light;
}

/**
 * Font stacks. These MIRROR the role properties defined in app/globals.css
 * `:root` — CSS rules name `var(--font-display)`, inline styles name `display`,
 * and both resolve to the same face. Change one, change the other.
 *
 * The faces themselves are loaded once, by app/layout.tsx.
 */
/**
 * Inter — the long-form reading face, and NOT what the app is set in.
 *
 * The product's face is declared once, on `html, body` in globals.css, and is
 * the display face. This token exists for the opposite case: a surface with
 * paragraphs to be read rather than chrome to be recognised. Nothing imports
 * it today, which is deliberate and worth knowing — it was previously unused
 * by ACCIDENT, while body text quietly rendered in the operating system's own
 * UI font. Reach for it if a reading surface ever needs a neutral face back.
 */
export const sans = "var(--font-inter),'Inter',ui-sans-serif,system-ui,sans-serif";
/**
 * The display face — headings, nav, page titles, anything that sets a tone
 * rather than being read in bulk.
 *
 * It must NOT be the body face. That is the whole job, and it is the thing an
 * earlier pass got wrong: it set the titles in Inter, tracked hard, next to
 * body copy also in Inter. Tight Inter over Inter is still one voice, and a
 * reader registers that as having no personality rather than as a font choice.
 * Resend's own CSS keeps the two apart — Inter on `html`, ABC Favorit on
 * `.font-display` — and the gap between them is the effect.
 *
 * "ABC Favorit" leads the stack and is shipped by nobody: it is Dinamo's retail
 * face, the one Resend actually uses, and naming it costs nothing while making
 * a purchased licence a drop-in (add the @font-face, the whole product moves).
 * Behind it, Space Grotesk — free, and the closest thing to Favorit's
 * squared-off character that we can legally serve.
 */
export const display =
  "'ABC Favorit',var(--font-space-grotesk),'Space Grotesk',ui-sans-serif,system-ui,sans-serif";
/** Editorial accent — the Domaine Display slot, standing on Instrument Serif. */
export const editorial =
  "'Domaine Display',var(--font-instrument-serif),'Instrument Serif',Georgia,serif";
/**
 * IBM Plex Sans, which used to be the display face everywhere.
 *
 * It has ONE consumer left, deliberately: the billing cards. They were held
 * back when the rest of the product moved, so the surface where someone is
 * being asked for money keeps the face they last saw it in rather than
 * changing under them in the same release. It is also the only face in the
 * product that is not preloaded-by-default (see app/layout.tsx) — nothing but
 * a billing screen pays for it.
 */
export const billingDisplay =
  "var(--font-plex),'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif";
export const hand = "var(--font-caveat),'Caveat',cursive";

/**
 * Letter-spacing, which is doing more work here than the font file is.
 *
 * Display type reads as designed rather than defaulted when it is set tight,
 * and Resend sets it VERY tight — -0.045em at 500 weight. We were setting
 * -0.01em at 800: heavy and loose, which is the house style of every dashboard
 * generated in an afternoon. The scale below is per-size because what is
 * correct on a 34px heading is illegible on a 13px label.
 *
 * Ours stops at -0.035em rather than copying Resend's -0.045em: their number
 * was measured against ABC Favorit, which is narrower and tighter-apertured
 * than Space Grotesk. A tracking value belongs to a face, not to a brand.
 */
export const tracking = {
  display: "-0.035em", // 24px and up — page titles, hero numerals
  tight: "-0.02em", // 17–23px — card and section headings
  snug: "-0.01em", // 15–16px — nav, chips, dense headers
  normal: "0",
  caps: "0.14em", // the only positive one: all-caps micro-labels
} as const;

/**
 * The display face AND its tuning in one spread, because the two are not
 * separable — the tracking is what makes it look deliberate, and a call site
 * that takes the family while keeping `fontWeight: 800` gets neither face.
 *
 *   <div style={{ ...displayType(23), color: t.text }}>Tools Studio</div>
 *
 * `weight` defaults to 600. Resend's own display weight is 500; 600 is a half
 * step up, because our headings sit on busier surfaces than a marketing page
 * and 500 goes soft against a card border. Pass 500 for large type that has
 * room to breathe, 700 where a heading must out-rank another heading.
 */
export function displayType(size: number, weight: number = 600) {
  return {
    fontFamily: display,
    fontSize: size,
    fontWeight: weight,
    letterSpacing:
      size >= 24 ? tracking.display : size >= 17 ? tracking.tight : tracking.snug,
  } as const;
}

/**
 * Type scale (px) — the single source of truth for font sizes, replacing the
 * inline magic numbers (11 / 12.5 / 13.5 …) scattered across the app. The
 * baseline is lifted for a more current, breathable feel: body copy sits at
 * `base` (14), secondary/meta at `sm`/`xs`, headings above. `xs` (12) is the
 * floor — nothing renders smaller. Prefer these tokens so the whole app can be
 * re-scaled from one place.
 */
export const text = {
  // The reading band moved up one step with the 541 inline sizes beside it
  // (same pass, same reason): 222 places in the app rendered at 13px, which is
  // small for anyone and small twice over for the children this teaches. The
  // token and the literals have to agree or the scale means nothing.
  xs: 14, // micro-labels, status, timestamps — the floor
  sm: 16, // secondary text, chips, captions, inline errors
  base: 17, // body copy, message bubbles, inputs
  // Display sizes are unchanged. They were retuned in this same release with
  // their own tracking (`displayType`), and growing them again would undo it.
  lg: 20, // emphasis, sub-headings
  xl: 26, // card/section headings, KPI values
  "2xl": 34, // page headings
} as const;

/** Shape scale (border-radii). Buttons/pills/badges use `pill`. */
export const radius = {
  pill: 99,
  card: 22,
  cardInner: 20,
  panel: 16,
  chip: 14,
  control: 10,
};

/** Semantic status colors — mastery/risk badges, deltas. Theme-independent. */
export const status = {
  positive: "#10b981",
  ok: "#22c55e",
  warn: "#f59e0b",
  danger: "#dc2626",
  accentAmber: "#f59e0b",
  aiIndigo: "#6366f1",
};
