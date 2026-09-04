// BlueStift public marketing site — theme tokens (single source of truth).
// Home's richer light palette is used as the canonical light variant for every
// public page, per the design handoff (design_handoff_bluestift_landing).
// This is intentionally SEPARATE from components/ui/tokens.ts (the connected
// app's theme) — the two never mix.

export interface Theme {
  dark: boolean;
  pageBg: string;
  text: string;
  muted: string;
  mutedLight: string;
  /** Prose/nav link colour. Links must read as links — blue, not body-coloured. */
  link: string;

  navBg: string;
  navBorder: string;
  navShadow: string;
  pillTrackBg: string;
  pillActiveBg: string;
  pillActiveShadow: string;

  switchTrackBg: string;
  switchBorder: string;
  switchKnobBg: string;

  ctaBg: string;
  ctaText: string;

  cardBg: string;
  cardBorder: string;
  /** Resting elevation for a card sitting inside a section — a contact shadow
   *  plus a wide soft one. Lighter than `cardShadow`, which is for cards that
   *  are meant to float off the page (feature cards, the hero dashboard). */
  cardShadowSm: string;
  cardShadow: string;
  cardShadowLg: string;
  /** Elevation a `.pub-lift` card rises to on hover. Published as the
   *  `--pub-lift-shadow` custom property by the page roots, because the hover
   *  state can only be expressed in CSS while the theme lives in React state. */
  liftShadow: string;

  footerBg: string;
  footerBorder: string;
  footerMuted: string;

  inputBorder: string;
  inputBg: string;
  inputFieldBg: string;
  inputPlaceholder: string;

  sectionAltBg: string;
  pricingBg: string;
  heroEndSolid: string;
  pricingStart: string;
  pricingMid: string;
  pricingEnd: string;
  heroFade: string;

  cloudFilter: string;
  cloudOpacity: number;
  chipBg: string;
  chipBorder: string;

  wordmarkA: string;
  wordmarkB: string;
  birdColor: string;
  hazeColor: string;

  greenBg: string;
  greenBorder: string;
  greenText: string;
  greenDot: string;
  greenSolid: string;

  diffRowBg: string;
  diffRowBorder: string;
  diffStrong: string;
  diffSoft: string;

  crossBg: string;
  crossText: string;
  labelMuted: string;

  orangeBg: string;
  orangeBorder: string;
  orangeText: string;
  orange: string;
}

const light: Theme = {
  dark: false,
  // Was #eef3f9→#dde8f3→#c9d9ea — a gradient that stayed inside a 86-96%
  // lightness band top to bottom, so the "colour" never actually read past a
  // faint grey tint. This keeps the same three-stop shape (light at the nav,
  // deepening by the fold) but pushes the saturation and the bottom stop hard
  // enough that the blue is visibly a colour rather than a shade of white.
  pageBg: "linear-gradient(180deg,#e7effd 0%,#c3ddfb 45%,#8fbcf2 100%)",
  text: "#0b1220",
  // Was #64748b — ~4.8:1 on white and BELOW AA on the tinted section/pricing
  // backgrounds this text actually sits on, which is what made body copy look
  // washed out. Now ~7.7:1 on white, ~6.8:1 on #eef2f8. mutedLight (the dimmer
  // tier) stays lighter than muted, as the naming implies.
  muted: "#44546a",
  mutedLight: "#546578",
  // Darker than wordmarkB (#2f7fe0, only ~3.6:1) so links stay legible as text
  // rather than only as decoration.
  link: "#1b5fc1",

  // Was 0.75 — too sheer. The bar is sticky over a page of headings, so at some
  // scroll position there is always copy directly behind it, and at 0.75 that
  // copy ghosted through and collided with the nav's own labels.
  navBg: "rgba(255,255,255,0.9)",
  navBorder: "rgba(255,255,255,0.65)",
  navShadow: "0 18px 60px rgba(15,23,42,0.14)",
  pillTrackBg: "rgba(0,0,0,0.06)",
  pillActiveBg: "#ffffff",
  pillActiveShadow: "0 1px 4px rgba(15,23,42,0.1)",

  switchTrackBg: "linear-gradient(180deg,#d7e9f7,#f3f9fd)",
  switchBorder: "rgba(255,255,255,0.7)",
  switchKnobBg: "#ffffff",

  ctaBg: "#0b1220",
  ctaText: "#ffffff",

  cardBg: "#ffffff",
  cardBorder: "rgba(15,23,42,0.07)",
  cardShadowSm: "0 1px 2px rgba(15,23,42,0.05), 0 10px 26px rgba(15,23,42,0.06)",
  cardShadow: "0 20px 50px rgba(15,23,42,0.1)",
  cardShadowLg: "0 26px 64px rgba(15,23,42,0.13)",
  liftShadow: "0 2px 4px rgba(15,23,42,0.06), 0 28px 60px rgba(15,23,42,0.16)",

  footerBg: "#ffffff",
  footerBorder: "rgba(148,163,184,0.18)",
  footerMuted: "#475569",

  inputBorder: "#dde5ee",
  inputBg: "transparent",
  inputFieldBg: "#f3f6fa",
  inputPlaceholder: "#64748b",

  // Was #eef2f8 — a hair off white, which is why alternating bands barely
  // separated from the cardBg ones next to them. Enough more saturated to
  // read as "the tinted band" at a glance, still light enough under body text.
  sectionAltBg: "#dbe8fc",
  pricingBg: "linear-gradient(180deg,#cfe0fa 0px,#a9c9f2 30%,#89b3ea calc(100% - 160px),#ffffff 100%)",
  heroEndSolid: "#dbe8fc",
  pricingStart: "#cfe0fa",
  pricingMid: "#a9c9f2",
  pricingEnd: "#89b3ea",
  heroFade:
    "linear-gradient(180deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0) 220px, rgba(255,255,255,0) calc(100% - 260px), #dbe8fc 100%)",

  cloudFilter: "none",
  cloudOpacity: 0.9,
  chipBg: "rgba(255,255,255,0.55)",
  chipBorder: "rgba(15,23,42,0.08)",

  wordmarkA: "#173d8a",
  wordmarkB: "#2f7fe0",
  birdColor: "#1e293b",
  hazeColor: "#eaf4fb",

  greenBg: "#ecfdf5",
  greenBorder: "#a7f3d0",
  greenText: "#047857",
  greenDot: "#059669",
  greenSolid: "#10b981",

  diffRowBg: "rgba(34,197,94,0.06)",
  diffRowBorder: "rgba(34,197,94,0.35)",
  diffStrong: "#16a34a",
  diffSoft: "#166534",

  crossBg: "#f1f5f9",
  crossText: "#546578",
  labelMuted: "#475569",

  orangeBg: "#fff7ed",
  orangeBorder: "#fed7aa",
  orangeText: "#c2410c",
  orange: "#f97316",
};

const dark: Theme = {
  dark: true,
  pageBg: "linear-gradient(180deg,#0a0f1e 0%,#0d1526 45%,#0a1220 100%)",
  text: "#eef2f8",
  muted: "#9aa7bd",
  mutedLight: "#d3dbe8",
  link: "#7ab3f7",

  navBg: "rgba(13,20,38,0.88)",
  navBorder: "rgba(255,255,255,0.08)",
  navShadow: "0 14px 50px rgba(0,0,0,0.45)",
  pillTrackBg: "rgba(255,255,255,0.06)",
  pillActiveBg: "#1c2942",
  pillActiveShadow: "0 1px 4px rgba(0,0,0,0.35)",

  switchTrackBg: "linear-gradient(180deg,#111b2a,#0b1220)",
  switchBorder: "rgba(255,255,255,0.15)",
  switchKnobBg: "#0b1220",

  ctaBg: "#2f7fe0",
  ctaText: "#ffffff",

  cardBg: "#111a2e",
  cardBorder: "rgba(255,255,255,0.08)",
  cardShadowSm: "0 1px 2px rgba(0,0,0,0.35), 0 10px 26px rgba(0,0,0,0.28)",
  cardShadow: "0 14px 36px rgba(0,0,0,0.35)",
  cardShadowLg: "0 16px 40px rgba(0,0,0,0.4)",
  liftShadow: "0 2px 4px rgba(0,0,0,0.4), 0 28px 60px rgba(0,0,0,0.45)",

  footerBg: "#0a0f1e",
  footerBorder: "rgba(255,255,255,0.08)",
  footerMuted: "#d3dbe8",

  inputBorder: "rgba(255,255,255,0.14)",
  inputBg: "rgba(255,255,255,0.03)",
  inputFieldBg: "#16203a",
  inputPlaceholder: "#7c8aa3",

  sectionAltBg: "#0d1526",
  pricingBg: "linear-gradient(180deg,#0d1526 0px,#0a1220 30%,#070b14 calc(100% - 160px),#0a0f1e 100%)",
  heroEndSolid: "#0d1526",
  pricingStart: "#0d1526",
  pricingMid: "#0a1220",
  pricingEnd: "#070b14",
  heroFade:
    "linear-gradient(180deg, rgba(8,12,24,0.35) 0px, rgba(8,12,24,0) 220px, rgba(8,12,24,0) calc(100% - 260px), #0d1526 100%)",

  cloudFilter: "brightness(0.42) saturate(1.15) contrast(1.05)",
  cloudOpacity: 0.85,
  chipBg: "rgba(255,255,255,0.06)",
  chipBorder: "rgba(255,255,255,0.1)",

  wordmarkA: "#8fb8f0",
  wordmarkB: "#4e9bf5",
  birdColor: "#f4f6fb",
  hazeColor: "#0a0f1e",

  greenBg: "rgba(16,185,129,0.12)",
  greenBorder: "rgba(16,185,129,0.4)",
  greenText: "#34d399",
  greenDot: "#10b981",
  greenSolid: "#10b981",

  diffRowBg: "rgba(16,185,129,0.1)",
  diffRowBorder: "rgba(16,185,129,0.4)",
  diffStrong: "#34d399",
  diffSoft: "#a7f3d0",

  crossBg: "rgba(255,255,255,0.06)",
  crossText: "#d3dbe8",
  labelMuted: "#c7d2e3",

  orangeBg: "rgba(249,115,22,0.12)",
  orangeBorder: "rgba(249,115,22,0.4)",
  orangeText: "#fb923c",
  orange: "#f97316",
};

export function getTheme(isDark: boolean): Theme {
  return isDark ? dark : light;
}
