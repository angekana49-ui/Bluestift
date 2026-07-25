"use client";

import type { ComponentType, CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { IconLightbulb, IconBug, IconSparkle, IconHeart, IconChatBubble, IconStar } from "@/components/site/icons";

type IconEl = ComponentType<{ size?: number; filled?: boolean }>;

const PRAISE_RED = "#e0245e";
const STAR_GOLD = "#f5a623";

type Kind = "heart" | "star";
type Particle = { id: number; kind: Kind; left: number; size: number; delay: number; duration: number; drift: number; spin: number; color: string; glow: string };

/** Full-screen one-shot burst of hearts/stars rising and fading — the "like". */
function ParticleBurst({ particles }: { particles: Particle[] }) {
  if (particles.length === 0) return null;
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 9999 }}>
      {particles.map((p) => (
        <span
          key={p.id}
          style={
            {
              position: "absolute",
              left: `${p.left}vw`,
              bottom: -48,
              color: p.color,
              filter: `drop-shadow(0 2px 6px ${p.glow})`,
              animation: `heartRise ${p.duration}s cubic-bezier(0.34,0.2,0.4,1) ${p.delay}s forwards`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as CSSProperties
          }
        >
          {p.kind === "star" ? <IconStar size={p.size} filled /> : <IconHeart size={p.size} filled />}
        </span>
      ))}
    </div>
  );
}

const TYPES: [string, string, IconEl][] = [
  ["suggestion", "Suggestion", IconLightbulb],
  ["bug", "Bug", IconBug],
  ["feature", "Feature", IconSparkle],
  ["praise", "Praise", IconHeart],
  ["other", "Other", IconChatBubble],
];

export function FeedbackView({ signedIn }: { signedIn: boolean }) {
  const [type, setType] = useState("suggestion");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending burst timeout if the view unmounts mid-celebration.
  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  function celebrate(kind: Kind) {
    const base = Date.now();
    const glow = kind === "star" ? "rgba(245,166,35,0.4)" : "rgba(224,36,94,0.35)";
    const batch: Particle[] = Array.from({ length: 22 }, (_, i) => ({
      id: base + i,
      kind,
      left: 4 + Math.random() * 92, // vw
      size: 16 + Math.random() * 26,
      delay: Math.random() * 1.1, // s — staggered so they keep popping
      duration: 2.6 + Math.random() * 1.6, // s — rise time
      drift: (Math.random() - 0.5) * 160, // px sideways sway
      spin: (Math.random() - 0.5) * 60, // deg
      color: kind === "star" ? (i % 2 === 0 ? STAR_GOLD : "#ffcf4d") : i % 3 === 0 ? "#ff5c8a" : PRAISE_RED,
      glow,
    }));
    setParticles(batch);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    // Longest particle finishes by ~1.1s delay + ~4.2s rise; clear a hair after.
    burstTimer.current = setTimeout(() => setParticles([]), 5000);
  }

  const canSend = message.trim().length > 0 || rating > 0;

  async function submit() {
    if (!canSend || state === "busy") return;
    setState("busy");
    const res = await fetch("/api/content/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        rating: rating || undefined,
        message,
        email: email || undefined,
        page_url: typeof document !== "undefined" ? document.referrer || null : null,
        token: captchaToken,
      }),
    });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setState(res.ok ? "done" : "error");
  }

  const input = (t: Theme) =>
    ({
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      borderRadius: 10,
      padding: "11px 14px",
      fontSize: 12,
      color: t.text,
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    }) as const;

  return (
    <SitePage active="Product" section="Feedback" signedIn={signedIn}>
      {(t) => (
        <>
        <ParticleBurst particles={particles} />
        <section style={{ position: "relative", zIndex: 1, overflow: "hidden", padding: "150px 24px 0" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", paddingBottom: 96 }}>
            <h1 style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem,4vw,2.4rem)", letterSpacing: "-0.02em", margin: "0 0 10px", color: t.text }}>
              Your <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", color: t.wordmarkB }}>feedback.</em>
            </h1>
            <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7, margin: "0 0 28px" }}>
              A bug, an idea, something you loved or that annoyed you — we want it all, and we read it all.
            </p>

            {state === "done" ? (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 28, textAlign: "center", boxShadow: t.cardShadow }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: t.wordmarkB }}>
                  <IconHeart size={34} filled />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.wordmarkB, marginBottom: 6 }}>Thank you!</div>
                <p style={{ fontSize: 12, color: t.muted, margin: 0 }}>Your feedback has been sent to the team.</p>
              </div>
            ) : (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 14, boxShadow: t.cardShadow }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TYPES.map(([k, l, Icon]) => {
                    const on = type === k;
                    const praiseOn = k === "praise" && on;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setType(k);
                          if (k === "praise") celebrate("heart");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          border: `1px solid ${praiseOn ? PRAISE_RED : on ? t.wordmarkB : t.cardBorder}`,
                          background: praiseOn ? "rgba(224,36,94,0.1)" : on ? "rgba(47,127,224,0.1)" : "transparent",
                          color: praiseOn ? PRAISE_RED : on ? t.wordmarkB : t.muted,
                          padding: "6px 14px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "color 0.2s, border-color 0.2s, background 0.2s",
                        }}
                      >
                        <span style={{ display: "inline-flex", color: praiseOn ? PRAISE_RED : undefined, transform: praiseOn ? "scale(1.15)" : "none", transition: "transform 0.2s ease" }}>
                          <Icon size={14} filled={praiseOn} />
                        </span>
                        {l}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ marginRight: 4, fontSize: 12, color: t.muted }}>Rating:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        const next = n === rating ? 0 : n;
                        setRating(next);
                        if (next >= 4) celebrate("star");
                      }}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "inline-flex", color: n <= rating ? "#f5a623" : t.mutedLight }}
                    >
                      <IconStar size={20} filled={n <= rating} />
                    </button>
                  ))}
                </div>

                <textarea
                  placeholder="Tell us everything…"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ ...input(t), resize: "vertical", lineHeight: 1.6 }}
                />
                <input placeholder="Your email if you'd like a reply (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input(t)} />
                <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
                {state === "error" && <span style={{ fontSize: 11, color: "#ef4444" }}>Couldn&apos;t send — try again.</span>}
                <button
                  onClick={submit}
                  disabled={!canSend || state === "busy"}
                  style={{
                    alignSelf: "flex-start",
                    background: canSend && state !== "busy" ? t.ctaBg : t.inputFieldBg,
                    color: canSend && state !== "busy" ? t.ctaText : t.muted,
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 26px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: canSend && state !== "busy" ? "pointer" : "default",
                  }}
                >
                  {state === "busy" ? "Sending…" : "Send feedback"}
                </button>
              </div>
            )}
          </div>
        </section>
        </>
      )}
    </SitePage>
  );
}
