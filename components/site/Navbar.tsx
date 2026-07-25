"use client";

import Link from "next/link";
import type { Theme } from "./theme";
import ThemeToggle from "./ThemeToggle";

// "Privacy" is a valid section (for SitePage's `active`) but intentionally not in
// LINKS below — the privacy page has no nav pill, so nothing highlights for it.
export type NavLink = "Product" | "Research" | "Survey" | "Pricing" | "Contact" | "Privacy";

const LINKS: { label: NavLink; href: string }[] = [
  { label: "Product", href: "/" },
  { label: "Research", href: "/research" },
  { label: "Survey", href: "/survey" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

/**
 * Shared sticky pill navbar. `active` highlights the current section; `section`
 * appends a "· Research"-style suffix to the wordmark (used on sub-pages).
 * Real navigation via next/link; the theme toggle is driven by the page's
 * useThemeMode() so the whole page re-themes from one source.
 */
export default function Navbar({
  theme: t,
  isDark,
  onToggleTheme,
  active,
  section,
  signedIn,
  homeHref = "/chat",
}: {
  theme: Theme;
  isDark: boolean;
  onToggleTheme: () => void;
  active: NavLink;
  section?: string;
  signedIn?: boolean;
  /** Where "Open app" goes for a signed-in user — their resolved home
   *  (Raya or Schools). Defaults to Raya when the page doesn't resolve it. */
  homeHref?: string;
}) {
  const ctaPill = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: t.ctaBg,
    color: t.ctaText,
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    textDecoration: "none",
  };

  return (
    <div style={{ position: "sticky", top: 12, zIndex: 50, padding: "0 16px", marginBottom: -56 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: t.navBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${t.navBorder}`,
          borderRadius: 999,
          padding: "8px 10px 8px 14px",
          boxShadow: t.navShadow,
          transition: "background 0.4s ease, border 0.4s ease",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bluestift-mark.png"
            alt="BlueStift"
            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "'IBM Plex Sans',sans-serif" }}>
              <span style={{ color: t.wordmarkA }}>Blue</span>
              <span style={{ color: t.wordmarkB }}>Stift</span>
              {section && <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 4, color: t.text }}>· {section}</span>}
            </div>
            <div style={{ fontSize: 11, color: t.text }}>Raya · AI tutor K-12</div>
          </div>
        </Link>

        <div className="pub-hide-sm" style={{ display: "flex", gap: 2, background: t.pillTrackBg, borderRadius: 999, padding: 4 }}>
          {LINKS.map((link) => {
            const isActive = link.label === active;
            return (
              <Link
                key={link.label}
                href={link.href}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? t.text : t.muted,
                  background: isActive ? t.pillActiveBg : "transparent",
                  boxShadow: isActive ? t.pillActiveShadow : "none",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={t} isDark={isDark} onToggle={onToggleTheme} />
          {signedIn ? (
            <Link href={homeHref} style={ctaPill}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="pub-hide-sm" style={{ fontSize: 12, color: t.text, whiteSpace: "nowrap", textDecoration: "none" }}>
                Sign in
              </Link>
              <Link href="/login" style={ctaPill}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
                Free trial
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
