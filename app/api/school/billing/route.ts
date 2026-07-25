import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership } from "@/lib/school-admin";
import {
  getSchoolBilling,
  activateSubscription,
  PAYMENT_METHODS,
  type ActivateInput,
  type SchoolBilling,
} from "@/lib/billing";
import { sendBrandedEmail, getUserEmail, siteUrl } from "@/lib/email";

/** Receipt to the admin confirming a plan is now active (best-effort, non-blocking). */
async function sendActivationReceipt(
  adminUserId: string,
  schoolName: string,
  subscriptionId: string,
  expiresAt: string,
  billing: SchoolBilling | null,
) {
  const to = await getUserEmail(adminUserId);
  if (!to) return;
  const planName = billing?.planName ?? "Your plan";
  const amount = billing?.history.find((h) => h.id === subscriptionId)?.amount ?? null;
  const until = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const lines = [
    `${planName} is now active for ${schoolName} on Bluestift Schools.`,
    amount != null ? `Amount recorded: $${amount.toFixed(2)}.` : "",
    `Your subscription runs until ${until}.`,
  ].filter(Boolean);
  await sendBrandedEmail({
    brand: "schools",
    to,
    subject: `${planName} is active — ${schoolName}`,
    heading: `${planName} is active`,
    lines,
    cta: { label: "View billing", url: `${siteUrl()}/school` },
  });
}

const PAYMENT_METHOD_SET: readonly string[] = PAYMENT_METHODS;

/** Current billing state for the admin's school (plan, seats, history, catalog). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const billing = await getSchoolBilling(user.id);
  if (!billing) return NextResponse.json({ error: "Admin only." }, { status: 403 });
  return NextResponse.json(billing);
}

/**
 * Activate/upgrade the school onto a plan. v1 = manual: the admin records a
 * payment collected out-of-band and the subscription flips active. The payment
 * provider is consulted first so a future Stripe provider can return a redirect
 * instead of activating inline.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can manage billing." }, { status: 403 });
  }

  let body: {
    planId?: string;
    seatLimit?: number | null;
    amount?: number | null;
    paymentMethod?: string;
    paymentReference?: string;
    months?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) return NextResponse.json({ error: "A plan is required." }, { status: 400 });

  const paymentMethod =
    typeof body.paymentMethod === "string" && PAYMENT_METHOD_SET.includes(body.paymentMethod)
      ? body.paymentMethod
      : "manual";

  const clampInt = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  const clampAmount = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

  const input: ActivateInput = {
    planId,
    seatLimit: clampInt(body.seatLimit),
    amount: clampAmount(body.amount),
    paymentMethod,
    paymentReference:
      typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0, 200) || null : null,
    months: clampInt(body.months) ?? 12,
  };

  // Manual activation: the admin records a payment collected out-of-band (wire,
  // invoice, PO) and the subscription flips active. Self-serve online payment
  // (card / mobile money / PayPal) is a separate flow — see /api/billing/checkout.
  const result = await activateSubscription(user.id, input);
  if (!result) return NextResponse.json({ error: "Only the school admin can manage billing." }, { status: 403 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const billing = await getSchoolBilling(user.id);

  // Confirm the activation by email, after the response is sent.
  after(() =>
    sendActivationReceipt(user.id, membership.schoolName, result.subscriptionId, result.expiresAt, billing),
  );

  return NextResponse.json({ subscriptionId: result.subscriptionId, expiresAt: result.expiresAt, billing });
}
