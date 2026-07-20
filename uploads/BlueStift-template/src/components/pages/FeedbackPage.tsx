"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { defaultConfig } from "@/components/LandingPage";

const TYPES: [string, string][] = [
  ["suggestion", "💡 Suggestion"],
  ["bug", "🐛 Bug"],
  ["feature", "✨ Fonctionnalité"],
  ["praise", "💚 Bravo"],
  ["other", "💬 Autre"],
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] text-slate-900 outline-none";

export default function FeedbackPage() {
  const [type, setType] = useState("suggestion");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const canSend = message.trim().length > 0 || rating > 0;

  function submit() {
    if (!canSend || state === "busy") return;
    setState("busy");
    window.setTimeout(() => setState("done"), 600);
  }

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Navbar config={defaultConfig} active="Produit" section="Feedback" />

      <Reveal className="flex-1">
        <div className="mx-auto max-w-lg px-4 pt-[140px] pb-24 sm:px-6">
          <h1 className="mb-2.5 font-display font-black tracking-tight text-primary" style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)" }}>
            Ton <em className="font-accent not-italic italic" style={{ color: "#2f7fe0" }}>feedback.</em>
          </h1>
          <p className="mb-7 text-[13px] leading-relaxed text-solid">
            Un bug, une idée, un truc qui t&apos;a plu ou agacé — tout nous intéresse, tout est lu.
          </p>

          {state === "done" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-7 text-center">
              <div className="mb-2.5 text-4xl">🙏</div>
              <div className="mb-1.5 text-base font-bold text-sky-700">Merci !</div>
              <p className="text-xs text-slate-500">Ton feedback est transmis à l&apos;équipe.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setType(k)}
                    className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold ${
                      type === k ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs text-slate-500">Note :</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                    className="p-0.5 text-xl"
                    style={{ filter: n <= rating ? "none" : "grayscale(1) opacity(0.4)" }}
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
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <input
                placeholder="Ton email si tu veux une réponse (optionnel)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={submit}
                disabled={!canSend || state === "busy"}
                className="self-start rounded-full bg-slate-950 px-7 py-3 text-[13px] font-bold text-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {state === "busy" ? "Envoi…" : "Envoyer le feedback"}
              </button>
            </div>
          )}
        </div>
      </Reveal>

      <Footer config={defaultConfig} />
    </div>
  );
}
