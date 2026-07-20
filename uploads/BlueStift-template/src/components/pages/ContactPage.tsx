"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { defaultConfig } from "@/components/LandingPage";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] text-slate-900 outline-none";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const canSend = form.message.trim().length > 0 && form.email.includes("@");

  function submit() {
    if (!canSend || state === "busy") return;
    setState("busy");
    window.setTimeout(() => setState("done"), 600);
  }

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Navbar config={defaultConfig} active="Contact" section="Contact" />

      <Reveal className="flex-1">
        <div className="mx-auto max-w-lg px-4 pt-[140px] pb-24 sm:px-6">
          <h1 className="mb-2.5 font-display font-black tracking-tight text-primary" style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)" }}>
            Parler à <em className="font-accent not-italic italic" style={{ color: "#2f7fe0" }}>l&apos;équipe.</em>
          </h1>
          <p className="mb-7 text-[13px] leading-relaxed text-solid">
            École intéressée, chercheur, presse ou juste curieux — écris-nous, on répond vite.
          </p>

          {state === "done" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-7 text-center">
              <div className="mb-2.5 text-4xl">✓</div>
              <div className="mb-1.5 text-base font-bold text-sky-700">Message envoyé.</div>
              <p className="text-xs text-slate-500">On te répond à {form.email} au plus vite.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Ton nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
                <input placeholder="ton@email.com *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Téléphone (optionnel)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass}>
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
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <button
                onClick={submit}
                disabled={!canSend || state === "busy"}
                className="self-start rounded-full bg-slate-950 px-7 py-3 text-[13px] font-bold text-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {state === "busy" ? "Envoi…" : "Envoyer le message"}
              </button>
            </div>
          )}
        </div>
      </Reveal>

      <Footer config={defaultConfig} />
    </div>
  );
}
