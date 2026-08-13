import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";
import {
  operatorActivateUserPlan,
  operatorActivateSchoolPlan,
  PAYMENT_METHODS,
  type ActivateInput,
} from "@/lib/billing";

const PAYMENT_METHOD_SET: readonly string[] = PAYMENT_METHODS;

/**
 * Platform-operator manual activation — the founder granting a plan to ANY
 * individual (by email) or ANY school (by id) while payment is collected
 * out-of-band and self-serve checkout stays sandbox-only. Owner-only
 * (`lib/ops.ts`, backed by `users.is_founder`); everyone else gets the same
 * 403 whether or not they're signed in, so this never leaks who the owner is.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!(await isPlatformOwner(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  let body: {
    target?: string;
    email?: string;
    schoolId?: string;
    planId?: string;
    seatLimit?: number;
    months?: number;
    amount?: number;
    paymentMethod?: string;
    paymentReference?: string;
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

  if (body.target === "school") {
    const schoolId = typeof body.schoolId === "string" ? body.schoolId.trim() : "";
    if (!schoolId) return NextResponse.json({ error: "A school id is required." }, { status: 400 });
    const result = await operatorActivateSchoolPlan(user.id, schoolId, input);
    if (!result) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "A user email is required." }, { status: 400 });

  const admin = createAdminClient();
  // ilike (no wildcards) = case-insensitive exact match — public.users.email
  // isn't guaranteed to be stored lowercase, and typing it wrong shouldn't
  // just silently 404.
  const { data: found } = await admin.from("users").select("id, email").ilike("email", email).maybeSingle();
  const targetUserId = (found as { id: string; email: string | null } | null)?.id ?? null;
  if (!targetUserId) return NextResponse.json({ error: "No account with that email." }, { status: 404 });

  const result = await operatorActivateUserPlan(user.id, targetUserId, input);
  if (!result) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
