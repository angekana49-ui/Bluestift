"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Theme } from "./theme";
import ThemeToggle, { ThemeToggleCompact } from "./ThemeToggle";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { MEASURE } from "./layout";

// "Privacy" and "Feedback" are valid sections (for SitePage's `active`) but
// intentionally not in LINKS below — neither page has a nav pill, so nothing
// highlights for them. That is the point: a page with no entry of its own must
// name itself here rather than borrow a neighbour's. Feedback used to pass
// "Product", which lit the Product pill and told the visitor they were on the
// landing page while they were filling in a feedback form.
// NOTE `label` stays the ENGLISH identity (pages pass it as `active`); only
// `labelKey` is what the visitor actually reads.
export type NavLink =
  | "Product"
  | "Research"
  | "Survey"
  | "Pricing"
  | "Contact"
  | "Privacy"
  | "Feedback";

const LINKS: { label: NavLink; labelKey: MessageKey; href: string }[] = [
  { label: "Product", labelKey: "site.nav.product", href: "/" },
  { label: "Research", labelKey: "site.nav.research", href: "/research" },
  { label: "Survey", labelKey: "site.nav.survey", href: "/survey" },
  { label: "Pricing", labelKey: "site.nav.pricing", href: "/pricing" },
  { label: "Contact", labelKey: "site.nav.contact", href: "/contact" },
];

/**
 * The width the five pills are dropped at (`.pub-nav-links` in globals.css).
 * Below it the brand block becomes the way to the rest of the site, so the two
 * numbers have to be the same one — a gap between them is a viewport with no
 * navigation at all.
 */
const NAV_COLLAPSE = 900;

/**
 * What the brand menu holds below that width: the five pills, plus Legal.
 *
 * Legal is not in the bar at any width and lives in the footer's fourth column,
 * which on a phone is the bottom of a ten-screen page — so the one destination
 * a parent or a school actually goes looking for was the hardest one to reach.
 * It costs a row here.
 */
const MENU_EXTRA: { labelKey: MessageKey; href: string }[] = [
  { labelKey: "settings.row.legal", href: "/legal" },
];

/** Chevron for the brand menu: down when closed, up when open. */
function MenuChevron({ open }: { open: boolean }) {
  return (
    <svg
      className="pub-nav-chevron"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        flex: "none",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform .18s ease",
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * Everything that has to close the menu, in one place: a click outside it,
   * Escape, and the viewport growing back past the width where the five pills
   * return — otherwise the panel stays open over a bar that already has the
   * links in it.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= NAV_COLLAPSE) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const menuRow = (labelKey: MessageKey, href: string, isActive: boolean) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMenuOpen(false)}
      style={{
        display: "block",
        padding: "11px 14px",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? t.text : t.muted,
        background: isActive ? t.pillActiveBg : "transparent",
        textDecoration: "none",
      }}
    >
      {tr(labelKey)}
    </Link>
  );

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
      {/* The pill and its dropdown share one positioned box, so the panel hangs
          off the bar rather than off the page and travels with it as it sticks.
          The measure moved here from the pill for the same reason. */}
      <div ref={barRef} style={{ position: "relative", maxWidth: MEASURE.wide, margin: "0 auto" }}>
      <div
        className="pub-nav-bar"
        style={{
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
        {/* Still a real <a href="/">: at full width it is the home link it has
            always been, and a middle-click or ⌘-click opens home from a phone
            too. Below NAV_COLLAPSE a plain left-click is intercepted instead
            and opens the menu, because that is the width where this block is
            the only route to the rest of the site. */}
        <Link
          href="/"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? tr("shell.closeMenu") : tr("shell.openMenu")}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (window.innerWidth >= NAV_COLLAPSE) return;
            e.preventDefault();
            setMenuOpen((o) => !o);
          }}
          className="pub-nav-brand"
          style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pub-nav-mark"
            // The public site keeps the light mark in both themes, by design:
            // the blue bird is the brand signature and stays put when the page
            // flips to dark. Only the app shell swaps in the -dark variant.
            src="/bluestift-mark.png"
            alt="BlueStift"
            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          {/* Wordmark only. A tagline used to sit under it ("AI-powered
              diagnostic engine for schools"), and it was the widest thing in the
              bar by a distance — it set the brand block's width, so the whole
              floating pill had to grow to hold a sentence nobody reads twice.
              The hero states the same claim, in full, one scroll below. The bar
              only has to say which site you are on. */}
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>
            <span style={{ color: t.wordmarkA }}>Blue</span>
            <span style={{ color: t.wordmarkB }}>Stift</span>
            {/* Dropped on the narrowest screens (globals.css): it is the widest
                optional thing in the bar, and the page below it already says
                which section you are on. */}
            {section && <span className="pub-nav-section" style={{ fontWeight: 400, opacity: 0.6, marginLeft: 4, color: t.text }}>· {section}</span>}
          </div>
          {/* Hidden above NAV_COLLAPSE, where the click goes home and there is
              nothing to expand (globals.css). */}
          <span style={{ display: "flex", color: t.muted }}>
            <MenuChevron open={menuOpen} />
          </span>
        </Link>

        <div className="pub-nav-links" style={{ display: "flex", gap: 2, background: t.pillTrackBg, borderRadius: 999, padding: 4 }}>
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

        <div className="pub-nav-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Two controls, one shown at a time by CSS (the same 899/900 boundary
              as the pills and the chevron). Below it the bar is brand + theme +
              CTA with nothing to give: the 66px pill pushed "Open app" past the
              rounded edge on a 375px screen, and 34px is what closes the gap. */}
          <span className="pub-theme-pill" style={{ display: "flex" }}>
            <ThemeToggle theme={t} isDark={isDark} onToggle={onToggleTheme} />
          </span>
          <span className="pub-theme-icon" style={{ display: "none" }}>
            <ThemeToggleCompact theme={t} isDark={isDark} onToggle={onToggleTheme} />
          </span>
          {signedIn ? (
            <Link href={homeHref} className="pub-press" style={ctaPill}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              {/* The header stays English in every locale — the user's call,
                  same as the five nav links above. Elsewhere on the site this
                  same copy ("Start free" / "Open app" — Footer,
                  FinalCtaSection, the checkout page) still goes through
                  site.nav.startFree/openApp and is translated as usual;
                  only the header hardcodes English directly. No "Sign in"
                  link here by design — Start free is the header's one
                  signed-out action, and it goes to the same /login. */}
              Open app
            </Link>
          ) : (
            <Link href="/login" className="pub-press" style={ctaPill}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              Start free
            </Link>
          )}
        </div>
      </div>

      {/* The brand menu. Rendered only while open, and `.pub-nav-menu` also
          hides it above NAV_COLLAPSE so a stale open state can never survive a
          window being dragged wider before the resize handler runs. */}
      {menuOpen && (
        <div
          className="pub-nav-menu"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: t.navBg,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: `1px solid ${t.navBorder}`,
            borderRadius: 20,
            boxShadow: t.navShadow,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {LINKS.map((link) => menuRow(link.labelKey, link.href, link.label === active))}
          {/* Ruled off: the five above are where the site takes you, this is
              where the paperwork is. */}
          <span style={{ height: 1, background: t.navBorder, margin: "6px 8px" }} />
          {MENU_EXTRA.map((row) => menuRow(row.labelKey, row.href, false))}
        </div>
      )}
      </div>
    </div>
  );
}
