import type { Theme } from "./theme";
import CloudBackground from "./CloudBackground";
import DashboardMockup from "./DashboardMockup";

const BIRD_PATH =
  "M12 6 C9 2 4 1 0 3 C4 4 7 6 9 8 C7 10 4 12 0 13 C4 15 9 14 12 10 C15 14 20 15 24 13 C20 12 17 10 15 8 C17 6 20 4 24 3 C20 1 15 2 12 6 Z";

const CHIPS = ["14-day trial", "No card required", "Cancel anytime"];

export default function HeroSection({ theme: t }: { theme: Theme }) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "150px 24px 180px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <CloudBackground theme={t} variant="hero" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: t.chipBg,
            border: `1px solid ${t.chipBorder}`,
            borderRadius: 999,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 20,
            color: t.text,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.text }} />
          AI tutor · K-12 · Cameroon &amp; US
        </div>

        <div style={{ position: "relative", display: "inline-block", maxWidth: 820 }}>
          <h1
            style={{
              fontFamily: "'Caveat',cursive",
              fontWeight: 700,
              fontSize: "clamp(3.2rem,9vw,6.4rem)",
              lineHeight: 0.92,
              margin: 0,
              color: t.text,
              animation: "writeReveal 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both",
            }}
          >
            The AI tutor that remembers every student.
          </h1>
          <span style={{ position: "absolute", width: 22, height: 16, pointerEvents: "none", animation: "birdFly 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both" }}>
            <svg width="22" height="16" viewBox="0 0 24 16" style={{ display: "block", animation: "wingFlap 0.22s ease-in-out infinite", transformOrigin: "center" }}>
              <path d={BIRD_PATH} fill={t.birdColor} />
            </svg>
          </span>
          <span style={{ position: "absolute", width: 16, height: 12, pointerEvents: "none", animation: "birdFly2 2.8s cubic-bezier(0.65,0,0.35,1) 0.55s 1 both" }}>
            <svg width="16" height="12" viewBox="0 0 24 16" style={{ display: "block", animation: "wingFlap 0.19s ease-in-out infinite", transformOrigin: "center" }}>
              <path d={BIRD_PATH} fill={t.birdColor} />
            </svg>
          </span>
        </div>

        <p style={{ maxWidth: 560, margin: "20px auto 0", fontSize: 18, lineHeight: 1.7, color: t.text }}>
          Raya adapts every session to each student&apos;s real cognitive profile — solo, in groups, in real time. Not a
          chatbot. A tutor.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <a href="/login" style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "13px 24px", fontSize: 16, fontWeight: 500, textDecoration: "none" }}>
            Try it free
          </a>
          <a
            href="#pricing"
            style={{ background: t.chipBg, border: `1px solid ${t.chipBorder}`, borderRadius: 999, padding: "13px 22px", fontSize: 16, fontWeight: 500, color: t.text, textDecoration: "none" }}
          >
            See how it works
          </a>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {CHIPS.map((c) => (
            <span key={c} style={{ fontSize: 13, background: t.chipBg, border: `1px solid ${t.chipBorder}`, borderRadius: 999, padding: "5px 12px", color: t.text }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 56, width: "100%", maxWidth: 1080, animation: "floatSm 7s ease-in-out infinite", zIndex: 1 }}>
        <DashboardMockup theme={t} />
      </div>
    </section>
  );
}
