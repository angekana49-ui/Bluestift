import type { CSSProperties } from "react";
import type { AppTheme } from "./tokens";

/** Themed building blocks for the small form/detail cards across the app. */

export const panelCard = (t: AppTheme): CSSProperties => ({
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 20,
  padding: 20,
  marginBottom: 16,
});

export const cardTitle = (t: AppTheme): CSSProperties => ({
  fontSize: 16,
  fontWeight: 700,
  color: t.text,
  margin: "0 0 6px",
});

export const textInput = (t: AppTheme): CSSProperties => ({
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: 10,
  padding: "10px 14px",
  width: "100%",
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
});

export const ctaButton = (t: AppTheme): CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});

export const ghostButton = (t: AppTheme): CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

export const linkText = (t: AppTheme): CSSProperties => ({
  color: t.link,
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
});
