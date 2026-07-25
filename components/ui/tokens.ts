/**
 * App design tokens — single source of truth for the connected app shell
 * (Raya student app + Schools admin/teacher app). Every color is derived from
 * `getTheme(isDark)`; a component should never hardcode a surface/text color —
 * it reads from the returned `AppTheme`. Values are ported verbatim from the
 * design handoff references (`design_handoff_raya_schools_app/reference-*.html`).
 *
 * The dark flag is persisted to localStorage under `THEME_KEY`, shared across
 * both apps. Read it on mount only (see components/ui/theme.tsx) — never during
 * SSR, to avoid a hydration mismatch.
 */

export const THEME_KEY = "bluestift-dark";

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
  cardBg: string;
  cardBg2: string;
  cardBorder: string;
  cardShadow: string;
  text: string;
  muted: string;
  mutedLight: string;
  ctaBg: string;
  ctaText: string;
  inputBg: string;
  inputBorder: string;
  bubbleBg: string;
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
  pageBase: "#ffffff",
  cloudOpacity: 0,
  cloudFilter: "none",
  hazeOverlay: "transparent",
  sidebarBg: "#eef3f9",
  sidebarBorder: "rgba(15,23,42,0.10)",
  sidebarText: "#0b1220",
  sidebarMuted: "#64748b",
  sidebarActiveBg: "rgba(15,23,42,0.07)",
  sidebarDivider: "rgba(15,23,42,0.10)",
  rightBg: "#f6f7f9",
  rightBorder: "rgba(15,23,42,0.09)",
  cardBg: "#ffffff",
  cardBg2: "#f3f6fa",
  cardBorder: "rgba(15,23,42,0.10)",
  cardShadow: "none",
  text: "#0b1220",
  muted: "#64748b",
  mutedLight: "#8a97a8",
  ctaBg: "#0b1220",
  ctaText: "#ffffff",
  inputBg: "#f3f6fa",
  inputBorder: "#dde5ee",
  bubbleBg: "#f3f6fa",
  bubbleAccentBg: "#fef3c7",
  rowActiveBg: "#eef2f8",
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
  rightBorder: "rgba(255,255,255,0.08)",
  cardBg: "#0b111f",
  cardBg2: "#16203a",
  cardBorder: "rgba(255,255,255,0.09)",
  cardShadow: "none",
  text: "#eef2f8",
  muted: "#9aa7bd",
  mutedLight: "#7c8aa3",
  ctaBg: "#2f7fe0",
  ctaText: "#ffffff",
  inputBg: "#16203a",
  inputBorder: "rgba(255,255,255,0.14)",
  bubbleBg: "#16203a",
  bubbleAccentBg: "#3a3010",
  rowActiveBg: "#16203a",
  pillTrackBg: "rgba(255,255,255,0.06)",
  gaugeTrack: "rgba(255,255,255,0.12)",
  switchTrackBg: "linear-gradient(180deg,#111b2a,#0b1220)",
  switchBorder: "rgba(255,255,255,0.15)",
  switchKnobBg: "#0b1220",
};

export function getTheme(isDark: boolean): AppTheme {
  return isDark ? dark : light;
}

/** Font stacks — back the `--font-*` CSS variables set in app/layout.tsx. */
export const sans = "var(--font-inter),'Inter',ui-sans-serif,system-ui,sans-serif";
export const display =
  "var(--font-inter-tight),'Inter Tight',ui-sans-serif,system-ui,sans-serif";
export const hand = "var(--font-caveat),'Caveat',cursive";

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
