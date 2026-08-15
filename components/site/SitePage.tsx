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
 */
export default function SitePage({
  active,
  section,
  signedIn,
  children,
}: {
  active: NavLink;
  section?: string;
  signedIn?: boolean;
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
          background: t.pageBg,
          transition: "background 0.4s ease, color 0.4s ease",
          position: "relative",
          // See LandingPage: `.pub-lift`'s hover elevation has to reach CSS as a
          // custom property, because the theme lives in React state.
          "--pub-lift-shadow": t.liftShadow,
        } as CSSProperties
      }
    >
      <CloudBackground theme={t} variant="fixed" />
      <Navbar theme={t} isDark={isDark} onToggleTheme={toggle} active={active} section={section} signedIn={signedIn} />
      {children(t)}
      <Footer theme={t} variant="simple" />
    </div>
  );
}
