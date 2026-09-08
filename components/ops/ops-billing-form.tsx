"use client";

import { useEffect, useState } from "react";
import { netFetch, getJsonCached } from "@/lib/net/client-fetch";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/** Mirrors the shape returned by GET /api/billing/plans (see lib/billing.ts). */
type Plan = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  priceUnit: "flat" | "per_seat";
};

const PAYMENT_METHODS: { id: string; labelKey: MessageKey }[] = [
  { id: "transfer", labelKey: "ops.billing.methodTransfer" },
  { id: "mobile_money", labelKey: "ops.billing.methodMobileMoney" },
  { id: "invoice", labelKey: "ops.billing.methodInvoice" },
  { id: "card", labelKey: "ops.billing.methodCard" },
  { id: "other", labelKey: "ops.billing.methodOther" },
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
  const tr = useTranslate();
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
    // The catalogue barely moves — cached generously.
    void getJsonCached<{ plans?: Plan[] }>(`/api/billing/plans?category=${category}`, {
      cacheKey: `billing:plans:${category}`,
      cacheTtlMs: 5 * 60_000,
      onUpdate: (fresh) => setPlans(fresh.plans ?? []),
    }).then(({ data }) => setPlans(data?.plans ?? []));
  }, [target]);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const isPerSeat = plan?.priceUnit === "per_seat";

  async function submit() {
    if (busy) return;
    setError(null);
    setResult(null);

    if (!planId) return setError(tr("ops.billing.pickPlan"));
    if (target === "user" && !email.trim()) return setError(tr("ops.billing.enterEmail"));
    if (target === "school" && !schoolId.trim()) return setError(tr("ops.billing.enterSchoolId"));
    if (isPerSeat && !(Number(seatLimit) > 0)) return setError(tr("ops.billing.enterSeatCount"));

    setBusy(true);
    try {
      const res = await netFetch(
        "/api/ops/billing/activate",
        {
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
        },
        { timeoutMs: 15_000 },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? tr("ops.billing.activateFailed"));
      setResult({ subscriptionId: data.subscriptionId, expiresAt: data.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("ops.billing.activateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" style={toggle(target === "user")} onClick={() => setTarget("user")}>
          {tr("ops.billing.individualToggle")}
        </button>
        <button type="button" style={toggle(target === "school")} onClick={() => setTarget("school")}>
          {tr("ops.billing.schoolToggle")}
        </button>
      </div>

      {target === "user" ? (
        <>
          <label style={label}>{tr("ops.billing.userEmailLabel")}</label>
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
          <label style={label}>{tr("ops.billing.schoolIdLabel")}</label>
          <input
            style={input}
            placeholder={tr("ops.billing.schoolIdPlaceholder")}
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      <label style={label}>{tr("ops.billing.planLabel")}</label>
      <select style={input} value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={busy}>
        <option value="">{tr("ops.billing.selectPlanPlaceholder")}</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.price == null ? tr("ops.billing.onQuote") : p.priceUnit === "per_seat" ? `($${p.price}/student/mo)` : `($${p.price})`}
          </option>
        ))}
      </select>

      {isPerSeat && (
        <>
          <label style={label}>{tr("ops.billing.seatsLabel")}</label>
          <input
            style={input}
            type="number"
            min={1}
            placeholder={tr("ops.billing.seatsPlaceholder")}
            value={seatLimit}
            onChange={(e) => setSeatLimit(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      <label style={label}>{tr("ops.billing.termLabel")}</label>
      <input style={input} type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} disabled={busy} />

      <label style={label}>{tr("ops.billing.amountLabel")}</label>
      <input style={input} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />

      <label style={label}>{tr("ops.billing.methodLabel")}</label>
      <select style={input} value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m.id} value={m.id}>
            {tr(m.labelKey)}
          </option>
        ))}
      </select>

      <label style={label}>{tr("ops.billing.referenceLabel")}</label>
      <input style={input} value={reference} onChange={(e) => setReference(e.target.value)} disabled={busy} />

      {error && <p style={{ color: "#f87171", fontSize: 14, margin: "0 0 14px" }}>{error}</p>}
      {result && (
        <p style={{ color: "#4ade80", fontSize: 14, margin: "0 0 14px" }}>
          {tr("ops.billing.activatedA")}
          {result.subscriptionId}
          {tr("ops.billing.activatedB")} {new Date(result.expiresAt).toLocaleDateString()}.
        </p>
      )}

      <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
        {busy ? tr("ops.billing.activating") : tr("ops.billing.activateButton")}
      </button>
    </div>
  );
}
