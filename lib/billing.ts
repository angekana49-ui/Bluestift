import "server-only";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { detectZone, type Zone } from "@/lib/billing/regions";
import { MIN_B2B_SEATS, termTotal } from "@/lib/billing/terms";
import { invalidateEntitlements } from "@/lib/entitlements";

/**
 * Billing data layer (schools schema, service_role — untyped like the rest of
 * that schema). Two responsibilities:
 *   1. The admin Billing dashboard: current plan, seat usage, history, catalog.
 *   2. The **school-wide seat gate** — the real revenue control, enforced at
 *      student join *above* the per-class `n + 5` pedagogical cap.
 *
 * Seats are counted from the non-gameable DB headcount (`student_identities`),
 * never the self-declared effectif. Effective seat cap resolves as:
 *   subscription.seat_limit (per-school custom/devis override)
 *     → plan.seat_limit (plan default)
 *     → null = ungated (pilot window, custom-uncapped, or no paid plan).
 * A school with no paid plan is intentionally ungated so onboarding/free schools
 * are never blocked; the gate only bites once a seat-limited plan is attached.
 */

export type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  category: string | null; // b2b | b2c
  tier: string | null; // standard | pro | custom
  price: number | null; // flat: monthly plan price; per_seat: monthly rate PER STUDENT
  priceUnit: "flat" | "per_seat";
  billingPeriod: string | null; // monthly | yearly
  features: string[];
  seatLimit: number | null;
  storageGb: number | null;
};

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tier: string | null;
  price: number | null;
  price_unit: string | null;
  billing_period: string | null;
  features: unknown;
  seat_limit: number | null;
  storage_gb: number | null;
};

function toFeatures(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function mapPlan(r: PlanRow): BillingPlan {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    tier: r.tier,
    price: r.price == null ? null : Number(r.price),
    priceUnit: r.price_unit === "per_seat" ? "per_seat" : "flat",
    billingPeriod: r.billing_period,
    features: toFeatures(r.features),
    seatLimit: r.seat_limit,
    storageGb: r.storage_gb,
  };
}

const PLAN_COLS =
  "id, name, description, category, tier, price, price_unit, billing_period, features, seat_limit, storage_gb";

/** Active plans, optionally filtered by category (b2b for schools, b2c for students). */
export async function listPlans(category?: "b2b" | "b2c"): Promise<BillingPlan[]> {
  const schools = createSchoolsAdminClient();
  let q = schools.from("subscription_plans").select(PLAN_COLS).eq("is_active", true);
  if (category) q = q.eq("category", category);
  const { data } = await q.order("price", { ascending: true, nullsFirst: false });
  return ((data as PlanRow[] | null) ?? []).map(mapPlan);
}

// ---- Region-adapted pricing (PPP price-book) -------------------------------

export type ResolvedPrice = {
  /** The zone the price came from (`west` = base USD fallback). */
  regionCode: Zone;
  currency: string;
  /** per_seat: the per-student rate; flat: the plan price. Null only if base is null. */
  price: number | null;
  priceUnit: "flat" | "per_seat";
  bundleSeats: number | null;
};

/**
 * Resolve a plan's price for a zone: a `plan_region_prices` row when one exists
 * for that zone, else the base `subscription_plans` price in USD. `west` and any
 * zone without a row both fall back to USD, so pricing degrades safely.
 */
export async function resolvePlanPrice(planId: string, zone: Zone): Promise<ResolvedPrice | null> {
  const schools = createSchoolsAdminClient();

  if (zone !== "west") {
    const { data } = await schools
      .from("plan_region_prices")
      .select("currency, price, price_unit, bundle_seats")
      .eq("plan_id", planId)
      .eq("region_code", zone)
      .eq("is_active", true)
      .maybeSingle();
    const r = data as
      | { currency: string; price: number; price_unit: string; bundle_seats: number | null }
      | null;
    if (r) {
      return {
        regionCode: zone,
        currency: r.currency,
        price: Number(r.price),
        priceUnit: r.price_unit === "flat" ? "flat" : "per_seat",
        bundleSeats: r.bundle_seats,
      };
    }
  }

  const { data: p } = await schools
    .from("subscription_plans")
    .select("price, price_unit")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  const base = p as { price: number | null; price_unit: string | null } | null;
  if (!base) return null;
  return {
    regionCode: "west",
    currency: "USD",
    price: base.price == null ? null : Number(base.price),
    priceUnit: base.price_unit === "per_seat" ? "per_seat" : "flat",
    bundleSeats: null,
  };
}

/**
 * Resolve a plan's price from the request signals — the double-layer (declared
 * country + IP) honesty gate decides the zone, then the price-book decides the
 * amount. Used by both the checkout charge and its display so they never diverge.
 */
export async function resolvePlanPriceForRequest(
  planId: string,
  declaredCountry: string | null,
  ipCountry: string | null,
): Promise<ResolvedPrice | null> {
  return resolvePlanPrice(planId, detectZone({ declaredCountry, ipCountry }));
}

// ---- School-wide seat gate (enforcement) -----------------------------------

export type SeatGate = {
  /** True when a numeric seat cap applies (a seat-limited plan is attached). */
  limited: boolean;
  /** The effective cap, or null when ungated. */
  seats: number | null;
  /** Real current headcount (student_identities for the school). */
  used: number;
  /** Why the gate is (or isn't) active — for logging/UX. */
  reason: "pilot" | "uncapped" | "no_subscription" | "plan";
};

/**
 * Resolve the seat gate for a school. Used both by the join route (to refuse a
 * new student past the cap) and by the dashboard (to show usage). Never throws —
 * on any read failure it degrades to ungated so joins are never wrongly blocked.
 */
export async function resolveSeatGate(schoolId: string): Promise<SeatGate> {
  const schools = createSchoolsAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Non-gameable headcount = the source of truth for billing.
  const { count } = await schools
    .from("student_identities")
    .select("user_id", { count: "exact", head: true })
    .eq("school_id", schoolId);
  const used = count ?? 0;

  const { data: sData } = await schools
    .from("schools")
    .select("pilot_until")
    .eq("id", schoolId)
    .maybeSingle();
  const pilotUntil = (sData as { pilot_until: string | null } | null)?.pilot_until ?? null;
  if (pilotUntil && pilotUntil >= today) {
    return { limited: false, seats: null, used, reason: "pilot" };
  }

  const { data: subData } = await schools
    .from("subscriptions")
    .select("plan_id, seat_limit")
    .eq("school_id", schoolId)
    .in("status", ["active", "trial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = subData as { plan_id: string | null; seat_limit: number | null } | null;
  if (!sub) return { limited: false, seats: null, used, reason: "no_subscription" };

  let planSeat: number | null = null;
  if (sub.plan_id) {
    const { data: p } = await schools
      .from("subscription_plans")
      .select("seat_limit")
      .eq("id", sub.plan_id)
      .maybeSingle();
    planSeat = (p as { seat_limit: number | null } | null)?.seat_limit ?? null;
  }
  const seats = sub.seat_limit ?? planSeat;
  if (seats == null) return { limited: false, seats: null, used, reason: "uncapped" };
  return { limited: true, seats, used, reason: "plan" };
}

// ---- Plan label (sidebar profile chip) -------------------------------------

/**
 * A short "forfait" label for the sidebar profile chip. Resolves the active
 * subscription's plan name for a school (b2b) or a user (b2c), falling back to
 * "Pilot" (a school still in its pilot window) or the free tier. A b2c user with
 * no paid plan reads "User — Free" (matching the paid "User — Plus/Max" names) so
 * the chip always shows the "User — <forfait>" format; a school with no plan reads
 * "Free". Never throws — degrades to the free label on any read failure so the
 * chip always renders.
 */
export async function getPlanLabel(
  target: { schoolId: string } | { userId: string },
): Promise<string> {
  const freeLabel = "userId" in target ? "User — Free" : "Free";
  try {
    const schools = createSchoolsAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    let filtered = schools
      .from("subscriptions")
      .select("plan_id")
      .in("status", ["active", "trial"]);
    filtered =
      "schoolId" in target
        ? filtered.eq("school_id", target.schoolId)
        : filtered.eq("user_id", target.userId).is("school_id", null);
    const { data: sub } = await filtered
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const planId = (sub as { plan_id: string | null } | null)?.plan_id ?? null;

    if (planId) {
      const { data: p } = await schools
        .from("subscription_plans")
        .select("name")
        .eq("id", planId)
        .maybeSingle();
      const name = (p as { name: string | null } | null)?.name;
      if (name) return name;
    }

    if ("schoolId" in target) {
      const { data: sc } = await schools
        .from("schools")
        .select("pilot_until")
        .eq("id", target.schoolId)
        .maybeSingle();
      const pilotUntil = (sc as { pilot_until: string | null } | null)?.pilot_until ?? null;
      if (pilotUntil && pilotUntil >= today) return "Pilot";
    }
    return freeLabel;
  } catch {
    return freeLabel;
  }
}

// ---- Admin billing dashboard -----------------------------------------------

export type BillingHistoryItem = {
  id: string;
  planId: string | null;
  planName: string | null;
  status: string;
  amount: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
};

export type SchoolBilling = {
  planId: string | null;
  planName: string | null;
  status: string; // active | trial | cancelled | expired | none
  seats: { limit: number | null; used: number; remaining: number | null };
  /** Sum of declared per-class effectifs (current year) — the suggested contract
   * base. Billing is on this enrolled effectif, NOT on per-student usage. */
  declaredEffectif: number | null;
  pilotUntil: string | null;
  expiresAt: string | null;
  history: BillingHistoryItem[];
  plans: BillingPlan[]; // b2b catalog for upgrade/activation
};

type SubRow = {
  id: string;
  plan_id: string | null;
  status: string;
  amount: number | null;
  seat_limit: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
};

/** Full billing view for the admin's school (admin_master only). */
export async function getSchoolBilling(userId: string): Promise<SchoolBilling | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;

  const schools = createSchoolsAdminClient();
  const [{ data: sData }, { data: subData }, plans, gate] = await Promise.all([
    schools
      .from("schools")
      .select("pilot_until, subscription_expires_at, current_school_year_id")
      .eq("id", m.schoolId)
      .maybeSingle(),
    schools
      .from("subscriptions")
      .select("id, plan_id, status, amount, seat_limit, payment_method, payment_reference, start_date, end_date, created_at")
      .eq("school_id", m.schoolId)
      .order("created_at", { ascending: false }),
    listPlans("b2b"),
    resolveSeatGate(m.schoolId),
  ]);

  const school =
    (sData as {
      pilot_until: string | null;
      subscription_expires_at: string | null;
      current_school_year_id: string | null;
    } | null) ?? null;
  const subs = (subData as SubRow[] | null) ?? [];

  // Sum the declared per-class effectifs (current year) — the natural contract
  // base, since the school already declares these when creating classes.
  let effQuery = schools.from("classes").select("expected_size").eq("school_id", m.schoolId);
  if (school?.current_school_year_id) effQuery = effQuery.eq("school_year_id", school.current_school_year_id);
  const { data: effData } = await effQuery;
  const effRows = (effData as { expected_size: number | null }[] | null) ?? [];
  const declaredEffectif = effRows.some((r) => r.expected_size != null)
    ? effRows.reduce((sum, r) => sum + (r.expected_size ?? 0), 0)
    : null;
  const planName = new Map(plans.map((p) => [p.id, p.name]));

  // The current subscription = the newest active/trial one, if any.
  const current = subs.find((s) => s.status === "active" || s.status === "trial") ?? null;

  const history: BillingHistoryItem[] = subs.map((s) => ({
    id: s.id,
    planId: s.plan_id,
    planName: s.plan_id ? planName.get(s.plan_id) ?? s.plan_id : null,
    status: s.status,
    amount: s.amount == null ? null : Number(s.amount),
    paymentMethod: s.payment_method,
    paymentReference: s.payment_reference,
    startDate: s.start_date,
    endDate: s.end_date,
    createdAt: s.created_at,
  }));

  const remaining =
    gate.seats == null ? null : Math.max(0, gate.seats - gate.used);

  return {
    planId: current?.plan_id ?? null,
    planName: current?.plan_id ? planName.get(current.plan_id) ?? current.plan_id : null,
    status: current?.status ?? "none",
    seats: { limit: gate.seats, used: gate.used, remaining },
    declaredEffectif,
    pilotUntil: school?.pilot_until ?? null,
    expiresAt: school?.subscription_expires_at ?? null,
    history,
    plans,
  };
}

// ---- Manual activation (admin marks a payment received) --------------------

export type ActivateInput = {
  planId: string;
  /** Custom seat count for negotiated (École/devis) plans; overrides plan default. */
  seatLimit?: number | null;
  /** Amount actually collected, in USD. */
  amount?: number | null;
  /** How it was paid: transfer | mobile_money | invoice | card | other. */
  paymentMethod?: string | null;
  paymentReference?: string | null;
  /** Term length in months (default 12). */
  months?: number;
};

export const PAYMENT_METHODS = ["transfer", "mobile_money", "invoice", "card", "other"] as const;

export type ActivateResult =
  | { ok: true; subscriptionId: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * Manually activate/upgrade the admin's school onto a plan (v1 = payment collected
 * out-of-band). Cancels any prior active subscription, inserts a fresh active row,
 * and repoints `schools.subscription_tier` / `subscription_expires_at`.
 *
 * Returns null only when the caller isn't the admin_master. Otherwise a typed
 * result: for per-student plans the contracted seat count must be ≥ the school's
 * REAL current headcount — otherwise a school could enroll students while ungated
 * (pilot / no plan) and then under-contract, paying for fewer seats than it uses.
 * Contracting ≥ headcount, combined with the join-time gate capping growth at the
 * contract, guarantees real headcount ≤ paid seats at all times (no leak).
 */
export async function activateSubscription(
  userId: string,
  input: ActivateInput,
): Promise<ActivateResult | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;

  const schools = createSchoolsAdminClient();
  const { data: pData } = await schools
    .from("subscription_plans")
    .select("id, tier, price, price_unit, billing_period")
    .eq("id", input.planId)
    .eq("is_active", true)
    .maybeSingle();
  const plan = pData as {
    id: string;
    tier: string | null;
    price: number | null;
    price_unit: string | null;
    billing_period: string | null;
  } | null;
  if (!plan) return { ok: false, error: "Unknown or inactive plan." };

  const perSeat = plan.price_unit === "per_seat";
  const seatLimit = input.seatLimit ?? null;
  if (perSeat) {
    // Contracted headcount is required: it both caps joins and multiplies price.
    if (seatLimit == null || seatLimit <= 0) {
      return { ok: false, error: "Enter the number of students to contract." };
    }
    // Floor: at least MIN_B2B_SEATS (minimum deal size), and never fewer than the
    // students already enrolled (the no-leak floor).
    const { count } = await schools
      .from("student_identities")
      .select("user_id", { count: "exact", head: true })
      .eq("school_id", m.schoolId);
    const headcount = count ?? 0;
    const floor = Math.max(MIN_B2B_SEATS, headcount);
    if (seatLimit < floor) {
      const why =
        headcount > MIN_B2B_SEATS
          ? `your school already has ${headcount} students enrolled`
          : `the minimum contract is ${MIN_B2B_SEATS} students`;
      return { ok: false, error: `Contract at least ${floor} seats — ${why}.` };
    }
  }

  const now = new Date();
  const months = input.months && input.months > 0 ? Math.floor(input.months) : 12;
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);
  const startIso = now.toISOString();
  const endIso = end.toISOString();

  // Amount actually owed for the term. Per-seat: rate × students × months.
  // Flat: monthly price × months. Annual terms get the 15% discount. An explicit
  // override wins (negotiated deals).
  const rate = plan.price == null ? null : Number(plan.price);
  const base = rate == null ? null : perSeat ? rate * (seatLimit as number) * months : rate * months;
  const computed = base == null ? null : termTotal(base, months);
  const amount = input.amount ?? computed;

  // Retire any current active/trial subscription so history reads cleanly.
  await schools
    .from("subscriptions")
    .update({ status: "cancelled", end_date: startIso, updated_at: startIso })
    .eq("school_id", m.schoolId)
    .in("status", ["active", "trial"]);

  const { data: ins, error } = await schools
    .from("subscriptions")
    .insert({
      school_id: m.schoolId,
      plan_id: plan.id,
      status: "active",
      start_date: startIso,
      end_date: endIso,
      auto_renew: false,
      seat_limit: seatLimit,
      amount,
      payment_method: input.paymentMethod ?? "manual",
      payment_reference: input.paymentReference ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !ins) return { ok: false, error: "Could not activate the plan." };

  await schools
    .from("schools")
    .update({
      subscription_tier: plan.tier ?? plan.id,
      subscription_expires_at: endIso,
      updated_at: startIso,
    })
    .eq("id", m.schoolId);

  // The plan changed — drop any cached entitlements for this school so the new
  // tier takes effect immediately on this instance (the TTL covers the rest).
  invalidateEntitlements({ schoolId: m.schoolId });

  return { ok: true, subscriptionId: (ins as { id: string }).id, expiresAt: endIso };
}
