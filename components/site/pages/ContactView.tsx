"use client";

import { useRef, useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { pageColumn, pageH1, pageSection, serifEm } from "@/components/site/layout";

const SUBJECTS = ["School", "Research / collaboration", "Press", "Other"];

export function ContactView({ signedIn }: { signedIn: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
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
      body: JSON.stringify({ ...form, phone: "", token: captchaToken }),
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
      fontSize: 14,
      color: t.text,
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    }) as const;

  return (
    <SitePage active="Contact" section="Contact" signedIn={signedIn}>
      {(t) => (
        <section style={pageSection}>
          <div style={pageColumn("form")}>
            <h1 style={pageH1(t)}>
              Talk to <em style={{ ...serifEm, color: t.wordmarkB }}>the team.</em>
            </h1>
            <p style={{ fontSize: 15, color: t.text, lineHeight: 1.7, margin: "0 0 28px" }}>
              Interested school, researcher, press, or just curious — write to us, we reply fast.
            </p>

            {state === "done" ? (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 28, textAlign: "center", boxShadow: t.cardShadow }}>
                <div style={{ fontSize: 38, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.wordmarkB, marginBottom: 6 }}>Message sent.</div>
                <p style={{ fontSize: 14, color: t.muted, margin: 0 }}>We&apos;ll reply to {form.email} as soon as we can.</p>
              </div>
            ) : (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12, boxShadow: t.cardShadow }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input(t)} />
                  <input placeholder="you@email.com *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input(t)} />
                </div>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ ...input(t), color: form.subject ? t.text : t.inputPlaceholder }}>
                  <option value="">Subject…</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <textarea
                  placeholder="Your message *"
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  style={{ ...input(t), height: 100, resize: "vertical", lineHeight: 1.6 }}
                />
                <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
                {state === "error" && <span style={{ fontSize: 13, color: "#ef4444" }}>Couldn&apos;t send — try again.</span>}
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
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: canSend && state !== "busy" ? "pointer" : "default",
                  }}
                >
                  {state === "busy" ? "Sending…" : "Send message"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </SitePage>
  );
}
