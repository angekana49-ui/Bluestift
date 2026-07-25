"use client";

import { useRef, useState } from "react";
import { PublicNav } from "@/components/public/nav";
import { PublicFooter } from "@/components/public/footer";
import { landing as T, serif, sans } from "@/components/public/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "white",
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 15,
  color: T.ink,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export function ContactView({ signedIn }: { signedIn: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const canSend = form.message.trim().length > 0 && form.email.includes("@");

  async function submit() {
    if (!canSend || state === "busy") return;
    setState("busy");
    const res = await fetch("/api/content/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, token: captchaToken }),
    });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setState(res.ok ? "done" : "error");
  }

  return (
    <div style={{ fontFamily: sans, background: T.skyBg, minHeight: "100vh", color: T.ink, display: "flex", flexDirection: "column" }}>
      <PublicNav signedIn={signedIn} active="Contact" />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 10px" }}>
          Parler à <em style={{ fontFamily: serif, fontStyle: "italic", color: T.teal }}>l&apos;équipe.</em>
        </h1>
        <p style={{ fontSize: 15, color: T.inkSub, lineHeight: 1.6, marginBottom: 28 }}>
          École intéressée, chercheur, presse ou juste curieux — écris-nous, on répond vite.
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
            <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.teal, marginBottom: 6 }}>Message envoyé.</div>
            <p style={{ fontSize: 14, color: T.inkSub, margin: 0 }}>On te répond à {form.email} au plus vite.</p>
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
              gap: 12,
            }}
          >
            <div className="pub-grid-2" style={{ gap: 12 }}>
              <input
                placeholder="Ton nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="ton@email.com *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div className="pub-grid-2" style={{ gap: 12 }}>
              <input
                placeholder="Téléphone (optionnel)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                style={inputStyle}
              />
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                style={inputStyle}
              >
                <option value="">Sujet…</option>
                <option value="École / établissement">École / établissement</option>
                <option value="Recherche / collaboration">Recherche / collaboration</option>
                <option value="Presse">Presse</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <textarea
              placeholder="Ton message *"
              rows={6}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            {state === "error" && (
              <span style={{ fontSize: 13, color: "#dc2626" }}>Échec de l&apos;envoi — réessaie.</span>
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
                fontSize: 15,
                fontWeight: 700,
                cursor: canSend ? "pointer" : "default",
              }}
            >
              {state === "busy" ? "Envoi…" : "Envoyer le message"}
            </button>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
