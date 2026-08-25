import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { resolvePlanPriceForRequest } from "@/lib/billing";
import { ipCountryFromHeaders, formatMoney } from "@/lib/billing/regions";
import { getPaymentProvider, sandboxBlockedInProd, type PaymentChannel } from "@/lib/billing/payments";
import { isAnnualTerm, termTotal } from "@/lib/billing/terms";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";

export const metadata = { title: "BlueStift · Checkout" };

function clampInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  background: "#f6f8fc",
};
const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  background: "#fff",
  border: "1px solid #e6ebf3",
  borderRadius: 22,
  padding: 28,
  boxShadow: "0 24px 60px rgba(15,23,42,0.10)",
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; audience?: string; months?: string; seats?: string }>;
}) {
  const { plan: planParam, audience: audParam, months: monthsParam, seats: seatsParam } = await searchParams;
  const audience = audParam === "b2b" ? "b2b" : "b2c";
  const planId = (planParam ?? "").trim();
  if (!planId) redirect("/pricing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load the plan for the summary (authoritative price is re-resolved server-side
  // on submit — this is display only).
  const schools = createSchoolsAdminClient();
  const { data: pData } = await schools
    .from("subscription_plans")
    .select("id, name, price, price_unit, billing_period, category")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  const plan = pData as {
    id: string;
    name: string;
    price: number | null;
    price_unit: string | null;
    billing_period: string | null;
    category: string | null;
  } | null;
  if (!plan || plan.price == null || Number(plan.price) <= 0) redirect("/pricing");

  // Region-adapted price — mirrors the checkout charge (IP + declared country).
  const ipCountry = ipCountryFromHeaders(await headers());
  let declaredCountry: string | null = null;
  if (audience === "b2b" && user) {
    const membership = await getAdminMembership(user.id);
    if (membership) {
      const { data: sc } = await schools.from("schools").select("country_code").eq("id", membership.schoolId).maybeSingle();
      declaredCountry = (sc as { country_code: string | null } | null)?.country_code ?? null;
    }
  }
  const resolved = await resolvePlanPriceForRequest(plan!.id, declaredCountry, ipCountry);
  if (!resolved || resolved.price == null || resolved.price <= 0) redirect("/pricing");

  const rate = resolved.price;
  const currency = resolved.currency;
  const perSeat = resolved.priceUnit === "per_seat";
  const months = clampInt(monthsParam) ?? (audience === "b2b" ? 12 : 1);
  const seats = perSeat ? clampInt(seatsParam) : null;

  // Must mirror app/api/billing/checkout/route.ts exactly. It charges
  // termTotal(base, months) — so computing the summary as a plain base would
  // quote a total ABOVE what actually gets debited on any annual term, and
  // silently retract the "save 15%" the pricing page just promised.
  const base = perSeat ? (seats ? rate * seats * months : null) : rate * months;
  const total = base == null ? null : termTotal(base, months);
  const annual = isAnnualTerm(months);
  const saved = base != null && annual ? base - total! : 0;

  const provider = getPaymentProvider();
  const channels = [...provider.supportedChannels] as PaymentChannel[];
  /**
   * The same condition /api/billing/checkout refuses on, asked here instead.
   *
   * The API already returned a clean 503 for this, but only after the visitor
   * had signed in, chosen a channel and pressed pay — so the one page in the
   * funnel that knew payments were off was the last one they reached. This is
   * the honest place for it: the order summary still renders, because what they
   * came to see is what it would cost, and that part is true either way.
   */
  const paymentsOff = provider.id === "sandbox" && sandboxBlockedInProd();

  return (
    <main style={shell}>
      <div style={card}>
        <Link href="/pricing" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
          ← Plans
        </Link>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#0b1220", margin: "14px 0 4px" }}>
          Checkout
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>{plan!.name}</p>

        {/* Order summary */}
        <div style={{ background: "#f6f8fc", border: "1px solid #eef2f8", borderRadius: 14, padding: "14px 16px", margin: "18px 0 20px" }}>
          <Row label="Plan" value={plan!.name} />
          {perSeat && <Row label="Seats" value={seats ? String(seats) : "—"} />}
          <Row label="Term" value={annual ? `${months} months · annual` : `${months} month${months > 1 ? "s" : ""}`} />
          {saved > 0 && (
            <Row label="Annual discount" value={`−${formatMoney(saved, currency)}`} />
          )}
          <div style={{ height: 1, background: "#e6ebf3", margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0b1220" }}>Total</span>
            <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0b1220", letterSpacing: "-0.02em" }}>
              {total != null ? formatMoney(total, currency) : "—"}
            </span>
          </div>
        </div>

        {/* Checked before the sign-in prompt on purpose: sending someone to
            create an account for a purchase that cannot complete is worse than
            no checkout at all. */}
        {paymentsOff ? (
          <div
            style={{
              border: "1px solid #e6ebf3",
              background: "#f6f8fc",
              borderRadius: 14,
              padding: "16px 18px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0b1220", margin: "0 0 6px" }}>
              Online payment isn&apos;t open yet.
            </p>
            <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
              The price above is the real one. We&apos;re finishing the payment channel — until it&apos;s live,
              schools are activated by hand and it takes a day.
            </p>
            <Link
              href="/contact"
              style={{
                display: "inline-block",
                background: "#0b1220",
                color: "#fff",
                borderRadius: 999,
                padding: "11px 26px",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Talk to us
            </Link>
          </div>
        ) : !user ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.6, margin: "0 0 14px" }}>
              Sign in to complete your purchase.
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                background: "#0b1220",
                color: "#fff",
                borderRadius: 999,
                padding: "11px 26px",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>
        ) : perSeat && !seats ? (
          <p style={{ fontSize: 15, color: "#dc2626", lineHeight: 1.6, textAlign: "center" }}>
            No seat count set. Start this checkout from your school&apos;s Billing tab so the number of students is included.
          </p>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>
              Choose how to pay
            </div>
            <CheckoutPanel planId={plan!.id} audience={audience} channels={channels} months={months} seats={seats} />
          </>
        )}

        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
          Payments are processed by our provider. You&apos;ll be redirected to a secure checkout.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "3px 0" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#0b1220", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
