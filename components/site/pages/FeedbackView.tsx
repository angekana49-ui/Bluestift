"use client";

import { useRef, useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

const TYPES: [string, string][] = [
  ["suggestion", "💡 Suggestion"],
  ["bug", "🐛 Bug"],
  ["feature", "✨ Feature"],
  ["praise", "💚 Praise"],
  ["other", "💬 Other"],
];

export function FeedbackView({ signedIn }: { signedIn: boolean }) {
  const [type, setType] = useState("suggestion");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

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
        <section style={{ position: "relative", zIndex: 1, overflow: "hidden", padding: "150px 24px 0" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", paddingBottom: 96 }}>
            <h1 style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem,4vw,2.4rem)", letterSpacing: "-0.02em", margin: "0 0 10px", color: t.text }}>
              Your <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", color: t.wordmarkB }}>feedback.</em>
            </h1>
            <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7, margin: "0 0 28px" }}>
              A bug, an idea, something you loved or that annoyed you — we want it all, and we read it all.
            </p>

            {state === "done" ? (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 28, textAlign: "center", boxShadow: t.cardShadow }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>🙏</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.wordmarkB, marginBottom: 6 }}>Thank you!</div>
                <p style={{ fontSize: 12, color: t.muted, margin: 0 }}>Your feedback has been sent to the team.</p>
              </div>
            ) : (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 14, boxShadow: t.cardShadow }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TYPES.map(([k, l]) => {
                    const on = type === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${on ? t.wordmarkB : t.cardBorder}`,
                          background: on ? "rgba(47,127,224,0.1)" : "transparent",
                          color: on ? t.wordmarkB : t.muted,
                          padding: "6px 14px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
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
                      onClick={() => setRating(n === rating ? 0 : n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: 20, filter: n <= rating ? "none" : "grayscale(1) opacity(0.4)" }}
                    >
                      ⭐
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
      )}
    </SitePage>
  );
}
