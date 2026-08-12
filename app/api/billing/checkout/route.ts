import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { resolveSeatGate, resolvePlanPriceForRequest } from "@/lib/billing";
import { ipCountryFromHeaders } from "@/lib/billing/regions";
import { getPaymentProvider, sandboxBlockedInProd, type PaymentChannel } from "@/lib/billing/payments";
import { createPayment, setPaymentProviderRef } from "@/lib/billing/payments-data";
import { MIN_B2B_SEATS, termTotal } from "@/lib/billing/terms";
import { siteUrl } from "@/lib/email";

/**
 * Start a self-serve online checkout (card / mobile money / PayPal via the active
 * aggregator). Amounts are resolved server-side from the plan — the client never
 * dictates price. Creates a pending payment, opens the hosted checkout, and
 * returns its redirect URL; the aggregator webhook later activates the plan.
 *
 *  B2C: any signed-in user pays for themselves (userId).
 *  B2B: the school admin_master pays for the school; `seats` is required and
 *       floored at the school's real headcount (never contract below what's used).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { planId?: string; channel?: string; audience?: string; months?: number; seats?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) return NextResponse.json({ error: "A plan is required." }, { status: 400 });

  const audience = body.audience === "b2b" ? "b2b" : "b2c";
  const channel = body.channel as PaymentChannel | undefined;

  const provider = getPaymentProvider();
  if (provider.id === "sandbox" && sandboxBlockedInProd()) {
    return NextResponse.json({ error: "Online payments aren't configured yet." }, { status: 503 });
  }
  if (!channel || !provider.supportedChannels.includes(channel)) {
    return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
  }

  // Load the plan (must be active and match the audience's category).
  const schools = createSchoolsAdminClient();
  const { data: pData } = await schools
    .from("subscription_plans")
    .select("id, name, category, price, price_unit, billing_period")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  const plan = pData as {
    id: string;
    name: string;
    category: string | null;
    price: number | null;
    price_unit: string | null;
    billing_period: string | null;
  } | null;
  if (!plan) return NextResponse.json({ error: "Unknown or inactive plan." }, { status: 400 });
  if (plan.category && plan.category !== audience) {
    return NextResponse.json({ error: "Plan does not match the selected audience." }, { status: 400 });
  }

  // Region-adapted price: the double-layer (declared country + IP) picks the zone,
  // the price-book picks the amount. B2B declares its country via the school; B2C
  // has none yet (→ USD fallback). Charge and display share this same resolver.
  const ipCountry = ipCountryFromHeaders(request.headers);

  const clampInt = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;

  let userId: string | null = null;
  let schoolId: string | null = null;
  let declaredCountry: string | null = null;

  if (audience === "b2b") {
    const membership = await getAdminMembership(user.id);
    if (!membership || membership.role !== "admin_master") {
      return NextResponse.json({ error: "Only the school admin can pay for the school." }, { status: 403 });
    }
    schoolId = membership.schoolId;
    const { data: sc } = await schools.from("schools").select("country_code").eq("id", schoolId).maybeSingle();
    declaredCountry = (sc as { country_code: string | null } | null)?.country_code ?? null;
  } else {
    userId = user.id;
  }

  const resolved = await resolvePlanPriceForRequest(planId, declaredCountry, ipCountry);
  const rate = resolved?.price ?? null;
  if (!resolved || rate == null || rate <= 0) {
    return NextResponse.json({ error: "This plan is free — no payment needed." }, { status: 400 });
  }
  const currency = resolved.currency;

  let seatLimit: number | null = null;
  let months: number;
  let amount: number;

  if (audience === "b2b") {
    months = clampInt(body.months) ?? 12;
    if (resolved.priceUnit === "per_seat") {
      seatLimit = clampInt(body.seats);
      if (!seatLimit) return NextResponse.json({ error: "Enter the number of students to contract." }, { status: 400 });
      // Floor: at least MIN_B2B_SEATS (minimum deal size), and never below the real
      // enrolled headcount (the no-leak floor).
      const gate = await resolveSeatGate(schoolId as string);
      const floor = Math.max(MIN_B2B_SEATS, gate.used);
      if (seatLimit < floor) {
        const why =
          gate.used > MIN_B2B_SEATS
            ? `your school has ${gate.used} students enrolled`
            : `the minimum contract is ${MIN_B2B_SEATS} students`;
        return NextResponse.json({ error: `Contract at least ${floor} seats — ${why}.` }, { status: 400 });
      }
      amount = termTotal(rate * seatLimit * months, months);
    } else {
      amount = termTotal(rate * months, months);
    }
  } else {
    months = clampInt(body.months) ?? 1; // B2C self-serve defaults to a one-month term
    amount = termTotal(rate * months, months);
  }

  const paymentId = await createPayment({
    provider: provider.id,
    audience,
    channel,
    planId,
    userId,
    schoolId,
    seatLimit,
    months,
    amount,
    currency,
    createdBy: user.id,
  });
  if (!paymentId) return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });

  const origin = siteUrl();
  try {
    const checkout = await provider.createCheckout({
      paymentId,
      planId,
      channel,
      amount,
      currency,
      description: `BlueStift — ${plan.name}`,
      customer: { email: user.email ?? null },
      returnUrl: `${origin}/checkout/return?pid=${paymentId}`,
      notifyUrl: `${origin}/api/billing/webhook/${provider.id}`,
    });
    if (checkout.mode !== "redirect") {
      return NextResponse.json({ error: "This method isn't available for online checkout." }, { status: 400 });
    }
    if (checkout.providerRef) await setPaymentProviderRef(paymentId, checkout.providerRef);
    return NextResponse.json({ url: checkout.url, paymentId });
  } catch {
    return NextResponse.json({ error: "Could not reach the payment provider. Try again." }, { status: 502 });
  }
}
