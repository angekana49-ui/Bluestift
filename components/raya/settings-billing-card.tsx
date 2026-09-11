"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppTheme } from "@/components/ui/theme";
import { getJsonCached } from "@/lib/net/client-fetch";
import { SettingsCard } from "@/components/raya/raya-app";
import { useTranslate } from "@/components/ui/locale";
import { billingDisplay } from "@/components/ui/tokens";

type B2cPlan = {
  id: string;
  name: string;
  price: number | null;
  billingPeriod: string | null;
  features: string[];
};

/**
 * Settings "Billing" — the plan catalogue, priced, whether or not you can buy.
 *
 * It used to name the free plan, then say "Upgrades unavailable" and stop. The
 * effect was that the one question a student opens this card with — what would
 * I get, and for how much — had no answer anywhere inside the app, while the
 * Schools side has shown its full priced catalogue all along. "Closed" and
 * "secret" are different things, and only the first one is true here.
 *
 * So the tiers are laid out the same way Schools lays its own out: name, price,
 * features, current plan marked. The only difference a closed paywall makes is
 * what sits where the Activate button would be.
 */
export function StudentBillingCard() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [plans, setPlans] = useState<B2cPlan[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      // The catalogue barely moves (an admin-edited price list), so it's
      // cached generously — instant render on every repeat visit.
      const { data } = await getJsonCached<{ plans?: B2cPlan[] }>("/api/billing/plans?category=b2c", {
        cacheKey: "billing:plansB2c",
        cacheTtlMs: 5 * 60_000,
        onUpdate: (fresh) => {
          if (Array.isArray(fresh.plans) && fresh.plans.length > 0) setPlans(fresh.plans);
        },
      });
      if (Array.isArray(data?.plans) && data.plans.length > 0) setPlans(data.plans);
      else setFailed(true);
    })();
  }, []);

  // The free tier is the one every student is on today, so it is "current"
  // without asking the server a second question.
  const free = plans?.find((p) => p.price === 0) ?? null;
  const paid = (plans ?? []).filter((p) => (p.price ?? 0) > 0);

  const fmtPrice = (p: B2cPlan) => {
    if (p.price == null) return tr("raya.settings.billing.onQuote");
    if (p.price === 0) return tr("raya.settings.billing.free");
    return `$${p.price}/${p.billingPeriod === "yearly" ? tr("raya.settings.billing.perYear") : tr("raya.settings.billing.perMonth")}`;
  };

  return (
    /* THE ONE SURFACE THAT DID NOT CHANGE FACE.
       The product moved off IBM Plex Sans onto the Resend display stack in this
       release; the two billing cards stayed, by instruction. Why it is worth an
       exception: a price list that restyles itself in the same week its owner is
       deciding whether to pay reads as a page that was edited, and "was this
       number always this?" is not a question a checkout should raise. Scoped to
       the card, not the route — the settings chrome around it moved with the
       rest of the product. */
    <SettingsCard theme={t} mt id="plan" fontFamily={billingDisplay}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, flex: 1 }}>{tr("nav.billing")}</div>
        <Link
          href="/pricing"
          style={{ fontSize: 13, fontWeight: 650, color: t.link, textDecoration: "none" }}
        >
          {tr("raya.settings.billing.comparePlans")}
        </Link>
      </div>

      {/* Said once, at the top, and not repeated on every card: the state of the
          paywall is a property of the product right now, not of any one tier. */}
      <div
        style={{
          border: `1px solid ${t.inputBorder}`,
          background: t.inputBg,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.55,
          color: t.muted,
          marginBottom: 14,
        }}
      >
        <strong style={{ color: t.text }}>{tr("raya.settings.billing.notOpenNoticeBold")}</strong>{" "}
        {tr("raya.settings.billing.notOpenNoticeRest")}
      </div>

      {failed && !plans ? (
        <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
          {tr("raya.settings.billing.loadFailedA")}{" "}
          <Link href="/pricing" style={{ color: t.link, fontWeight: 650, textDecoration: "none" }}>
            {tr("raya.settings.billing.loadFailedLink")}
          </Link>{" "}
          {tr("raya.settings.billing.loadFailedB")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(free ? [free, ...paid] : paid).map((p) => {
            const current = p.price === 0;
            return (
              <div
                key={p.id}
                style={{
                  border: `1px solid ${current ? "#22c55e" : t.inputBorder}`,
                  borderRadius: 12,
                  padding: "13px 15px",
                  background: current ? t.rowActiveBg : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text, flex: 1 }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                    {fmtPrice(p)}
                  </span>
                </div>

                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                  {p.features.map((f, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        color: t.muted,
                        marginBottom: 3,
                        display: "flex",
                        gap: 7,
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: current ? "#22c55e" : t.mutedLight, flex: "none" }}>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    color: current ? "#22c55e" : t.mutedLight,
                  }}
                >
                  {current ? tr("raya.settings.billing.yourPlan") : tr("raya.settings.billing.notOpenYet")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}
