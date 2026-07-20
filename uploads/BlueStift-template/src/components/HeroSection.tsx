"use client";

import type { SiteConfig } from "./LandingPage";
import dynamic from "next/dynamic";

const DashboardMockup = dynamic(() => import("./DashboardMockup"), {
  ssr: false,
  loading: () => <div className="h-40 sm:h-56" aria-hidden="true" />,
});

export default function HeroSection({ config }: { config: SiteConfig }) {
  return (
    <section className="relative overflow-hidden pt-[150px] pb-24">
      <div className="bluestift-hero-day" />
      <div className="bluestift-hero-night" />
      {/* Soft top fade for day mode */}
      <div
        className="absolute inset-0 [html[data-theme=night]_&]:opacity-0 transition-opacity"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(234,245,251,0.7) 100%)",
        }}
      />
      {/* Contained fade at the bottom of the hero into the Features section tone */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, var(--features-bg))" }}
      />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <div className="bluestift-pill mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-medium whitespace-nowrap">
          <span className="h-[7px] w-[7px] rounded-full bg-slate-950 flex-shrink-0" />
          Tuteur IA · K-12 · Cameroun &amp; US
        </div>

        <div className="relative inline-block max-w-[820px]">
          <h1 className="bluestift-write text-solid" style={{ lineHeight: 0.92, fontSize: "clamp(3.2rem, 9vw, 6.4rem)", margin: 0 }}>
            {config.hero.headline}
          </h1>
          <span className="bluestift-pen" />
        </div>

        <p className="mt-5 max-w-xl text-base leading-7 text-solid">{config.hero.subheadline}</p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-slate-800">
            {config.hero.ctaPrimary}
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-5 py-3 text-sm font-medium text-slate-700 backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:bg-white">
            {config.hero.ctaSecondary}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[10px] text-solid">
          {["Essai 14 jours", "Sans carte bancaire", "Annulation à tout moment"].map((t) => (
            <span key={t} className="bluestift-pill rounded-full border px-3 py-1">
              {t}
            </span>
          ))}
        </div>

        <div className="relative mt-14 w-full max-w-6xl animate-float-soft">
          <div className="absolute inset-x-6 top-8 -z-10 h-[70%] rounded-[40px] bg-slate-950/10 blur-3xl sm:inset-x-8" />
          <DashboardMockup config={config} />
        </div>
      </div>
    </section>
  );
}
