import React from "react";

/**
 * The product wordmarks. Server-safe (no hooks, no "use client") so both the
 * public marketing site and the signed-in app can render them.
 *
 * Brand rule: the tutor is written **"Raya"** — never "RAYA" — in a bold serif
 * (Cambria Math / Times New Roman). It reads warmer and less clinical than the
 * all-caps sans, which matters for a student audience. "Schools" matches it so the
 * two products read as one family. Neither name is ever translated.
 *
 * "Raya" and "Bluestift" additionally carry `translate="no"` and the
 * `notranslate` class — belt and suspenders, since Google Translate honours
 * either on its own. Our own i18n catalogue already keeps both names literal
 * in every locale (see lib/i18n/en.ts's header comment); this is the second,
 * independent layer for a visitor who runs the browser's own Google Translate
 * over a page we've already translated, or over a locale we don't support —
 * that pass never sees these two names as translatable text at all.
 */

export const RAYA_FONT = "'Cambria Math', 'Cambria', 'Times New Roman', serif";

const wordmarkStyle: React.CSSProperties = { fontFamily: RAYA_FONT, fontWeight: 700 };

/** The Raya wordmark. Inherits colour and size from its context. */
export function RayaName({ style }: { style?: React.CSSProperties }) {
  return (
    <span translate="no" className="notranslate" style={{ ...wordmarkStyle, ...style }}>
      Raya
    </span>
  );
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

/**
 * Every plain-text part also runs through <BluestiftText/>, so any copy
 * that says both names (the footer tagline: "BlueStift builds Raya…") gets
 * both protected without its call site having to nest two components.
 */
export function RayaText({ children, style }: { children: string; style?: React.CSSProperties }) {
  const parts = splitOnRaya(children);
  if (parts.length === 1) return <BluestiftText>{children}</BluestiftText>;
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RayaName style={style} />}
          <BluestiftText>{part}</BluestiftText>
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * The Bluestift wordmark, protected from machine translation the same way as
 * <RayaName/> — but with no imposed styling of its own: unlike Raya, the
 * company name carries no special typeface, so it just sits in whatever
 * prose it appears in.
 */
export function BluestiftName({ children = "Bluestift" }: { children?: string }) {
  return (
    <span translate="no" className="notranslate">
      {children}
    </span>
  );
}

/**
 * Renders a plain copy string with every "Bluestift" wrapped so it survives
 * the browser's own Google Translate untouched — the <RayaText/> shape,
 * applied to the other name. Matches both "Bluestift" and the older
 * "BlueStift" spelling still in a handful of strings, and re-emits whichever
 * one it found rather than normalizing it: unifying the casing is a separate
 * cleanup from protecting the name from translation.
 */
export function BluestiftText({ children }: { children: string }) {
  const parts = children.split(/\b(Bluestift|BlueStift)\b/g);
  if (parts.length === 1) return <>{children}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <BluestiftName key={i}>{part}</BluestiftName> : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </>
  );
}
