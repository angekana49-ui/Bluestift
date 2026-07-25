"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";
import { MIN_B2B_SEATS, termTotal, isAnnualTerm } from "@/lib/billing/terms";

/** Mirror of the billing JSON returned by /api/school/billing (see lib/billing.ts). */
type Plan = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tier: string | null;
  price: number | null;
  priceUnit: "flat" | "per_seat";
  billingPeriod: string | null;
  features: string[];
  seatLimit: number | null;
  storageGb: number | null;
};
type HistoryItem = {
  id: string;
  planName: string | null;
  status: string;
  amount: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  startDate: string;
  endDate: string | null;
};
type Billing = {
  planId: string | null;
  planName: string | null;
  status: string;
  seats: { limit: number | null; used: number; remaining: number | null };
  declaredEffectif: number | null;
  pilotUntil: string | null;
  expiresAt: string | null;
  history: HistoryItem[];
  plans: Plan[];
};

const PAYMENT_METHODS = [
  { id: "transfer", label: "Bank transfer" },
  { id: "mobile_money", label: "Mobile money" },
  { id: "invoice", label: "Invoice" },
  { id: "card", label: "Card (manual)" },
  { id: "other", label: "Other" },
];

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtPrice = (p: Plan) => {
  if (p.price == null) return "On quote";
  if (p.priceUnit === "per_seat") return `$${p.price} / student / mo`;
  return p.price === 0 ? "Free" : `$${p.price}/${p.billingPeriod === "yearly" ? "yr" : "mo"}`;
};

export function SchoolBilling() {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const title = cardTitle(t);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/school/billing");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not load billing.");
      setBilling(data as Billing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p style={{ color: t.muted, fontSize: 12.5 }}>Loading billing…</p>;
  if (error) return <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>;
  if (!billing) return null;

  const { seats } = billing;
  const pct =
    seats.limit && seats.limit > 0 ? Math.min(100, Math.round((seats.used / seats.limit) * 100)) : 0;
  const seatColor = pct >= 100 ? "#ef4444" : pct >= 85 ? "#f59e0b" : "#22c55e";
  const onPilot = billing.pilotUntil && billing.pilotUntil >= new Date().toISOString().slice(0, 10);

  const statusColor =
    billing.status === "active"
      ? "#22c55e"
      : billing.status === "trial"
        ? "#f59e0b"
        : billing.status === "none"
          ? "#6b7794"
          : "#ef4444";

  return (
    <div>
      {/* Current plan + seat usage */}
      <div style={box}>
        <div style={{ ...title, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Current plan</span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: statusColor,
              border: `1px solid ${statusColor}`,
              borderRadius: 99,
              padding: "2px 10px",
            }}
          >
            {billing.status === "none" ? "No plan" : billing.status}
          </span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
          {billing.planName ?? "Not subscribed"}
        </div>
        <div style={{ fontSize: 11.5, color: t.muted }}>
          {onPilot
            ? `Pilot access until ${fmtDate(billing.pilotUntil)} — seats unlimited during the pilot.`
            : billing.expiresAt
              ? `Renews / expires ${fmtDate(billing.expiresAt)}`
              : "Activate a plan below to enable school-wide seats."}
        </div>

        {/* Seat meter */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.muted, marginBottom: 6 }}>
            <span>Seats used</span>
            <span style={{ color: t.text, fontWeight: 600 }}>
              {seats.used}
              {seats.limit == null ? " / unlimited" : ` / ${seats.limit}`}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: t.inputBg, overflow: "hidden" }}>
            <div
              style={{
                width: seats.limit == null ? "12%" : `${pct}%`,
                height: "100%",
                background: seats.limit == null ? t.muted : seatColor,
                borderRadius: 99,
                transition: "width .3s",
              }}
            />
          </div>
          {seats.limit != null && seats.remaining === 0 && (
            <p style={{ fontSize: 11, color: "#f87171", margin: "6px 0 0" }}>
              Seat limit reached — new students can&apos;t join until you add seats or upgrade.
            </p>
          )}
        </div>
      </div>

      {/* Plan catalog / activation */}
      <div style={box}>
        <div style={title}>Plans</div>
        {/* The billing agreement, stated plainly (not tacit). */}
        <div
          style={{
            background: t.rowActiveBg,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 11.5,
            color: t.text,
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          <strong>How billing works:</strong> you pay per <em>enrolled</em> student — your
          effectif — <strong>not</strong> per active user. A school of{" "}
          {billing.declaredEffectif ?? "N"} students pays for {billing.declaredEffectif ?? "N"},
          whether 250 or all of them use Raya this month. The contracted number caps how many
          students can join.
        </div>
        <p style={{ fontSize: 11.5, color: t.muted, margin: "0 0 14px" }}>
          Record a payment received out-of-band (transfer, invoice) to activate your plan. Prices
          below are the USD reference. Online self-serve checkout is temporarily unavailable while
          we finalize our payment integration.
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {billing.plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              current={p.id === billing.planId && billing.status === "active"}
              defaultSeats={Math.max(MIN_B2B_SEATS, billing.seats.used, billing.declaredEffectif ?? 0)}
              floorSeats={Math.max(MIN_B2B_SEATS, billing.seats.used)}
              onActivated={setBilling}
            />
          ))}
        </div>
      </div>

      {/* History */}
      <div style={box}>
        <div style={title}>Billing history</div>
        {billing.history.length === 0 ? (
          <p style={{ fontSize: 11.5, color: t.mutedLight, margin: 0 }}>
            No subscriptions yet — activating a plan records an entry here.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: t.muted, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>Plan</th>
                  <th style={{ padding: "6px 8px" }}>Status</th>
                  <th style={{ padding: "6px 8px" }}>Amount</th>
                  <th style={{ padding: "6px 8px" }}>Method</th>
                  <th style={{ padding: "6px 8px" }}>Reference</th>
                  <th style={{ padding: "6px 8px" }}>Period</th>
                </tr>
              </thead>
              <tbody>
                {billing.history.map((h) => (
                  <tr key={h.id} style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.text }}>
                    <td style={{ padding: "8px" }}>{h.planName ?? "—"}</td>
                    <td style={{ padding: "8px" }}>{h.status}</td>
                    <td style={{ padding: "8px" }}>{h.amount == null ? "—" : `$${h.amount}`}</td>
                    <td style={{ padding: "8px" }}>{h.paymentMethod ?? "—"}</td>
                    <td style={{ padding: "8px", color: t.muted }}>{h.paymentReference ?? "—"}</td>
                    <td style={{ padding: "8px", color: t.muted }}>
                      {fmtDate(h.startDate)} → {fmtDate(h.endDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  defaultSeats,
  floorSeats,
  onActivated,
}: {
  plan: Plan;
  current: boolean;
  defaultSeats: number; // suggested contract = declared effectif (≥ headcount)
  floorSeats: number; // hard floor = real enrolled headcount, can't contract below
  onActivated: (b: Billing) => void;
}) {
  const { theme: t } = useAppTheme();
  const input = textInput(t);
  const btn = ctaButton(t);
  const isPerSeat = plan.priceUnit === "per_seat";

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("transfer");
  const [reference, setReference] = useState("");
  // Prefill the contracted headcount with the real current one (can't go below it).
  const [students, setStudents] = useState(defaultSeats > 0 ? String(defaultSeats) : "");
  const [months, setMonths] = useState("12");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-student plans: rate × students × months, less the 15% annual discount for
  // 12-month terms. The server recomputes and stores the authoritative amount —
  // this is just the admin-facing estimate.
  const seatCount = Number(students);
  const monthCount = Number(months) || 12;
  const estimated =
    isPerSeat && plan.price != null && seatCount > 0
      ? termTotal(plan.price * seatCount * monthCount, monthCount)
      : null;
  const annualSaving = estimated != null && isAnnualTerm(monthCount);

  async function activate() {
    if (busy) return;
    if (isPerSeat && !(seatCount > 0)) {
      setError("Enter the number of students on the contract.");
      return;
    }
    if (isPerSeat && seatCount < floorSeats) {
      setError(`Contract at least ${floorSeats} seats (minimum ${MIN_B2B_SEATS} students, or your current headcount).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          paymentMethod: method,
          paymentReference: reference || undefined,
          seatLimit: isPerSeat ? seatCount : undefined,
          months: monthCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not activate.");
      if (data.billing) onActivated(data.billing as Billing);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${current ? "#22c55e" : t.cardBorder}`,
        borderRadius: 14,
        padding: 14,
        background: t.cardBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{plan.name}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{fmtPrice(plan)}</span>
      </div>
      <div style={{ fontSize: 11, color: t.muted, margin: "2px 0 8px" }}>
        {isPerSeat ? "Billed per student — set the contracted headcount" : `${plan.seatLimit ?? 1} seat`}
      </div>
      <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ fontSize: 11, color: t.muted, marginBottom: 4, display: "flex", gap: 6 }}>
            <span style={{ color: "#22c55e" }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textAlign: "center" }}>Current plan</div>
      ) : !open ? (
        <button style={{ ...btn, width: "100%" }} onClick={() => setOpen(true)}>
          Activate
        </button>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {isPerSeat && (
            <>
              <input
                style={input}
                type="number"
                min={floorSeats || 1}
                placeholder="Number of students (contracted)"
                value={students}
                onChange={(e) => setStudents(e.target.value)}
                disabled={busy}
              />
              <div style={{ fontSize: 10.5, color: t.muted, marginTop: -2 }}>
                {defaultSeats > 0
                  ? `Prefilled from your declared effectif (${defaultSeats}).` +
                    (floorSeats > 0 ? ` Can't go below ${floorSeats} already enrolled.` : "")
                  : "Bill for the students you'll enroll — this also caps new joins."}
              </div>
            </>
          )}
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            style={input}
            placeholder="Payment reference (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={busy}
          />
          <select style={input} value={months} onChange={(e) => setMonths(e.target.value)} disabled={busy}>
            <option value="12">Annual — 12 months (recommended)</option>
            <option value="3">Quarterly — 3 months</option>
            <option value="1">Monthly — 1 month</option>
          </select>
          {estimated != null && (
            <div style={{ fontSize: 11.5, color: t.text }}>
              Total for {seatCount} students × {monthCount} mo:{" "}
              <strong>${estimated.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              {annualSaving && (
                <span style={{ color: "#22c55e", fontWeight: 700 }}> · 15% annual discount applied</span>
              )}
            </div>
          )}
          {error && <span style={{ color: "#f87171", fontSize: 11 }}>{error}</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btn, flex: 1, opacity: busy ? 0.7 : 1 }} onClick={activate} disabled={busy}>
              {busy ? "Activating…" : "Confirm payment"}
            </button>
            <button
              style={{ ...btn, background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}` }}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: t.muted, textAlign: "center", marginTop: 2, lineHeight: 1.4 }}>
            Online checkout (card · mobile money · PayPal) is temporarily unavailable while we
            finalize our payment integration — record your payment above and we&apos;ll activate it.
          </div>
        </div>
      )}
    </div>
  );
}
