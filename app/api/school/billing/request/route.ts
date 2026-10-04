import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createContentAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { getSchoolBilling } from "@/lib/billing";
import { termTotal } from "@/lib/billing/terms";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { sendBrandedEmail, getUserEmail, siteUrl } from "@/lib/email";
import { reportError } from "@/lib/observability/report";
import { apiT } from "@/lib/i18n/server";

/**
 * A school asks for a licence.
 *
 * Until online payment is live, Bluestift is licensed the old way: the school
 * pays the founder directly (transfer, mobile money, cash, invoice), and the
 * founder activates the plan from /ops/billing. This route is the school's half
 * of that: it records what they want and tells the founder. It activates
 * nothing — a school cannot grant itself a plan.
 *
 * The request lands in content.contact_messages, where every other inbound
 * message already goes, so nothing is lost if the email does not send.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: await apiT("api.billingAdminOnly") }, { status: 403 });
  }
  // A request is a message to a person; five an hour is plenty for a real one.
  if (!(await checkStrictUserRateLimit("licence_request", user.id, 5, "1 hour"))) {
    return NextResponse.json({ error: await apiT("api.tooManyRequestsPleaseTryAgain") }, { status: 429 });
  }

  let body: { planId?: unknown; seats?: unknown; months?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const billing = await getSchoolBilling(user.id);
  const plan = billing?.plans.find((p) => p.id === body.planId);
  if (!billing || !plan) return NextResponse.json({ error: await apiT("api.planRequired") }, { status: 400 });

  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);
  const months = [1, 3, 12].includes(int(body.months) ?? 0) ? (int(body.months) as number) : 12;
  const seats = plan.priceUnit === "per_seat" ? Math.max(int(body.seats) ?? 0, billing.seats.used) || null : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  // The reference total, worked out here from the plan rather than taken from
  // the browser. It is only a quote for the founder: no money moves on it.
  // Per-student plans only — the same sum the old activation form showed. A
  // flat plan's price is quoted as listed, not multiplied by a guess at its period.
  const estimate =
    plan.price != null && plan.priceUnit === "per_seat" && seats != null
      ? termTotal(plan.price * seats * months, months)
      : null;

  const adminEmail = await getUserEmail(user.id);
  const lines = [
    `School: ${membership.schoolName} (${membership.schoolId})`,
    `Plan: ${plan.name}`,
    seats != null ? `Students: ${seats}` : "",
    `Term: ${months} month${months > 1 ? "s" : ""}`,
    estimate != null
      ? `Reference total: $${estimate.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : plan.price != null
        ? `Listed price: $${plan.price}${plan.billingPeriod ? ` / ${plan.billingPeriod}` : ""}`
        : "Price: on quote",
    `Requested by: ${adminEmail ?? user.id}`,
    note ? `Note: ${note}` : "",
  ].filter(Boolean);

  const { error } = await createContentAdminClient()
    .from("contact_messages")
    .insert({
      email: adminEmail ?? "unknown@schools.local",
      subject: `Licence request — ${membership.schoolName}`.slice(0, 200),
      message: lines.join("\n"),
      source: "form",
    });
  if (error) {
    await reportError("billing.licenceRequest", error, { tags: { schoolId: membership.schoolId } });
    return NextResponse.json({ error: await apiT("school.billing.requestFailed") }, { status: 500 });
  }

  // Tell the founder, after the response: the stored row is the record, the
  // email is the nudge.
  after(async () => {
    try {
      const { data } = await createAdminClient().from("users").select("id").eq("is_founder", true).limit(1).maybeSingle();
      const to = data?.id ? await getUserEmail(data.id) : null;
      if (!to) return;
      await sendBrandedEmail({
        brand: "schools",
        to,
        subject: `Licence request — ${membership.schoolName}`,
        heading: "A school is asking for a licence",
        lines: [...lines, "Once they have paid, activate it from the ops console."],
        cta: { label: "Open the ops console", url: `${siteUrl("schools")}/ops/billing` },
      });
    } catch (e) {
      await reportError("billing.licenceRequest.email", e, { severity: "warning" });
    }
  });

  return NextResponse.json({ ok: true });
}
