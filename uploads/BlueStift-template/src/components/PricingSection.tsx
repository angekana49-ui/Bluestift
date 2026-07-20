"use client";
import type { SiteConfig } from "./LandingPage";

type PlanStyle = {
  border: string;
  bg: string;
  mutedColor: string;
  textColor: string;
  descColor: string;
  checkBg: string;
  checkColor: string;
  featureColor: string;
  btnBorder: string;
  btnBg: string;
  btnColor: string;
  waveColor: string;
  waveDur: string;
  waveDelay: string;
};

const planStyles: Record<string, PlanStyle> = {
  Élève: {
    border: "rgba(226,232,240,0.9)", bg: "white", mutedColor: "#94a3b8", textColor: "#0b1220", descColor: "#64748b",
    checkBg: "#d1fae5", checkColor: "#059669", featureColor: "#475569",
    btnBorder: "none", btnBg: "#0b1220", btnColor: "white",
    waveColor: "rgba(11,18,32,0.055)", waveDur: "9s", waveDelay: "0s",
  },
  Classe: {
    border: "#0b1220", bg: "#0b1220", mutedColor: "rgba(255,255,255,0.55)", textColor: "white", descColor: "rgba(255,255,255,0.7)",
    checkBg: "white", checkColor: "#0b1220", featureColor: "rgba(255,255,255,0.82)",
    btnBorder: "none", btnBg: "white", btnColor: "#0b1220",
    waveColor: "rgba(255,255,255,0.09)", waveDur: "7.5s", waveDelay: "0.8s",
  },
  École: {
    border: "rgba(226,232,240,0.9)", bg: "#ffffff", mutedColor: "#94a3b8", textColor: "#0b1220", descColor: "#64748b",
    checkBg: "#d1fae5", checkColor: "#059669", featureColor: "#475569",
    btnBorder: "none", btnBg: "#0b1220", btnColor: "white",
    waveColor: "rgba(11,18,32,0.05)", waveDur: "10.5s", waveDelay: "1.6s",
  },
};

export default function PricingSection({ config }: { config: SiteConfig }) {
  const { pricing } = config;

  return (
    <section id="pricing" className="bluestift-pricing relative py-28 px-4 sm:px-6" style={{ scrollMarginTop: 100 }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="mx-auto max-w-3xl font-display font-black tracking-tight leading-[1.06] text-primary" style={{ fontSize: "clamp(1.9rem, 4vw, 2.9rem)" }}>
            {pricing.headline} <em className="font-accent not-italic italic">{pricing.highlightedWord}</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-solid">{pricing.subheadline}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {pricing.plans.map((plan) => {
            const s = planStyles[plan.name] ?? planStyles["Élève"];
            return (
              <div key={plan.name} className="relative pt-3">
                {plan.recommended && (
                  <span className="absolute top-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                    Recommended
                  </span>
                )}
                <div
                  className="relative flex flex-col overflow-hidden rounded-3xl p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.02]"
                  style={{ border: `1px solid ${s.border}`, background: s.bg }}
                >
                  <div className="bluestift-morph-blob" style={{ background: s.waveColor, animationDuration: s.waveDur, animationDelay: s.waveDelay }} />

                  <p className="relative text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: s.mutedColor }}>
                    {plan.name}
                  </p>

                  {plan.custom ? (
                    <p className="relative mt-3 text-[2.4rem] font-black leading-none tracking-tight" style={{ color: s.textColor }}>
                      Custom
                    </p>
                  ) : (
                    <div className="relative mt-3 flex items-end gap-1">
                      <span className="text-[2.4rem] font-black leading-none tracking-tight" style={{ color: s.textColor }}>
                        {plan.price}
                      </span>
                      <span className="mb-2 text-[11px]" style={{ color: s.mutedColor }}>
                        {plan.period}
                      </span>
                    </div>
                  )}

                  <p className="relative mt-2 text-xs leading-6" style={{ color: s.descColor }}>
                    {plan.description}
                  </p>

                  <div className="relative mt-6 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2.5">
                        <span
                          className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                          style={{ background: s.checkBg, color: s.checkColor }}
                        >
                          +
                        </span>
                        <span className="text-[11px] leading-6" style={{ color: s.featureColor }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="relative mt-6 rounded-full px-4 py-3 text-xs font-medium transition-transform hover:-translate-y-0.5"
                    style={{ border: s.btnBorder, background: s.btnBg, color: s.btnColor }}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
