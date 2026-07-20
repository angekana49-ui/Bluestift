import type { Theme } from "./theme";

export default function DifferentiatorsSection({ theme: t }: { theme: Theme }) {
  const cross = (label: string, verdict: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: "16px 20px" }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: t.crossBg, color: t.crossText, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: t.labelMuted }}>{label}</span>
      <span style={{ fontSize: 12, color: t.crossText }}>— {verdict}</span>
    </div>
  );

  return (
    <section style={{ position: "relative", background: t.cardBg, padding: "96px 24px" }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.sectionAltBg} 0%, transparent 100%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 900, fontSize: "clamp(1.7rem,3.6vw,2.6rem)", letterSpacing: "-0.02em", color: t.text }}>
            Why not the <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>others?</em>
          </h2>
          <p style={{ fontSize: 14, color: t.text, marginTop: 12 }}>The difference isn&apos;t the AI. It&apos;s the memory.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cross("ChatGPT / Claude", "Answers, but doesn't remember.")}
          {cross("Khan Academy", "A fixed path; step off the script and you're on your own.")}
          <div style={{ display: "flex", alignItems: "center", gap: 14, border: `1px solid ${t.diffRowBorder}`, background: t.diffRowBg, borderRadius: 16, padding: "16px 20px" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.diffStrong }}>RAYA</span>
            <span style={{ fontSize: 12, color: t.diffSoft }}>— Remembers. Adapts. Measures. And learns from you.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
