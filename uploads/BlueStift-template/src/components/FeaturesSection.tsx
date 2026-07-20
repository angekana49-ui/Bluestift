import React from "react";
import type { SiteConfig } from "./LandingPage";

const floatMeta = [
  { floatDur: "6.5s", floatDelay: "0s", shineDelay: "0s" },
  { floatDur: "7.2s", floatDelay: "0.5s", shineDelay: "2s" },
  { floatDur: "6.8s", floatDelay: "1s", shineDelay: "4s" },
];

export default function FeaturesSection({ config }: { config: SiteConfig }) {
  const { features } = config;

  return (
    <section className="bluestift-features relative py-24 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="mx-auto max-w-3xl font-display font-black tracking-tight leading-[1.08] text-primary" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
            Construit pour les élèves qui ont besoin de <em className="font-accent not-italic italic">plus</em>
            <br />
            qu&apos;<em className="font-accent not-italic italic">un chatbot.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-solid">{features.sectionSub}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {features.items.map((item, i) => {
            const meta = floatMeta[i] ?? floatMeta[0];
            return (
              <div
                key={item.title}
                className="relative overflow-hidden flex flex-col gap-5 rounded-[22px] border border-white/80 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)]"
                style={{ animation: `float-sm ${meta.floatDur} ease-in-out infinite`, animationDelay: meta.floatDelay }}
              >
                <div className="bluestift-shine" style={{ animationDelay: meta.shineDelay }} />
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-7 text-slate-500">{item.description}</p>
                </div>
                {item.stats && (
                  <div className="mt-auto rounded-[18px] bg-slate-50/90 p-4 flex flex-col gap-2.5">
                    {item.stats.map((s) => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{s.label}</span>
                        <span className="text-[11px] font-semibold" style={{ color: s.color }}>
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
