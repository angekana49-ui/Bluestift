"use client";

import SitePage from "@/components/site/SitePage";
import type { NavLink } from "@/components/site/Navbar";
import type { Theme } from "@/components/site/theme";
import { GUTTER, MEASURE, PAGE_BOTTOM, pageH1, pageSection, serifEm } from "@/components/site/layout";
import { useTranslate } from "@/components/ui/locale";

/**
 * Shared chrome for the four legal pages (Privacy, Terms, DPA, Sub-processors).
 * They're long documents that have to stay consistent with each other — one
 * measure, one type scale, one place to change it.
 */

/**
 * The document type scale.
 *
 * It used to be h2 1.05rem / h3 0.95rem over 15px body — which means h3 (15.2px)
 * was the same size as the paragraphs it introduced, and h2 was one point above
 * them. On a five-screen document that is not a scale at all: nothing told the
 * eye where one topic ended and the next began, so a careful, well-organised
 * policy read as an undifferentiated wall and became unskimmable.
 *
 * These pages are read by people looking for one specific answer — what you keep,
 * for how long, who else sees it. Skimmability is the whole job. The steps below
 * are wide enough to survive being glanced at, and h2 carries a rule so the
 * top-level sections are findable at a scroll.
 */
/** Inset between the sheet's edge and the document's measure. */
const SHEET_PAD = 34;

export const h2 = (t: Theme) =>
  ({
    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
    fontWeight: 800,
    fontSize: "1.35rem",
    letterSpacing: "-0.015em",
    color: t.text,
    margin: "52px 0 14px",
    paddingTop: 18,
    borderTop: `1px solid ${t.footerBorder}`,
  }) as const;

export const h3 = (t: Theme) =>
  ({
    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: "-0.01em",
    color: t.text,
    margin: "28px 0 8px",
  }) as const;

export const p = (t: Theme) =>
  ({ fontSize: 15, color: t.text, lineHeight: 1.75, margin: "0 0 12px" }) as const;

export const li = (t: Theme) =>
  ({ fontSize: 15, color: t.text, lineHeight: 1.7, marginBottom: 7 }) as const;

export const ul = { paddingLeft: 18, margin: "0 0 12px" } as const;

export const note = (t: Theme) =>
  ({
    fontSize: 14,
    color: t.muted,
    lineHeight: 1.7,
    background: t.sectionAltBg,
    border: `1px solid ${t.footerBorder}`,
    borderRadius: 12,
    padding: "14px 16px",
    margin: "0 0 12px",
  }) as const;

export function link(t: Theme) {
  return { color: t.link, fontWeight: 600, textDecoration: "none" } as const;
}

/** A responsive, horizontally scrollable table — legal pages carry several. */
export function Table({
  t,
  head,
  rows,
}: {
  t: Theme;
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  const cell = {
    padding: "10px 12px",
    fontSize: 14,
    color: t.text,
    lineHeight: 1.6,
    borderTop: `1px solid ${t.footerBorder}`,
    verticalAlign: "top" as const,
    textAlign: "left" as const,
  };
  return (
    <div style={{ overflowX: "auto", margin: "0 0 14px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  ...cell,
                  borderTop: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  color: t.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={cell}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalShell({
  active,
  section,
  signedIn,
  title,
  accent,
  updated,
  children,
}: {
  active: NavLink;
  section: string;
  signedIn: boolean;
  title: string;
  /** The italic serif half of the heading. */
  accent: string;
  updated: string;
  children: (t: Theme) => React.ReactNode;
}) {
  const tr = useTranslate();
  return (
    /*
     * The sky is back on these four, on a sheet.
     *
     * They ran on `plain` — no sky at all — and the reason given was legibility:
     * five screens of body copy over a photograph of varying luminance. That
     * reason was right about the problem and wrong about the fix. The choice was
     * never sky-or-prose; it was prose-on-a-photograph or prose-on-a-sheet, and
     * every other surface on this site already solved it the second way.
     *
     * So the page gets the pinned sky and the document gets its own opaque card
     * floating on it. Nothing is ever set over the clouds: the text sits on flat
     * cardBg from the first line to the last, which also settles the drift the
     * old note worried about — pageBg gets bluer as it descends, this does not.
     * The sky shows down both margins and behind the footer, which is where a
     * reader's eye rests rather than reads.
     *
     * The measure is unchanged at exactly MEASURE.prose. The card is that plus
     * its own padding, so widening the shell did not quietly widen the lines:
     * 680px at 15px is ~80 characters and the layout notes call that the top of
     * the comfortable range. Padding shrinks with the viewport so a phone does
     * not pay GUTTER and the card's inset twice.
     */
    <SitePage active={active} section={section} signedIn={signedIn}>
      {(t) => (
        <section style={pageSection}>
          <div
            style={{
              maxWidth: MEASURE.prose + 2 * SHEET_PAD,
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
              paddingBottom: PAGE_BOTTOM,
            }}
          >
            <div
              style={{
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 20,
                boxShadow: t.cardShadowLg,
                padding: `clamp(${GUTTER}px, 4vw, ${SHEET_PAD}px)`,
              }}
            >
              <h1 style={pageH1(t)}>
                {title}{" "}
                <em style={{ ...serifEm, color: t.wordmarkB }}>{accent}</em>
              </h1>
              <p style={{ fontSize: 14, color: t.muted, margin: "0 0 40px" }}>
                {tr("legal.lastUpdated")} {updated}
              </p>
              {children(t)}
            </div>
          </div>
        </section>
      )}
    </SitePage>
  );
}
