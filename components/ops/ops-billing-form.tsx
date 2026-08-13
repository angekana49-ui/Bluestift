"use client";

import { useEffect, useState } from "react";

/** Mirrors the shape returned by GET /api/billing/plans (see lib/billing.ts). */
type Plan = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  priceUnit: "flat" | "per_seat";
};

const PAYMENT_METHODS = [
  { id: "transfer", label: "Bank transfer" },
  { id: "mobile_money", label: "Mobile money" },
  { id: "invoice", label: "Invoice" },
  { id: "card", label: "Card (manual)" },
  { id: "other", label: "Other" },
];

const box: React.CSSProperties = {
  border: "1px solid #2a3142",
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
  background: "#151a24",
};
const label: React.CSSProperties = { fontSize: 13, color: "#9aa4b8", margin: "0 0 6px", display: "block" };
const input: React.CSSProperties = {
  background: "#0e1219",
  color: "#eef1f7",
  border: "1px solid #2a3142",
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%",
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 14,
};
const btn: React.CSSProperties = {
  background: "#4f7cff",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};
const toggle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "9px 0",
  textAlign: "center",
  borderRadius: 10,
  border: `1px solid ${active ? "#4f7cff" : "#2a3142"}`,
  background: active ? "#1d2947" : "transparent",
  color: active ? "#cdd8ff" : "#9aa4b8",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});

export function OpsBillingForm() {
  const [target, setTarget] = useState<"user" | "school">("user");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [seatLimit, setSeatLimit] = useState("");
  const [months, setMonths] = useState("12");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subscriptionId: string; expiresAt: string } | null>(null);

  useEffect(() => {
    setPlanId("");
    setPlans([]);
    const category = target === "user" ? "b2c" : "b2b";
    fetch(`/api/billing/plans?category=${category}`)
      .then((r) => r.json())
      .then((d) => setPlans((d?.plans as Plan[] | undefined) ?? []))
      .catch(() => setPlans([]));
  }, [target]);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const isPerSeat = plan?.priceUnit === "per_seat";

  async function submit() {
    if (busy) return;
    setError(null);
    setResult(null);

    if (!planId) return setError("Pick a plan.");
    if (target === "user" && !email.trim()) return setError("Enter the user's email.");
    if (target === "school" && !schoolId.trim()) return setError("Enter the school id.");
    if (isPerSeat && !(Number(seatLimit) > 0)) return setError("Enter the contracted seat count.");

    setBusy(true);
    try {
      const res = await fetch("/api/ops/billing/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          email: target === "user" ? email.trim() : undefined,
          schoolId: target === "school" ? schoolId.trim() : undefined,
          planId,
          seatLimit: isPerSeat ? Number(seatLimit) : undefined,
          months: Number(months) || 12,
          amount: amount.trim() ? Number(amount) : undefined,
          paymentMethod: method,
          paymentReference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not activate.");
      setResult({ subscriptionId: data.subscriptionId, expiresAt: data.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" style={toggle(target === "user")} onClick={() => setTarget("user")}>
          Individual (B2C)
        </button>
        <button type="button" style={toggle(target === "school")} onClick={() => setTarget("school")}>
          School (B2B)
        </button>
      </div>

      {target === "user" ? (
        <>
          <label style={label}>User email</label>
          <input
            style={input}
            type="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </>
      ) : (
        <>
          <label style={label}>School id</label>
          <input
            style={input}
            placeholder="uuid — found in Supabase (schools.schools)"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      <label style={label}>Plan</label>
      <select style={input} value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy}>
        <option value="">Select a plan…</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.price == null ? "(on quote)" : p.priceUnit === "per_seat" ? `($${p.price}/student/mo)` : `($${p.price})`}
          </option>
        ))}
      </select>

      {isPerSeat && (
        <>
          <label style={label}>Contracted seats (students)</label>
          <input
            style={input}
            type="number"
            min={1}
            placeholder="e.g. 250"
            value={seatLimit}
            onChange={(e) => setSeatLimit(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      <label style={label}>Term (months)</label>
      <input style={input} type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} disabled={busy} />

      <label style={label}>Amount collected — optional, USD (leave blank to auto-compute)</label>
      <input style={input} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />

      <label style={label}>Payment method</label>
      <select style={input} value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <label style={label}>Reference — optional (transfer id, invoice #…)</label>
      <input style={input} value={reference} onChange={(e) => setReference(e.target.value)} disabled={busy} />

      {error && <p style={{ color: "#f87171", fontSize: 14, margin: "0 0 14px" }}>{error}</p>}
      {result && (
        <p style={{ color: "#4ade80", fontSize: 14, margin: "0 0 14px" }}>
          Activated — subscription {result.subscriptionId}, expires{" "}
          {new Date(result.expiresAt).toLocaleDateString()}.
        </p>
      )}

      <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
        {busy ? "Activating…" : "Activate plan"}
      </button>
    </div>
  );
}
