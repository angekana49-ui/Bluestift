/**
 * Design tokens for the public site, lifted from the approved mockups
 * (landing-thebluestift / research-thebluestift / survey-thebluestift).
 * Each surface keeps its signature accent: teal (landing), academic green
 * (research), amber (survey) — over light backgrounds, Inter + Georgia italic.
 */

export const base = {
  white: "#ffffff",
  ink: "#111111",
  inkSub: "#4a5568",
  inkMuted: "#9ca3af",
  border: "rgba(0,0,0,0.08)",
  border2: "rgba(0,0,0,0.05)",
  violet: "#8b7cf8",
  violetBg: "#f0eeff",
  orange: "#f97316",
};

export const landing = {
  ...base,
  skyTop: "#b8d4e8",
  skyMid: "#d8eaf5",
  skyBg: "#dce8f0",
  teal: "#1d9e75",
  tealDark: "#0f6e56",
  tealLight: "#e1f5ee",
  tealBorder: "#9fe1cb",
};

export const research = {
  ...base,
  bg: "#fafaf8",
  card: "#f5f5f2",
  green: "#2d6a4f",
  greenBg: "#e8f5ee",
  greenBd: "#a8d5b8",
  greenDk: "#1a4032",
  ink: "#1a1a1a",
  sub: "#6b7280",
};

export const survey = {
  ...base,
  bg: "#faf9f6",
  card: "#f5f3ee",
  amber: "#b45309",
  amberBg: "#fef3c7",
  amberBd: "#fcd34d",
  amberDk: "#92400e",
  green: "#22c55e",
  greenBg: "#dcfce7",
  ink: "#1a1a1a",
  sub: "#6b7280",
};

export const serif = "Georgia, 'Times New Roman', serif";
export const sans = "'Inter','Helvetica Neue',ui-sans-serif,system-ui,sans-serif";
