import type { Theme } from "./theme";

const FEATURES: { icon: string; title: string; desc: string; float: string; delay: string; shineDelay: string }[] = [
  { icon: "K", title: "Cognitive Kernel", desc: "Mastery is measured concept by concept, not by an overall grade.", float: "6.5s", delay: "0s", shineDelay: "0s" },
  { icon: "S", title: "Study Rooms", desc: "Students and Raya together in real time, studying as a group.", float: "7.2s", delay: "0.5s", shineDelay: "2s" },
  { icon: "T", title: "Tools Studio", desc: "Quizzes, summaries, and flashcards generated from any lesson.", float: "6.8s", delay: "1s", shineDelay: "4s" },
];

export default function FeaturesSection({ theme: t }: { theme: Theme }) {
  return (
    <section style={{ position: "relative", background: t.sectionAltBg, padding: "96px 24px" }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 140, background: `linear-gradient(180deg, ${t.heroEndSolid} 0%, transparent 100%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "-0.02em", maxWidth: 640, margin: "0 auto", color: t.text }}>
            Built for students who need <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>more</em>
            <br />
            than <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}>a chatbot.</em>
          </h2>
          <p style={{ maxWidth: 520, margin: "16px auto 0", fontSize: 14, color: t.text, lineHeight: 1.7 }}>
            Three surfaces that work together. None of them need managing.
          </p>
        </div>

        <div className="pub-grid-3" style={{ gap: 20 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                position: "relative",
                overflow: "hidden",
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 22,
                padding: 24,
                boxShadow: t.cardShadow,
                animation: `floatSm ${f.float} ease-in-out infinite`,
                animationDelay: f.delay,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "linear-gradient(115deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.35) 20%,rgba(255,255,255,0) 40%)",
                  backgroundSize: "250% 100%",
                  animation: "shine 6s linear infinite",
                  animationDelay: f.shineDelay,
                }}
              />
              <div style={{ position: "relative", width: 44, height: 44, borderRadius: 16, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, marginBottom: 20 }}>
                {f.icon}
              </div>
              <div style={{ position: "relative", fontSize: 15, fontWeight: 600, color: t.text }}>{f.title}</div>
              <p style={{ position: "relative", fontSize: 13, color: t.muted, lineHeight: 1.7, marginTop: 8 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
