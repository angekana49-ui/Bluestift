"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Sandbox hosted-checkout stand-in. Stands in for the aggregator's payment page
 * when no real credentials are configured (BILLING_PROVIDER=sandbox): approve or
 * decline, which POSTs the simulated notification to our own webhook, then bounces
 * to the return page — exercising the full pending→paid→activate loop with no keys.
 */
function SandboxInner() {
  const params = useSearchParams();
  const pid = params.get("pid") ?? "";
  const channel = params.get("channel") ?? "card";
  const [busy, setBusy] = useState(false);

  async function settle(status: "paid" | "failed") {
    if (!pid) return;
    setBusy(true);
    try {
      await fetch("/api/billing/webhook/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: pid, status, channel }),
      });
    } catch {
      // ignore — the return page reads the real status regardless
    }
    window.location.href = `/checkout/return?pid=${encodeURIComponent(pid)}`;
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "#0b1220",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20, padding: 28, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#b45309",
            background: "#fef3c7",
            borderRadius: 999,
            padding: "4px 12px",
            textTransform: "uppercase",
          }}
        >
          Sandbox
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0b1220", margin: "16px 0 6px" }}>Simulated checkout</h1>
        <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: "0 0 22px" }}>
          No real payment provider is configured. Approve or decline to test the flow end to end (method:{" "}
          <strong>{channel}</strong>).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => settle("paid")}
            disabled={busy || !pid}
            style={{
              background: "#0b1220",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "13px",
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Processing…" : "Approve payment"}
          </button>
          <button
            onClick={() => settle("failed")}
            disabled={busy || !pid}
            style={{
              background: "#fff",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "13px",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SandboxCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <SandboxInner />
    </Suspense>
  );
}
