import "server-only";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { invalidateEntitlements } from "@/lib/entitlements";
import type { PaymentChannel } from "./payments";

/**
 * Data layer for the async online-checkout lifecycle (schools.payments) and the
 * activation it triggers. Kept separate from lib/billing.ts so the proven manual
 * admin activation path stays untouched: this module owns the self-serve path
 * (student B2C + school B2B online payments) end to end.
 *
 * The write is idempotent: markPaymentPaid claims the pending row with a
 * conditional UPDATE, so a webhook replayed twice activates exactly once.
 */

type Audience = "b2c" | "b2b";

export type CreatePaymentInput = {
  provider: string;
  audience: Audience;
  channel: PaymentChannel;
  planId: string;
  userId?: string | null;
  schoolId?: string | null;
  seatLimit?: number | null;
  months: number;
  amount: number | null;
  currency: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

/** Insert a pending payment intent. Returns its id (our provider transaction id). */
export async function createPayment(input: CreatePaymentInput): Promise<string | null> {
  const schools = createSchoolsAdminClient();
  const { data, error } = await schools
    .from("payments")
    .insert({
      provider: input.provider,
      audience: input.audience,
      channel: input.channel,
      status: "pending",
      plan_id: input.planId,
      user_id: input.userId ?? null,
      school_id: input.schoolId ?? null,
      seat_limit: input.seatLimit ?? null,
      months: input.months,
      amount: input.amount,
      currency: input.currency,
      created_by: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Record the aggregator's own token/id once the checkout is opened. */
export async function setPaymentProviderRef(id: string, providerRef: string): Promise<void> {
  const schools = createSchoolsAdminClient();
  await schools
    .from("payments")
    .update({ provider_ref: providerRef, updated_at: new Date().toISOString() })
    .eq("id", id);
}

type PaymentRow = {
  id: string;
  status: string;
  audience: Audience;
  channel: PaymentChannel;
  plan_id: string;
  user_id: string | null;
  school_id: string | null;
  seat_limit: number | null;
  months: number;
  amount: number | null;
  subscription_id: string | null;
  created_by: string | null;
};

const PAYMENT_COLS =
  "id, status, audience, channel, plan_id, user_id, school_id, seat_limit, months, amount, subscription_id, created_by";

/** Read a payment intent by id (used by the sandbox pay page + return landing). */
export async function getPaymentById(
  id: string,
): Promise<{ id: string; status: string; audience: Audience; amount: number | null } | null> {
  const schools = createSchoolsAdminClient();
  const { data } = await schools.from("payments").select("id, status, audience, amount").eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as { id: string; status: string; audience: Audience; amount: number | null };
  return { id: r.id, status: r.status, audience: r.audience, amount: r.amount == null ? null : Number(r.amount) };
}

export type PaidResult = { ok: boolean; already?: boolean; subscriptionId?: string };

/**
 * Transition a payment to `paid` and activate its subscription — exactly once.
 *
 * Idempotency: we first claim the row with `... where status = 'pending'`. If no
 * row is claimed, the payment was already handled (or doesn't exist) and we return
 * without re-activating. If activation then fails we roll the status back to
 * 'pending' so a later webhook retry can complete it.
 */
export async function markPaymentPaid(
  provider: string,
  providerRef: string,
  status: "paid" | "failed" | "expired" | "cancelled" = "paid",
): Promise<PaidResult> {
  const schools = createSchoolsAdminClient();
  const nowIso = new Date().toISOString();

  // Non-paid terminal states: record and stop (no activation).
  if (status !== "paid") {
    await schools
      .from("payments")
      .update({ status, updated_at: nowIso })
      .eq("provider", provider)
      .eq("provider_ref", providerRef)
      .eq("status", "pending");
    return { ok: true };
  }

  // Claim the pending row atomically (idempotency guard).
  const { data: claimed } = await schools
    .from("payments")
    .update({ status: "paid", paid_at: nowIso, updated_at: nowIso })
    .eq("provider", provider)
    .eq("provider_ref", providerRef)
    .eq("status", "pending")
    .select(PAYMENT_COLS)
    .maybeSingle();

  if (!claimed) {
    // Already handled (or unknown ref) — return the existing sub if any.
    const { data: existing } = await schools
      .from("payments")
      .select("subscription_id, status")
      .eq("provider", provider)
      .eq("provider_ref", providerRef)
      .maybeSingle();
    const e = existing as { subscription_id: string | null; status: string } | null;
    if (e && e.status === "paid") return { ok: true, already: true, subscriptionId: e.subscription_id ?? undefined };
    return { ok: false };
  }

  const p = claimed as PaymentRow;
  try {
    const subId =
      p.audience === "b2b"
        ? await activateSchoolSubscription(p)
        : await activateUserSubscription(p);
    if (!subId) throw new Error("activation write failed");
    await schools.from("payments").update({ subscription_id: subId, updated_at: nowIso }).eq("id", p.id);
    return { ok: true, subscriptionId: subId };
  } catch {
    // Roll back the claim so a retry can complete activation.
    await schools.from("payments").update({ status: "pending", paid_at: null, updated_at: nowIso }).eq("id", p.id);
    return { ok: false };
  }
}

// ---- Activation writers (self-serve path) ----------------------------------
// Mirrors lib/billing.ts activateSubscription's DB shape; kept independent so the
// manual admin path is never destabilized by the webhook path.

function termEnd(months: number): { startIso: string; endIso: string } {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + (months > 0 ? Math.floor(months) : 12));
  return { startIso: now.toISOString(), endIso: end.toISOString() };
}

async function loadPlanTier(planId: string): Promise<string | null> {
  const schools = createSchoolsAdminClient();
  const { data } = await schools.from("subscription_plans").select("tier").eq("id", planId).maybeSingle();
  return (data as { tier: string | null } | null)?.tier ?? null;
}

/** B2B: cancel prior active school sub, insert active row, repoint the school. */
async function activateSchoolSubscription(p: PaymentRow): Promise<string | null> {
  const schools = createSchoolsAdminClient();
  const { startIso, endIso } = termEnd(p.months);
  const tier = await loadPlanTier(p.plan_id);

  await schools
    .from("subscriptions")
    .update({ status: "cancelled", end_date: startIso, updated_at: startIso })
    .eq("school_id", p.school_id)
    .in("status", ["active", "trial"]);

  const { data: ins, error } = await schools
    .from("subscriptions")
    .insert({
      school_id: p.school_id,
      plan_id: p.plan_id,
      status: "active",
      start_date: startIso,
      end_date: endIso,
      auto_renew: false,
      seat_limit: p.seat_limit,
      amount: p.amount,
      payment_method: p.channel,
      payment_reference: p.id,
      created_by: p.created_by,
    })
    .select("id")
    .single();
  if (error || !ins) return null;

  await schools
    .from("schools")
    .update({ subscription_tier: tier ?? p.plan_id, subscription_expires_at: endIso, updated_at: startIso })
    .eq("id", p.school_id);
  if (p.school_id) invalidateEntitlements({ schoolId: p.school_id });
  return (ins as { id: string }).id;
}

/** B2C: cancel prior active user sub, insert active row (no school). */
async function activateUserSubscription(p: PaymentRow): Promise<string | null> {
  const schools = createSchoolsAdminClient();
  const { startIso, endIso } = termEnd(p.months);

  await schools
    .from("subscriptions")
    .update({ status: "cancelled", end_date: startIso, updated_at: startIso })
    .eq("user_id", p.user_id)
    .is("school_id", null)
    .in("status", ["active", "trial"]);

  const { data: ins, error } = await schools
    .from("subscriptions")
    .insert({
      user_id: p.user_id,
      plan_id: p.plan_id,
      status: "active",
      start_date: startIso,
      end_date: endIso,
      auto_renew: false,
      amount: p.amount,
      payment_method: p.channel,
      payment_reference: p.id,
      created_by: p.user_id,
    })
    .select("id")
    .single();
  if (error || !ins) return null;
  if (p.user_id) invalidateEntitlements({ userId: p.user_id });
  return (ins as { id: string }).id;
}
