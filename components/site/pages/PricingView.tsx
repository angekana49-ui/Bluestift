"use client";

import Link from "next/link";
import { useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";
import { ANNUAL_DISCOUNT, annualMonthlyRate, termTotal } from "@/lib/billing/terms";
import { RayaName } from "@/components/ui/brand";

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

type Audience = "solo" | "schools";
/** Chosen per card, Anthropic-style: each plan carries its own billing term, so
 *  a visitor can weigh Plus-annual against Max-monthly without the page forcing
 *  one term on every tier at once. */
type Term = "monthly" | "annual";

/** Months sent to /checkout. The API re-derives the price from this same number
 *  (termTotal), so the sticker and the charge cannot drift apart. */
const TERM_MONTHS: Record<Term, number> = { monthly: 1, annual: 12 };

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** Seeded names are "École — Standard" / "User — Plus"; the audience toggle
 * already conveys who it's for, so show just the tier on this English page. */
function tierName(name: string): string {
  const parts = name.split("—");
  return (parts.length > 1 ? parts[parts.length - 1] : name).trim();
}

/**
 * Big headline price + its unit suffix, per plan pricing model and term.
 *
 * Both terms are quoted as a PER-MONTH rate on purpose: "$5.94 / mo" against
 * "$6.99 / mo" is a comparison a reader can make at a glance, where "$71.30 /
 * yr" against "$6.99 / mo" is arithmetic homework. The real once-a-year charge
 * is spelled out in the line underneath so nothing is hidden by that choice.
 *
 * A plan already seeded as `billingPeriod: "yearly"` carries a yearly sticker
 * and is left alone — its price is not a monthly rate to re-derive.
 */
function priceParts(p: Plan, term: Term): { big: string; unit: string | null } {
  if (p.price == null || p.price === 0) return { big: "Free", unit: null };
  if (p.billingPeriod === "yearly" && p.priceUnit !== "per_seat") {
    return { big: money(p.price), unit: "/ yr" };
  }
  const rate = term === "annual" ? annualMonthlyRate(p.price) : p.price;
  return { big: money(rate), unit: p.priceUnit === "per_seat" ? "/ student / mo" : "/ mo" };
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
  // Card-local: switching Plus to annual must not silently re-price Max too.
  // Defaults to monthly — showing the discounted rate first and only revealing
  // the real monthly price after a click is the dark pattern, not the default.
  const [term, setTerm] = useState<Term>("monthly");
  const isSchool = audience === "schools";
  // A bespoke school plan can't carry a fixed sticker — it's quoted, not listed.
  const bespoke = isSchool && plan.tier === "custom";
  const { big, unit } = bespoke ? { big: "Custom", unit: null } : priceParts(plan, term);
  const free = plan.price == null || plan.price === 0;
  const annual = term === "annual";
  /** True when the sticker is a monthly rate the term can actually move. */
  const ratedMonthly =
    !free && !bespoke && plan.price != null &&
    (plan.priceUnit === "per_seat" || plan.billingPeriod !== "yearly");

  const cta = isSchool
    ? bespoke
      ? { label: "Talk to the team", href: "/contact" } // quoted, not self-serve
      : { label: "Start free pilot", href: "/login" } // listed plans → free pilot first
    : free
      ? { label: "Create an account", href: "/login" }
      : {
          label: `Get ${tierName(plan.name)}`,
          // Carry the term through: without `months` the checkout would fall back
          // to a 1-month term and charge the monthly price for an annual pick.
          href: `/checkout?plan=${plan.id}&audience=b2c&months=${TERM_MONTHS[term]}`,
        };

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
            fontSize: 13,
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

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: muted, textTransform: "uppercase" }}>
        {tierName(plan.name)}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "2.3rem", fontWeight: 900, letterSpacing: "-0.02em", color: text }}>{big}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 500, color: muted }}>{unit}</span>}
        {/* What the annual rate is a discount FROM — without it, the cheaper
            number reads as the plan simply being cheap. */}
        {ratedMonthly && annual && (
          <span style={{ fontSize: 14, fontWeight: 500, color: muted, textDecoration: "line-through" }}>
            {money(plan.price!)}
          </span>
        )}
      </div>

      {/* Monthly selected → what switching would save. Annual selected → what is
          actually debited, since the headline is a per-month rate the customer
          never sees on their statement. */}
      {ratedMonthly && !annual && (
        <div style={{ fontSize: 13, fontWeight: 500, color: muted, marginTop: 5 }}>
          or {money(annualMonthlyRate(plan.price!))}
          {plan.priceUnit === "per_seat" ? " / student" : ""} / mo billed annually{" "}
          <span style={{ color: checkColor, fontWeight: 700 }}>· save {Math.round(ANNUAL_DISCOUNT * 100)}%</span>
        </div>
      )}
      {ratedMonthly && annual && (
        <div style={{ fontSize: 13, fontWeight: 500, color: muted, marginTop: 5 }}>
          {plan.priceUnit === "per_seat" ? (
            <>billed annually, per enrolled student</>
          ) : (
            <>{money(termTotal(plan.price! * 12, 12))} billed once a year</>
          )}{" "}
          <span style={{ color: checkColor, fontWeight: 700 }}>· save {Math.round(ANNUAL_DISCOUNT * 100)}%</span>
        </div>
      )}

      {/* Term switch — only on cards where a term means something. A free plan
          has nothing to bill, and a bespoke school plan is quoted, not listed. */}
      {ratedMonthly && (
        <div
          role="group"
          aria-label="Billing term"
          style={{
            display: "inline-flex",
            gap: 3,
            alignSelf: "flex-start",
            marginTop: 14,
            padding: 3,
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,0.09)" : t.pillTrackBg,
          }}
        >
          {(["monthly", "annual"] as const).map((key) => {
            const on = term === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTerm(key)}
                aria-pressed={on}
                style={{
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  whiteSpace: "nowrap",
                  color: on ? (dark ? "#0b1220" : t.text) : muted,
                  background: on ? (dark ? "#ffffff" : t.pillActiveBg) : "transparent",
                  boxShadow: on ? t.pillActiveShadow : "none",
                  transition: "all 0.18s ease",
                }}
              >
                {key === "monthly" ? "Monthly" : "Annual"}
                {key === "annual" && (
                  <span
                    style={{
                      background: on ? t.greenBg : "transparent",
                      color: on ? t.greenText : checkColor,
                      border: `1px solid ${on ? t.greenBorder : "transparent"}`,
                      borderRadius: 999,
                      padding: "0 6px",
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    −{Math.round(ANNUAL_DISCOUNT * 100)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {plan.description && (
        <p style={{ fontSize: 15, color: muted, margin: "10px 0 0", lineHeight: 1.6, minHeight: 34 }}>
          {plan.description}
        </p>
      )}

      <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.1)" : t.cardBorder, margin: "20px 0" }} />

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: "flex", gap: 9, fontSize: 15, color: dark ? "rgba(255,255,255,0.82)" : t.text, lineHeight: 1.5 }}>
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
          fontSize: 15,
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
  initialAudience = "solo",
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
        const plans = audience === "solo" ? b2c : b2b;
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
                fontSize: 15,
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
                    fontFamily: "'IBM Plex Sans',sans-serif",
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
                <p style={{ fontSize: 16, color: t.text, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
                  Solo starts free and stays free. Schools pay per enrolled student — their effectif, not per active
                  user.
                </p>
              </div>

              {/* Audience toggle */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 44 }}>
                <div style={{ display: "inline-flex", gap: 4, background: t.pillTrackBg, borderRadius: 999, padding: 4 }}>
                  {segBtn("solo", "Solo")}
                  {segBtn("schools", "Schools")}
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
                    fontSize: 15,
                    color: t.muted,
                    lineHeight: 1.65,
                    textAlign: "center",
                  }}
                >
                  Billed <strong style={{ color: t.text }}>annually, per enrolled student</strong> (your declared
                  effectif) — a school of 800 pays for 800, whether 250 or all of them use <RayaName /> that month. Quarterly and
                  monthly terms available. Every school starts with a free pilot; talk to us for a quote.
                </div>
              )}

              <p style={{ textAlign: "center", fontSize: 14, color: t.muted, marginTop: 28 }}>
                Questions about a plan?{" "}
                <Link href="/contact" style={{ color: t.link, fontWeight: 600, textDecoration: "none" }}>
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
