import type { ReactNode } from "react";
import type { Theme } from "./theme";

export default function PricingSection({ theme: t }: { theme: Theme }) {
  // Short scannable lines beat a paragraph — one idea per row, small accent dot.
  const lineList = (lines: string[], color: string, dot: string) => (
    <ul style={{ position: "relative", listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
      {lines.map((line, i) => (
        <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 12.5, color, lineHeight: 1.45 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0, transform: "translateY(-1px)" }} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );

  // Audience gateway card — no single price; sells the segment, then deep-links
  // into /pricing with the right tab preselected.
  const gatewayCard = (opts: {
    title: string;
    lines: string[];
    meta: ReactNode;
    cta: string;
    href: string;
    blobDur: string;
    blobDelay: string;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", background: t.cardBg, borderRadius: 24, padding: 28, boxShadow: t.cardShadowLg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: "-15%", bottom: "-15%", width: "75%", height: "75%", background: "rgba(11,18,32,0.05)", filter: "blur(30px)", animation: `morphBlob ${opts.blobDur} ease-in-out infinite`, animationDelay: opts.blobDelay, pointerEvents: "none" }} />
      <div style={{ position: "relative", fontSize: "1.5rem", fontWeight: 900, color: t.text, letterSpacing: "-0.02em" }}>{opts.title}</div>
      {lineList(opts.lines, t.muted, t.greenSolid)}
      <div style={{ position: "relative", fontSize: 11.5, fontWeight: 600, color: t.wordmarkB, marginTop: 16 }}>{opts.meta}</div>
      <a href={opts.href} style={{ position: "relative", display: "block", textAlign: "center", marginTop: 18, background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "11px 20px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
        {opts.cta}
      </a>
    </div>
  );

  return (
    <section id="pricing" style={{ position: "relative", padding: "112px 24px", background: t.pricingBg }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.cardBg} 0%, transparent 100%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 900, fontSize: "clamp(1.9rem,4vw,2.9rem)", letterSpacing: "-0.02em", color: t.text }}>
            Pricing that <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>stays simple.</em>
          </h2>
          <p style={{ fontSize: 13.5, color: t.muted, marginTop: 12, maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
            Three ways in — a solo student, a whole school, or a bespoke deployment. Pick your lane.
          </p>
        </div>

        <div className="pub-grid-3" style={{ gap: 20, alignItems: "stretch" }}>
          {/* 1 — Students (solo) */}
          {gatewayCard({
            title: "Students",
            lines: [
              "Solo learning, RAYA in your corner",
              "Remembers every concept",
              "Study Rooms, live",
              "Quizzes, summaries, flashcards",
            ],
            meta: "Free · Plus $6.99 · Max $19.99 / mo",
            cta: "See student plans",
            href: "/pricing?for=students",
            blobDur: "10.5s",
            blobDelay: "0s",
          })}

          {/* 2 — Schools (recommended, dark) */}
          <div style={{ display: "flex", flexDirection: "column", background: "#0b1220", color: "white", borderRadius: 24, padding: 28, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,0.25)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ position: "absolute", right: "-15%", bottom: "-15%", width: "75%", height: "75%", background: "rgba(255,255,255,0.09)", filter: "blur(30px)", animation: "morphBlob 7.5s ease-in-out infinite", animationDelay: "0.8s" }} />
            </div>
            <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "white", color: "#0b1220", fontSize: 9, fontWeight: 700, padding: "4px 12px", borderRadius: 999, letterSpacing: "0.1em", zIndex: 1 }}>
              RECOMMENDED
            </span>
            <div style={{ position: "relative", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Schools</div>
            {lineList(
              [
                "A class, a grade, or a whole school",
                "Teacher dashboards + per-class insights",
                "LMS sync + RAYA for Schools",
                "Billed per enrolled student",
              ],
              "rgba(255,255,255,0.78)",
              t.greenSolid,
            )}
            <div style={{ position: "relative", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 16 }}>Standard $1.50 · Plus $2.30 / student / mo</div>
            <a href="/pricing?for=schools" style={{ position: "relative", display: "block", textAlign: "center", marginTop: 18, background: "white", color: "#0b1220", borderRadius: 999, padding: "11px 20px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              See school plans
            </a>
          </div>

          {/* 3 — Custom (bespoke power) */}
          {gatewayCard({
            title: "Custom",
            lines: [
              "The full engine, tuned to your school",
              "Highest performance",
              "Advanced features",
              "Your data, your rules, your own AI",
            ],
            meta: "For institutions that want it all",
            cta: "Explore Custom",
            href: "/pricing?for=schools",
            blobDur: "9s",
            blobDelay: "1.6s",
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 36 }}>
          <a href="/pricing" style={{ fontSize: 13, fontWeight: 600, color: t.text, textDecoration: "none", borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 2 }}>
            Compare all plans →
          </a>
        </div>
      </div>
    </section>
  );
}
