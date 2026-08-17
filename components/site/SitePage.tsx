"use client";

import type { CSSProperties, ReactNode } from "react";
import { useThemeMode } from "./useThemeMode";
import { getTheme, type Theme } from "./theme";
import Navbar, { type NavLink } from "./Navbar";
import Footer from "./Footer";
import CloudBackground from "./CloudBackground";

/**
 * Page shell for the Research/Survey/Contact/Feedback pattern: the fixed
 * viewport-pinned sky + shared navbar + simple footer. Children are given the
 * active theme via a render prop; each child section must set
 * position:relative + zIndex:1 so it paints above the fixed sky.
 *
 * `surface` decides whether that sky appears, and the two cases are genuinely
 * different kinds of page rather than a taste setting:
 *
 *  - `sky` — a marketing surface. Short, promotional, and the photograph is
 *    doing work: it is the brand, and there is little text for it to sit under.
 *  - `plain` — a document. The legal pages are ~5 screens of dense prose, and a
 *    viewport-pinned photograph behind that is a legibility problem (body copy
 *    over varying luminance) before it is a taste one. It also undercuts the
 *    text: a privacy policy is a record, and these are careful, specific
 *    documents that read as less serious than they are with a stock sky behind
 *    them. `plain` gives them a flat reading surface instead.
 */
export default function SitePage({
  active,
  section,
  signedIn,
  surface = "sky",
  children,
}: {
  active: NavLink;
  section?: string;
  signedIn?: boolean;
  surface?: "sky" | "plain";
  children: (t: Theme) => ReactNode;
}) {
  const { isDark, toggle } = useThemeMode();
  const t = getTheme(isDark);

  return (
    <div
      style={
        {
          fontFamily: "var(--font-inter),'Inter',sans-serif",
          color: t.text,
          minHeight: "100vh",
          // A document gets a flat surface, not the page gradient: pageBg runs
          // to #c9d9ea by its last stop, so over a 5-screen legal page the prose
          // would drift onto steadily bluer ground as the reader descends.
          background: surface === "plain" ? t.cardBg : t.pageBg,
          transition: "background 0.4s ease, color 0.4s ease",
          position: "relative",
          // See LandingPage: `.pub-lift`'s hover elevation has to reach CSS as a
          // custom property, because the theme lives in React state.
          "--pub-lift-shadow": t.liftShadow,
        } as CSSProperties
      }
    >
      {surface === "sky" ? <CloudBackground theme={t} variant="fixed" /> : null}
      <Navbar theme={t} isDark={isDark} onToggleTheme={toggle} active={active} section={section} signedIn={signedIn} />
      {children(t)}
      <Footer theme={t} variant="simple" />
    </div>
  );
}
