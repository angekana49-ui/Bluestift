import React from "react";

/**
 * The product wordmarks. Server-safe (no hooks, no "use client") so both the
 * public marketing site and the signed-in app can render them.
 *
 * Brand rule: the tutor is written **"Raya"** — never "RAYA" — in a bold serif
 * (Cambria Math / Times New Roman). It reads warmer and less clinical than the
 * all-caps sans, which matters for a student audience. "Schools" matches it so the
 * two products read as one family. Neither name is ever translated.
 */

export const RAYA_FONT = "'Cambria Math', 'Cambria', 'Times New Roman', serif";

const wordmarkStyle: React.CSSProperties = { fontFamily: RAYA_FONT, fontWeight: 700 };

/** The Raya wordmark. Inherits colour and size from its context. */
export function RayaName({ style }: { style?: React.CSSProperties }) {
  return <span style={{ ...wordmarkStyle, ...style }}>Raya</span>;
}

/** The Schools wordmark — same bold serif as Raya, so the two products match. */
export function SchoolsName({ style }: { style?: React.CSSProperties }) {
  return <span style={{ ...wordmarkStyle, ...style }}>Schools</span>;
}

/**
 * Renders a plain copy string with every "Raya" in the wordmark serif — for the
 * many places where the text arrives as a `string` prop (copy objects, config,
 * section props) and so can't hold JSX. Only "Raya" is matched: "Schools" is too
 * common a word to auto-detect safely, so use <SchoolsName/> explicitly there.
 */
/** The pure half of <RayaText/>: the copy split on whole-word "Raya" occurrences.
 *  N occurrences yield N+1 parts, so a wordmark goes before every part but the
 *  first. Word-bounded, so "Rayan" or "rayasoft" are left alone. */
export function splitOnRaya(text: string): string[] {
  return text.split(/\bRaya\b/g);
}

export function RayaText({ children, style }: { children: string; style?: React.CSSProperties }) {
  const parts = splitOnRaya(children);
  if (parts.length === 1) return <>{children}</>;
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RayaName style={style} />}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}
