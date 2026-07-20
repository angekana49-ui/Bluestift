"use client";
import { useEffect, useState } from "react";
import type { SiteConfig } from "./LandingPage";

const statusColors: Record<string, { bg: string; text: string }> = {
  blue: { bg: "#eff6ff", text: "#3b82f6" },
  gray: { bg: "#f3f4f6", text: "#9ca3af" },
  orange: { bg: "#fff7ed", text: "#f97316" },
  yellow: { bg: "#fefce8", text: "#ca8a04" },
  "": { bg: "transparent", text: "transparent" },
};

export default function InboxSection({ config }: { config: SiteConfig }) {
  const { inbox } = config;
  const [activeThread, setActiveThread] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveThread((v) => (v + 1) % inbox.threads.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [inbox.threads.length]);

  return (
    <section className="bluestift-inbox relative py-28 px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <h2 className="mb-6 font-display font-black tracking-tight leading-[1.02] text-primary" style={{ fontSize: "clamp(1.95rem, 4vw, 3.4rem)" }}>
            {inbox.headline}
            <br />
            <em className="font-accent not-italic italic">{inbox.highlightedWord}</em>
          </h2>
          <p className="mb-8 max-w-md text-sm leading-7 text-solid">{inbox.description}</p>

          <div className="mb-8 flex flex-col gap-4">
            {inbox.bullets.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-950">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-primary">{b.title}</p>
                  <p className="mt-0.5 text-xs text-solid">{b.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-xs font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 hover:bg-slate-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Voir une session RAYA
            </button>
            <a href="/research" className="flex items-center gap-1 text-xs text-solid">
              Voir le Cognitive Kernel →
            </a>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_26px_70px_rgba(15,23,42,0.11)]">
          <div className="bluestift-shine" style={{ animationDuration: "8s" }} />
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-950">Sessions</span>
              <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {inbox.threads.length + 15}
              </span>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-400">
              Filtrer les élèves
            </span>
          </div>

          {inbox.threads.map((t, i) => {
            const active = i === activeThread;
            const sc = statusColors[t.statusColor ?? ""];
            return (
              <div
                key={t.name}
                className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 transition-colors"
                style={{ background: active ? "#f8fafc" : "transparent" }}
              >
                <div
                  className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors"
                  style={{ background: active ? "#0b1220" : "#e2e8f0" }}
                >
                  <span className="text-[9px] font-bold" style={{ color: active ? "white" : "#64748b" }}>
                    {t.initials}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-950">{t.name}</span>
                    {t.status && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: sc.bg, color: sc.text }}>
                        {t.status}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] leading-snug text-slate-500">{t.preview}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
