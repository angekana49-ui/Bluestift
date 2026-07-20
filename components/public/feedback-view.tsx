"use client";

import { useRef, useState } from "react";
import { PublicNav } from "@/components/public/nav";
import { PublicFooter } from "@/components/public/footer";
import { landing as T, serif, sans } from "@/components/public/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

const TYPES: Array<[string, string]> = [
  ["suggestion", "💡 Suggestion"],
  ["bug", "🐛 Bug"],
  ["feature", "✨ Fonctionnalité"],
  ["praise", "💚 Bravo"],
  ["other", "💬 Autre"],
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "white",
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 13,
  color: T.ink,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

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

  return (
    <div style={{ fontFamily: sans, background: T.skyBg, minHeight: "100vh", color: T.ink, display: "flex", flexDirection: "column" }}>
      <PublicNav signedIn={signedIn} />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
          Ton <em style={{ fontFamily: serif, fontStyle: "italic", color: T.teal }}>feedback.</em>
        </h1>
        <p style={{ fontSize: 13, color: T.inkSub, lineHeight: 1.6, marginBottom: 28 }}>
          Un bug, une idée, un truc qui t&apos;a plu ou agacé — tout nous intéresse, tout est lu.
        </p>

        {state === "done" ? (
          <div
            style={{
              background: T.tealLight,
              border: `1px solid ${T.tealBorder}`,
              borderRadius: 14,
              padding: "28px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🙏</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.teal, marginBottom: 6 }}>Merci !</div>
            <p style={{ fontSize: 12, color: T.inkSub, margin: 0 }}>
              Ton feedback est transmis à l&apos;équipe.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "white",
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${type === k ? T.teal : T.border}`,
                    background: type === k ? T.tealLight : "transparent",
                    color: type === k ? T.teal : T.inkSub,
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.inkSub, marginRight: 4 }}>Note :</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n === rating ? 0 : n)}
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                    padding: 2,
                    filter: n <= rating ? "none" : "grayscale(1) opacity(0.4)",
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>

            <textarea
              placeholder="Dis-nous tout…"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
            <input
              placeholder="Ton email si tu veux une réponse (optionnel)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            {state === "error" && (
              <span style={{ fontSize: 11, color: "#dc2626" }}>Échec de l&apos;envoi — réessaie.</span>
            )}
            <button
              onClick={submit}
              disabled={!canSend || state === "busy"}
              style={{
                alignSelf: "flex-start",
                background: canSend ? T.ink : "rgba(0,0,0,0.08)",
                color: canSend ? "white" : T.inkMuted,
                border: "none",
                borderRadius: 99,
                padding: "12px 26px",
                fontSize: 13,
                fontWeight: 700,
                cursor: canSend ? "pointer" : "default",
              }}
            >
              {state === "busy" ? "Envoi…" : "Envoyer le feedback"}
            </button>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
