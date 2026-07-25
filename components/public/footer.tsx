import Link from "next/link";
import { base, landing } from "@/components/public/theme";

const COLS: Array<{ label: string; links: Array<[string, string]> }> = [
  {
    label: "Produit",
    links: [
      ["Raya", "/login"],
      ["Rooms", "/login"],
      ["Tools", "/login"],
      ["Écoles", "/school"],
    ],
  },
  {
    label: "Projet",
    links: [
      ["Research", "/research"],
      ["Survey", "/survey"],
      ["Contribuer", "/research?tab=collaborations"],
    ],
  },
  {
    label: "Ressources",
    links: [
      ["Contact", "/contact"],
      ["Feedback", "/feedback"],
      ["Se connecter", "/login"],
    ],
  },
];

export function PublicFooter() {
  return (
    <footer
      style={{
        background: "white",
        borderTop: `1px solid ${base.border}`,
        padding: "48px 32px 28px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="pub-footer-grid" style={{ marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: `linear-gradient(135deg, ${landing.teal}, ${landing.tealDark})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "white",
                  fontWeight: 600,
                }}
              >
                B
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: base.ink, letterSpacing: "-0.03em" }}>
                Bluestift
              </span>
            </div>
            <p style={{ fontSize: 13, color: base.inkMuted, lineHeight: 1.6, maxWidth: 190 }}>
              Le tuteur IA qui se souvient de chaque élève. K-12, Cameroun & US.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.label}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: base.ink,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {col.label}
              </div>
              {col.links.map(([label, href]) => (
                <div key={label} style={{ marginBottom: 7 }}>
                  <Link href={href} style={{ fontSize: 13, color: base.inkSub }}>
                    {label}
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            borderTop: `1px solid ${base.border}`,
            paddingTop: 20,
          }}
        >
          <span style={{ fontSize: 13, color: base.inkMuted }}>
            © 2026 Bluestift. Tous droits réservés.
          </span>
          <span style={{ fontSize: 13, color: base.inkMuted }}>
            hello@thebluestift.com
          </span>
        </div>
      </div>
    </footer>
  );
}
