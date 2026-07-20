"use client";

import { useState } from "react";

type Channel = "card" | "mobile_money" | "paypal";

const METHOD: Record<Channel, { label: string; sub: string; emoji: string }> = {
  card: { label: "Card / Virtual card", sub: "Visa · Mastercard", emoji: "💳" },
  mobile_money: { label: "Mobile Money", sub: "MTN · Orange · Moov · Wave", emoji: "📱" },
  paypal: { label: "PayPal", sub: "Pay with your PayPal balance", emoji: "🅿️" },
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
        setError(data.error ?? "Could not start checkout.");
        setBusy(null);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Network error — please try again.");
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
            <span style={{ fontSize: 22, width: 26, textAlign: "center" }}>{m.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#0b1220" }}>{m.label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "#64748b", marginTop: 1 }}>{m.sub}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: loading ? "#64748b" : "#2563eb" }}>
              {loading ? "Redirecting…" : "Pay →"}
            </span>
          </button>
        );
      })}

      {error && (
        <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 2px 0", lineHeight: 1.5 }}>{error}</p>
      )}
    </div>
  );
}
