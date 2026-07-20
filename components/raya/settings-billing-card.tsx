"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";

type B2cPlan = {
  id: string;
  name: string;
  price: number | null;
  billingPeriod: string | null;
  features: string[];
};

/**
 * Settings "Billing" card — the third stacked card in the RAYA student Settings
 * screen. Now backed by the real plan catalog: it loads the active b2c plans and
 * shows the student's current (free) plan with its real name + features, plus any
 * paid upgrade. Students have no charge today, so payment/history stay empty until
 * a paid b2c tier or Stripe lands. Degrades to the static free copy if the fetch
 * fails.
 */
export function StudentBillingCard() {
  const { theme: t } = useAppTheme();
  const [plans, setPlans] = useState<B2cPlan[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/billing/plans?category=b2c");
        const data = await res.json();
        if (Array.isArray(data.plans)) setPlans(data.plans as B2cPlan[]);
      } catch {
        // best-effort — fall back to the static free copy below
      }
    })();
  }, []);

  const free = plans?.find((p) => p.price === 0) ?? null;
  const paid = plans?.find((p) => (p.price ?? 0) > 0) ?? null;
  const planName = free?.name ?? "Student plan — Free";
  const subtitle = free?.features[0] ?? "Unlimited solo RAYA sessions";

  return (
    <SettingsCard theme={t} mt>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 16, color: t.text }}>Billing</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: t.rowActiveBg,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{planName}</div>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{subtitle}</div>
        </div>
        {paid && (
          <span
            style={{
              fontSize: 11,
              background: t.ctaBg,
              color: t.ctaText,
              borderRadius: 99,
              padding: "8px 14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            title={`${paid.name} — $${paid.price}/${paid.billingPeriod === "yearly" ? "yr" : "mo"}`}
          >
            Upgrade to {paid.name}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>Payment method</div>
      <div
        style={{
          border: `1px solid ${t.inputBorder}`,
          background: t.inputBg,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12.5,
          color: t.text,
          marginBottom: 14,
        }}
      >
        No payment method on file
      </div>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>History</div>
      <div style={{ fontSize: 11.5, color: t.mutedLight }}>
        No invoices — the free plan doesn&apos;t generate billing.
      </div>
    </SettingsCard>
  );
}
