"use client";

import Link from "next/link";
import type { Theme } from "./theme";
import ThemeToggle from "./ThemeToggle";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { MEASURE } from "./layout";

// "Privacy" is a valid section (for SitePage's `active`) but intentionally not in
// LINKS below — the privacy page has no nav pill, so nothing highlights for it.
// NOTE `label` stays the ENGLISH identity (pages pass it as `active`); only
// `labelKey` is what the visitor actually reads.
export type NavLink = "Product" | "Research" | "Survey" | "Pricing" | "Contact" | "Privacy";

const LINKS: { label: NavLink; labelKey: MessageKey; href: string }[] = [
  { label: "Product", labelKey: "site.nav.product", href: "/" },
  { label: "Research", labelKey: "site.nav.research", href: "/research" },
  { label: "Survey", labelKey: "site.nav.survey", href: "/survey" },
  { label: "Pricing", labelKey: "site.nav.pricing", href: "/pricing" },
  { label: "Contact", labelKey: "site.nav.contact", href: "/contact" },
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
  const tr = useTranslate();
  const ctaPill = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: t.ctaBg,
    color: t.ctaText,
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    textDecoration: "none",
  };

  return (
    <div style={{ position: "sticky", top: 12, zIndex: 50, padding: "0 16px", marginBottom: -56 }}>
      <div
        style={{
          // Was 1100 — 20px wider than every content column below it, so the
          // nav pill hung past the page edge by 10px on each side.
          maxWidth: MEASURE.wide,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: t.navBg,
          // Saturation boost is what separates a glass bar from a grey one: it
          // keeps the sky behind it colourful instead of washing to concrete.
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
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
            // The public site keeps the light mark in both themes, by design:
            // the blue bird is the brand signature and stays put when the page
            // flips to dark. Only the app shell swaps in the -dark variant.
            src="/bluestift-mark.png"
            alt="BlueStift"
            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>
              <span style={{ color: t.wordmarkA }}>Blue</span>
              <span style={{ color: t.wordmarkB }}>Stift</span>
              {section && <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 4, color: t.text }}>· {section}</span>}
            </div>
            {/* Hidden on phones: at 390px it wrapped onto four lines and pushed
                the pill to a third of the screen height. The wordmark alone
                identifies the site there. */}
            <div className="pub-hide-sm" style={{ fontSize: 13, color: t.text }}>
              {tr("site.nav.tagline")}
            </div>
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
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? t.text : t.muted,
                  background: isActive ? t.pillActiveBg : "transparent",
                  boxShadow: isActive ? t.pillActiveShadow : "none",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {tr(link.labelKey)}
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={t} isDark={isDark} onToggle={onToggleTheme} />
          {signedIn ? (
            <Link href={homeHref} className="pub-press" style={ctaPill}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              {tr("site.nav.openApp")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="pub-hide-sm pub-underline pub-focus"
                style={{ fontSize: 14, fontWeight: 500, color: t.link, whiteSpace: "nowrap", textDecoration: "none" }}
              >
                {tr("site.nav.signIn")}
              </Link>
              <Link href="/login" className="pub-press" style={ctaPill}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
                {tr("site.nav.freeTrial")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
