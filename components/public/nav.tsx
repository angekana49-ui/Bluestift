"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { base, landing } from "@/components/public/theme";

/**
 * Shared public-site topbar. By default shows the site pills (Produit /
 * Research / Survey / Contact) and the auth CTAs; sub-sites (Research, Survey)
 * pass a `section` label next to the logo and their own `center` tabs /
 * `actions`, matching the mockups' per-page topbars.
 */
type Props = {
  signedIn: boolean;
  active?: string;
  section?: string;
  accent?: string;
  accentDark?: string;
  center?: ReactNode;
  actions?: ReactNode;
};

const PILLS: Array<[string, string]> = [
  ["Produit", "/"],
  ["Tarifs", "/#tarifs"],
  ["Research", "/research"],
  ["Survey", "/survey"],
  ["Contact", "/contact"],
];

export function PublicNav({
  signedIn,
  active,
  section,
  accent = landing.teal,
  accentDark = landing.tealDark,
  center,
  actions,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${scrolled ? base.border : "transparent"}`,
        transition: "all 0.2s",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: 17,
            color: "white",
            fontWeight: 600,
          }}
        >
          B
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: base.ink, letterSpacing: "-0.03em" }}>
          Bluestift
        </span>
        {section && (
          <span style={{ fontSize: 13, color: base.inkMuted, marginLeft: 2 }}>· {section}</span>
        )}
      </Link>

      {/* Center: site pills, or the sub-site's own tabs */}
      {center ?? (
        <div
          className="pub-hide-sm"
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(0,0,0,0.05)",
            borderRadius: 99,
            padding: "3px 4px",
          }}
        >
          {PILLS.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              style={{
                padding: "6px 14px",
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 500,
                background: active === label ? "white" : "transparent",
                color: active === label ? base.ink : base.inkSub,
                boxShadow: active === label ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Right: custom actions or auth CTAs */}
      {actions ?? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {signedIn ? (
            <>
              <Link
                href="/account"
                className="pub-hide-sm"
                style={{ fontSize: 14, color: base.inkSub, padding: "6px 10px" }}
              >
                Mon compte
              </Link>
              <Link
                href="/chat"
                style={{
                  background: base.ink,
                  color: "white",
                  borderRadius: 99,
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: accent,
                    display: "inline-block",
                  }}
                />
                Ouvrir l&apos;app
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="pub-hide-sm"
                style={{ fontSize: 14, color: base.inkSub, padding: "6px 10px" }}
              >
                Se connecter
              </Link>
              <Link
                href="/login"
                style={{
                  background: base.ink,
                  color: "white",
                  borderRadius: 99,
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: accent,
                    display: "inline-block",
                  }}
                />
                Démarrer gratuitement
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
