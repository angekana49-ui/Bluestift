"use client";

import Link from "next/link";
import { useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";

/** Local shape (structurally a subset of lib/billing's BillingPlan — kept local
 * so this client component never imports the server-only billing module). */
type Plan = {
  id: string;
  name: string;
  description: string | null;
  tier: string | null;
  price: number | null;
  priceUnit: "flat" | "per_seat";
  billingPeriod: string | null;
  features: string[];
};

type Audience = "students" | "schools";

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** Seeded names are "École — Standard" / "Élève — Plus"; the audience toggle
 * already conveys who it's for, so show just the tier on this English page. */
function tierName(name: string): string {
  const parts = name.split("—");
  return (parts.length > 1 ? parts[parts.length - 1] : name).trim();
}

/** Big headline price + its unit suffix, per plan pricing model. */
function priceParts(p: Plan): { big: string; unit: string | null } {
  if (p.price == null || p.price === 0) return { big: "Free", unit: null };
  if (p.priceUnit === "per_seat") return { big: money(p.price), unit: "/ student / mo" };
  return { big: money(p.price), unit: p.billingPeriod === "yearly" ? "/ yr" : "/ mo" };
}

function Check({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6 9 17l-5-5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanCard({
  t,
  plan,
  audience,
  recommended,
}: {
  t: Theme;
  plan: Plan;
  audience: Audience;
  recommended: boolean;
}) {
  const isSchool = audience === "schools";
  // A bespoke school plan can't carry a fixed sticker — it's quoted, not listed.
  const bespoke = isSchool && plan.tier === "custom";
  const { big, unit } = bespoke ? { big: "Custom", unit: null } : priceParts(plan);
  const free = plan.price == null || plan.price === 0;

  const cta = isSchool
    ? bespoke
      ? { label: "Talk to the team", href: "/contact" } // quoted, not self-serve
      : { label: "Start free pilot", href: "/login" } // listed plans → free pilot first
    : free
      ? { label: "Create an account", href: "/login" }
      : { label: `Get ${tierName(plan.name)}`, href: `/checkout?plan=${plan.id}&audience=b2c` };

  const dark = recommended;
  const text = dark ? "#eef2f8" : t.text;
  const muted = dark ? "rgba(255,255,255,0.62)" : t.muted;
  const checkColor = dark ? t.greenSolid : t.greenDot;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: dark ? "#0b1220" : t.cardBg,
        border: dark ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${t.cardBorder}`,
        borderRadius: 24,
        padding: "28px 24px",
        boxShadow: dark ? "0 20px 48px rgba(15,23,42,0.28)" : t.cardShadow,
      }}
    >
      {recommended && (
        <span
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: t.greenSolid,
            color: "#04231a",
            fontSize: 9,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 999,
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          RECOMMENDED
        </span>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: muted, textTransform: "uppercase" }}>
        {tierName(plan.name)}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: "2.3rem", fontWeight: 900, letterSpacing: "-0.02em", color: text }}>{big}</span>
        {unit && <span style={{ fontSize: 12, fontWeight: 500, color: muted }}>{unit}</span>}
      </div>

      {plan.description && (
        <p style={{ fontSize: 12.5, color: muted, margin: "10px 0 0", lineHeight: 1.6, minHeight: 34 }}>
          {plan.description}
        </p>
      )}

      <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.1)" : t.cardBorder, margin: "20px 0" }} />

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: dark ? "rgba(255,255,255,0.82)" : t.text, lineHeight: 1.5 }}>
            <Check color={checkColor} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        style={{
          display: "block",
          textAlign: "center",
          marginTop: 24,
          background: dark ? "#ffffff" : t.ctaBg,
          color: dark ? "#0b1220" : t.ctaText,
          borderRadius: 999,
          padding: "12px 20px",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {cta.label}
      </Link>
    </div>
  );
}

export function PricingView({
  signedIn,
  b2c,
  b2b,
  initialAudience = "students",
}: {
  signedIn: boolean;
  b2c: Plan[];
  b2b: Plan[];
  initialAudience?: Audience;
}) {
  const [audience, setAudience] = useState<Audience>(initialAudience);

  return (
    <SitePage active="Pricing" section="Pricing" signedIn={signedIn}>
      {(t) => {
        const plans = audience === "students" ? b2c : b2b;
        // In a 3-tier ladder (sorted by price asc), the middle tier is the hero.
        const recIndex = plans.length === 3 ? 1 : -1;

        const segBtn = (key: Audience, label: string) => {
          const on = audience === key;
          return (
            <button
              key={key}
              onClick={() => setAudience(key)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "8px 22px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: on ? 700 : 500,
                color: on ? t.text : t.muted,
                background: on ? t.pillActiveBg : "transparent",
                boxShadow: on ? t.pillActiveShadow : "none",
                transition: "all 0.2s ease",
              }}
            >
              {label}
            </button>
          );
        };

        return (
          <section style={{ position: "relative", zIndex: 1, overflow: "hidden", padding: "140px 24px 0" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box", paddingBottom: 96 }}>
              <div style={{ textAlign: "center", marginBottom: 30 }}>
                <h1
                  style={{
                    fontFamily: "'Inter Tight',sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(1.9rem,4.5vw,3rem)",
                    letterSpacing: "-0.02em",
                    margin: "0 0 12px",
                    color: t.text,
                  }}
                >
                  Pricing that{" "}
                  <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", color: t.wordmarkB }}>
                    stays simple.
                  </em>
                </h1>
                <p style={{ fontSize: 13.5, color: t.text, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
                  Students start free and stay free. Schools pay per enrolled student — their effectif, not per active
                  user.
                </p>
              </div>

              {/* Audience toggle */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 44 }}>
                <div style={{ display: "inline-flex", gap: 4, background: t.pillTrackBg, borderRadius: 999, padding: 4 }}>
                  {segBtn("students", "For students")}
                  {segBtn("schools", "For schools")}
                </div>
              </div>

              <div className="pub-grid-3" style={{ gap: 20, alignItems: "stretch" }}>
                {plans.map((p, i) => (
                  <PlanCard key={p.id} t={t} plan={p} audience={audience} recommended={i === recIndex} />
                ))}
              </div>

              {/* Schools billing note — the explicit "you pay per effectif" agreement. */}
              {audience === "schools" && (
                <div
                  style={{
                    marginTop: 30,
                    maxWidth: 720,
                    marginLeft: "auto",
                    marginRight: "auto",
                    background: t.chipBg,
                    border: `1px solid ${t.chipBorder}`,
                    borderRadius: 16,
                    padding: "16px 20px",
                    fontSize: 12.5,
                    color: t.muted,
                    lineHeight: 1.65,
                    textAlign: "center",
                  }}
                >
                  Billed <strong style={{ color: t.text }}>annually, per enrolled student</strong> (your declared
                  effectif) — a school of 800 pays for 800, whether 250 or all of them use RAYA that month. Quarterly and
                  monthly terms available. Every school starts with a free pilot; talk to us for a quote.
                </div>
              )}

              <p style={{ textAlign: "center", fontSize: 12, color: t.muted, marginTop: 28 }}>
                Questions about a plan?{" "}
                <Link href="/contact" style={{ color: t.wordmarkB, fontWeight: 600, textDecoration: "none" }}>
                  Talk to the team
                </Link>
                .
              </p>
            </div>
          </section>
        );
      }}
    </SitePage>
  );
}
