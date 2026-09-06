"use client";

import { useState } from "react";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type Channel = "card" | "mobile_money" | "paypal";

const METHOD: Record<Channel, { labelKey: MessageKey; subKey: MessageKey; emoji: string }> = {
  card: { labelKey: "checkout.method.card", subKey: "checkout.method.card.sub", emoji: "💳" },
  mobile_money: { labelKey: "checkout.method.mobileMoney", subKey: "checkout.method.mobileMoney.sub", emoji: "📱" },
  paypal: { labelKey: "checkout.method.paypal", subKey: "checkout.method.paypal.sub", emoji: "🅿️" },
};

/**
 * The 3-paywall picker. Posts the chosen method to /api/billing/checkout, which
 * resolves the price server-side and returns a hosted-checkout URL to redirect to.
 * Only the channels the active provider supports are shown.
 */
export function CheckoutPanel({
  planId,
  audience,
  channels,
  months,
  seats,
  guardianRequired = false,
}: {
  planId: string;
  audience: "b2c" | "b2b";
  channels: Channel[];
  months: number;
  seats?: number | null;
  /**
   * The account belongs to a minor. Only an adult pays, so the methods stay
   * disabled until the payer states they are the parent or guardian; the
   * statement is sent with the request and stored on the payment.
   */
  guardianRequired?: boolean;
}) {
  const tr = useTranslate();
  const [busy, setBusy] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardian, setGuardian] = useState(false);
  const locked = guardianRequired && !guardian;

  async function pay(channel: Channel) {
    if (locked) return;
    setBusy(channel);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          channel,
          audience,
          months,
          seats: seats ?? undefined,
          ...(guardianRequired ? { guardian: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? tr("checkout.err.startFailed"));
        setBusy(null);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError(tr("checkout.err.network"));
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {guardianRequired && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${guardian ? "#2563eb" : "#e3e8f0"}`,
            background: "#f6f8fc",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1.5,
            color: "#0b1220",
          }}
        >
          <input
            type="checkbox"
            checked={guardian}
            onChange={(e) => setGuardian(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, flex: "none" }}
          />
          <span>
            <strong style={{ display: "block", fontWeight: 700 }}>{tr("checkout.guardian.title")}</strong>
            <span style={{ color: "#475569" }}>{tr("checkout.guardian.body")}</span>
          </span>
        </label>
      )}

      {channels.map((c) => {
        const m = METHOD[c];
        const loading = busy === c;
        return (
          <button
            key={c}
            onClick={() => pay(c)}
            disabled={busy != null || locked}
            aria-disabled={locked || undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #e3e8f0",
              background: loading ? "#f1f5fb" : "#fff",
              cursor: busy != null || locked ? "default" : "pointer",
              opacity: (busy != null && !loading) || locked ? 0.55 : 1,
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: 25, width: 26, textAlign: "center" }}>{m.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#0b1220" }}>{tr(m.labelKey)}</span>
              <span style={{ display: "block", fontSize: 14, color: "#64748b", marginTop: 1 }}>{tr(m.subKey)}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: loading ? "#64748b" : "#2563eb" }}>
              {loading ? tr("checkout.redirecting") : tr("checkout.payArrow")}
            </span>
          </button>
        );
      })}

      {error && (
        <p style={{ fontSize: 14, color: "#dc2626", margin: "4px 2px 0", lineHeight: 1.5 }}>{error}</p>
      )}
    </div>
  );
}
