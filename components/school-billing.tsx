"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";
import { MIN_B2B_SEATS, termTotal, isAnnualTerm } from "@/lib/billing/terms";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { billingDisplay } from "@/components/ui/tokens";

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
  /** Pilot over, no plan running: no new students or classes (lib/billing.ts). */
  readOnly?: boolean;
  history: HistoryItem[];
  plans: Plan[];
};

const PAYMENT_METHODS: { id: string; labelKey: MessageKey }[] = [
  { id: "transfer", labelKey: "school.billing.method.transfer" },
  { id: "mobile_money", labelKey: "school.billing.method.mobileMoney" },
  { id: "invoice", labelKey: "school.billing.method.invoice" },
  { id: "card", labelKey: "school.billing.method.card" },
  { id: "other", labelKey: "school.billing.method.other" },
];

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtPrice = (p: Plan, tr: (key: MessageKey) => string) => {
  if (p.price == null) return tr("school.billing.onQuote");
  if (p.priceUnit === "per_seat") return `$${p.price} ${tr("school.billing.perStudentMoSuffix")}`;
  return p.price === 0 ? tr("school.billing.free") : `$${p.price}/${p.billingPeriod === "yearly" ? tr("school.billing.yr") : tr("school.billing.mo")}`;
};

export function SchoolBilling() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  const title = cardTitle(t);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    // Cached first: re-opening the Billing tab renders the last known seat
    // count and plan instantly, then reconciles once the refresh lands.
    const { data } = await getJsonCached<Billing>("/api/school/billing", {
      cacheKey: "school:billing",
      onUpdate: (fresh) => setBilling(fresh),
    });
    if (!data) {
      setError(tr("school.billing.loadFailed"));
      setLoading(false);
      return;
    }
    setBilling(data);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p style={{ color: t.muted, fontSize: 16 }}>{tr("school.billing.loadingBilling")}</p>;
  if (error) return <p style={{ color: "#f87171", fontSize: 16 }}>{error}</p>;
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
    /* HELD BACK ON THE OLD FACE — see components/raya/settings-billing-card.tsx
       for the reasoning. This is the B2B half of the same exception: the whole
       Billing tab, PlanCard included, keeps IBM Plex Sans while the rest of
       Schools moved to the Resend display stack. Declared once here rather than
       per card, so a plan card added next month inherits the exception instead
       of quietly breaking it. */
    <div style={{ fontFamily: billingDisplay }}>
      {billing.readOnly && (
        <div
          role="alert"
          style={{
            ...box,
            border: "1px solid rgba(239,68,68,0.45)",
            background: "rgba(239,68,68,0.08)",
            color: t.text,
            fontSize: 16,
            lineHeight: 1.55,
          }}
        >
          <strong>{tr("school.billing.readOnlyTitle")}</strong> {tr("school.billing.readOnlyBody")}
        </div>
      )}
      {/* Current plan + seat usage */}
      <div style={box}>
        <div style={{ ...title, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{tr("school.billing.currentPlan")}</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: statusColor,
              border: `1px solid ${statusColor}`,
              borderRadius: 99,
              padding: "2px 10px",
            }}
          >
            {billing.status === "none" ? tr("school.billing.noPlan") : billing.status}
          </span>
        </div>
        <div style={{ fontSize: 23, fontWeight: 700, color: t.text, marginBottom: 2 }}>
          {billing.planName ?? tr("school.billing.notSubscribed")}
        </div>
        <div style={{ fontSize: 15, color: t.muted }}>
          {onPilot
            ? `${tr("school.billing.pilotAccessA")} ${fmtDate(billing.pilotUntil)} ${tr("school.billing.pilotAccessB")}`
            : billing.expiresAt
              ? `${tr("school.billing.renewsExpires")} ${fmtDate(billing.expiresAt)}`
              : // No dated pilot and no subscription: resolveSeatGate's
                // "no_subscription" branch already leaves the school fully
                // ungated (unlimited seats, nothing to pay) — this is that
                // state, said plainly, not a "you must act now" nag.
                tr("school.billing.freePilotNoCap")}
        </div>

        {/* Seat meter */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: t.muted, marginBottom: 6 }}>
            <span>{tr("school.billing.seatsUsed")}</span>
            <span style={{ color: t.text, fontWeight: 600 }}>
              {seats.used}
              {seats.limit == null ? ` ${tr("school.billing.unlimitedSuffix")}` : ` / ${seats.limit}`}
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
            <p style={{ fontSize: 14, color: "#f87171", margin: "6px 0 0" }}>
              {tr("school.billing.seatLimitReached")}
            </p>
          )}
        </div>
      </div>

      {/* Plan catalog / activation */}
      <div style={box}>
        <div style={title}>{tr("school.billing.plansHeading")}</div>
        {/* The billing agreement, stated plainly (not tacit). */}
        <div
          style={{
            background: t.rowActiveBg,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 15,
            color: t.text,
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          <strong>{tr("school.billing.whatYouPayForLabel")}</strong> {tr("school.billing.whatYouPayForBody")}{" "}
          {billing.declaredEffectif != null ? (
            <strong>{billing.declaredEffectif} {tr("school.billing.seatsWord")}</strong>
          ) : (
            tr("school.billing.setNumberOfSeats")
          )}{" "}
          {tr("school.billing.whatYouPayForTail")}
        </div>
        <p style={{ fontSize: 15, color: t.muted, margin: "0 0 14px" }}>
          {tr("school.billing.recordPaymentIntro")}
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
        <div style={title}>{tr("school.billing.historyHeading")}</div>
        {billing.history.length === 0 ? (
          <p style={{ fontSize: 15, color: t.mutedLight, margin: 0 }}>
            {tr("school.billing.noSubscriptionsYet")}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ color: t.muted, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colPlan")}</th>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colStatus")}</th>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colAmount")}</th>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colMethod")}</th>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colReference")}</th>
                  <th style={{ padding: "6px 8px" }}>{tr("school.billing.colPeriod")}</th>
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
  const tr = useTranslate();
  const input = textInput(t);
  const btn = ctaButton(t);
  const isPerSeat = plan.priceUnit === "per_seat";
  // A bespoke/devis plan has no fixed price to record a payment against — the
  // "activate" form below asks for an amount that doesn't exist yet. Same rule
  // as the public /pricing page (components/site/pages/PricingView.tsx): quoted,
  // not self-serve, so this goes to the team instead of the payment form.
  const bespoke = plan.tier === "custom";

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
      setError(tr("school.billing.enterStudentsError"));
      return;
    }
    if (isPerSeat && seatCount < floorSeats) {
      setError(`${tr("school.billing.contractMinA")} ${floorSeats} ${tr("school.billing.contractMinB")} ${MIN_B2B_SEATS} ${tr("school.billing.contractMinC")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(
        "/api/school/billing",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            paymentMethod: method,
            paymentReference: reference || undefined,
            seatLimit: isPerSeat ? seatCount : undefined,
            months: monthCount,
          }),
        },
        { timeoutMs: 15_000 },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? tr("school.billing.activateFailed"));
      if (data.billing) onActivated(data.billing as Billing);
      invalidateCached("school:billing");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("school.billing.activateFailed"));
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
        <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{plan.name}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{fmtPrice(plan, tr)}</span>
      </div>
      <div style={{ fontSize: 14, color: t.muted, margin: "2px 0 8px" }}>
        {isPerSeat ? tr("school.billing.billedPerStudent") : `${plan.seatLimit ?? 1} ${tr("school.billing.seatSuffix")}`}
      </div>
      <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ fontSize: 14, color: t.muted, marginBottom: 4, display: "flex", gap: 6 }}>
            <span style={{ color: "#22c55e" }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", textAlign: "center" }}>{tr("school.billing.currentPlan")}</div>
      ) : bespoke ? (
        <Link href="/contact" style={{ ...btn, width: "100%", textAlign: "center", textDecoration: "none", display: "block", boxSizing: "border-box" }}>
          {tr("site.finalCta.ctaSecondary")}
        </Link>
      ) : !open ? (
        <button style={{ ...btn, width: "100%" }} onClick={() => setOpen(true)}>
          {tr("school.billing.activateButton")}
        </button>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {isPerSeat && (
            <>
              <input
                style={input}
                type="number"
                min={floorSeats || 1}
                placeholder={tr("school.billing.studentsPlaceholder")}
                value={students}
                onChange={(e) => setStudents(e.target.value)}
                disabled={busy}
              />
              <div style={{ fontSize: 14, color: t.muted, marginTop: -2 }}>
                {defaultSeats > 0
                  ? `${tr("school.billing.prefilledA")} (${defaultSeats}).` +
                    (floorSeats > 0 ? ` ${tr("school.billing.cantGoBelowA")} ${floorSeats} ${tr("school.billing.cantGoBelowB")}` : "")
                  : tr("school.billing.billForStudents")}
              </div>
            </>
          )}
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {tr(m.labelKey)}
              </option>
            ))}
          </select>
          <input
            style={input}
            placeholder={tr("school.billing.referencePlaceholder")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={busy}
          />
          <select style={input} value={months} onChange={(e) => setMonths(e.target.value)} disabled={busy}>
            <option value="12">{tr("school.billing.annual12")}</option>
            <option value="3">{tr("school.billing.quarterly3")}</option>
            <option value="1">{tr("school.billing.monthly1")}</option>
          </select>
          {estimated != null && (
            <div style={{ fontSize: 15, color: t.text }}>
              {tr("school.billing.totalForA")} {seatCount} {tr("school.billing.totalForB")} {monthCount} {tr("school.billing.totalForC")}{" "}
              <strong>${estimated.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              {annualSaving && (
                <span style={{ color: "#22c55e", fontWeight: 700 }}> · {tr("school.billing.annualDiscountApplied")}</span>
              )}
            </div>
          )}
          {error && <span style={{ color: "#f87171", fontSize: 14 }}>{error}</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btn, flex: 1, opacity: busy ? 0.7 : 1 }} onClick={activate} disabled={busy}>
              {busy ? tr("school.billing.activating") : tr("school.billing.confirmPayment")}
            </button>
            <button
              style={{ ...btn, background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}` }}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {tr("school.billing.cancel")}
            </button>
          </div>
          <div style={{ fontSize: 14, color: t.muted, textAlign: "center", marginTop: 2, lineHeight: 1.4 }}>
            {tr("school.billing.onlineCheckoutUnavailable")}
          </div>
        </div>
      )}
    </div>
  );
}
