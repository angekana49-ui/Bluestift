import Link from "next/link";
import type { Theme } from "./theme";

const COLUMNS: { label: string; links: [string, string][] }[] = [
  {
    label: "PRODUCT",
    links: [
      ["RAYA", "/chat"],
      ["Study Rooms", "/rooms"],
      ["Tools Studio", "/tools"],
      ["Schools", "/school"],
    ],
  },
  {
    label: "PROJECT",
    links: [
      ["Research", "/research"],
      ["Survey", "/survey"],
      ["Contribute", "/research?tab=collaborations"],
    ],
  },
  {
    label: "RESOURCES",
    links: [
      ["Contact", "/contact"],
      ["Feedback", "/feedback"],
      ["Sign in", "/login"],
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
        <span style={{ fontSize: 10, color: t.footerMuted }}>© 2026 BlueStift. All rights reserved.</span>
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
              <span style={{ fontSize: 13, fontWeight: 800 }}>
                <span style={{ color: t.wordmarkA }}>Blue</span>
                <span style={{ color: t.wordmarkB }}>Stift</span>
              </span>
            </div>
            <p style={{ maxWidth: 220, fontSize: 11, color: t.footerMuted, lineHeight: 1.7, margin: 0 }}>
              BlueStift builds RAYA, the AI tutor that remembers every student.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.label}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12, color: t.text }}>{col.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {col.links.map(([label, href]) => (
                  <Link key={label} href={href} style={{ fontSize: 11, color: t.text, textDecoration: "none" }}>
                    {label}
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
            fontSize: 10,
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
