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
}: {
  planId: string;
  audience: "b2c" | "b2b";
  channels: Channel[];
  months: number;
  seats?: number | null;
}) {
  const tr = useTranslate();
  const [busy, setBusy] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(channel: Channel) {
    setBusy(channel);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, channel, audience, months, seats: seats ?? undefined }),
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
      {channels.map((c) => {
        const m = METHOD[c];
        const loading = busy === c;
        return (
          <button
            key={c}
            onClick={() => pay(c)}
            disabled={busy != null}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #e3e8f0",
              background: loading ? "#f1f5fb" : "#fff",
              cursor: busy != null ? "default" : "pointer",
              opacity: busy != null && !loading ? 0.55 : 1,
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
