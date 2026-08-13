"use client";

import Link from "next/link";
import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/** `null` in the label slot = a brand name, shown literally in every language. */
const COLUMNS: { labelKey: MessageKey; links: [MessageKey | null, string, string][] }[] = [
  {
    labelKey: "site.footer.col.product",
    links: [
      [null, "Raya", "/chat"],
      ["site.footer.link.studyRooms", "Study Rooms", "/rooms"],
      ["site.footer.link.toolsStudio", "Tools Studio", "/tools"],
      [null, "Schools", "/school"],
    ],
  },
  {
    labelKey: "site.footer.col.project",
    links: [
      ["site.nav.research", "Research", "/research"],
      ["site.nav.survey", "Survey", "/survey"],
      ["site.footer.link.contribute", "Contribute", "/research?tab=collaborations"],
    ],
  },
  {
    labelKey: "site.footer.col.resources",
    links: [
      ["site.nav.contact", "Contact", "/contact"],
      ["site.footer.link.feedback", "Feedback", "/feedback"],
      ["site.nav.signIn", "Sign in", "/login"],
    ],
  },
  // Kept as its own column rather than tucked under Resources: a school
  // evaluating us reads all four, and the DPA is the one it needs to find.
  {
    labelKey: "site.footer.col.legal",
    links: [
      ["site.nav.privacy", "Privacy", "/privacy"],
      ["site.footer.link.terms", "Terms", "/terms"],
      ["site.footer.link.dpa", "Schools DPA", "/dpa"],
      ["site.footer.link.subprocessors", "Sub-processors", "/subprocessors"],
    ],
  },
];

/**
 * variant="full"   — the 4-column footer used on Home.
 * variant="simple" — a single centred copyright line used on the
 *                    Research/Survey/Contact pages (which sit above the fixed
 *                    sky, so this needs position:relative + z-index:1).
 */
export default function Footer({ theme: t, variant = "full" }: { theme: Theme; variant?: "full" | "simple" }) {
  const tr = useTranslate();
  if (variant === "simple") {
    return (
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          background: t.footerBg,
          borderTop: `1px solid ${t.footerBorder}`,
          padding: "48px 24px 28px",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 13, color: t.footerMuted }}>
          © 2026 BlueStift. {tr("site.footer.rights")} ·{" "}
          <Link href="/privacy" style={{ color: t.link, textDecoration: "underline" }}>
            {tr("site.nav.privacy")}
          </Link>
        </span>
      </footer>
    );
  }

  return (
    <footer
      style={{
        position: "relative",
        background: t.footerBg,
        borderTop: `1px solid ${t.footerBorder}`,
        padding: "56px 24px 32px",
      }}
    >
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <div className="pub-footer-grid" style={{ marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bluestift-mark.png" alt="BlueStift" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "cover" }} />
              <span style={{ fontSize: 15, fontWeight: 800 }}>
                <span style={{ color: t.wordmarkA }}>Blue</span>
                <span style={{ color: t.wordmarkB }}>Stift</span>
              </span>
            </div>
            <p style={{ maxWidth: 220, fontSize: 13, color: t.footerMuted, lineHeight: 1.7, margin: 0 }}>
              <RayaText>{tr("site.footer.tagline")}</RayaText>
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.labelKey}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12, color: t.text }}>
                {tr(col.labelKey)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {col.links.map(([labelKey, fallback, href]) => (
                  <Link key={href} href={href} style={{ fontSize: 13, color: t.link, textDecoration: "none" }}>
                    <RayaText>{labelKey ? tr(labelKey) : fallback}</RayaText>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: `1px solid ${t.footerBorder}`,
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 13,
            color: t.footerMuted,
          }}
        >
          <span>© 2026 BlueStift. All rights reserved.</span>
          <span>hello@thebluestift.com</span>
        </div>
      </div>
    </footer>
  );
}
