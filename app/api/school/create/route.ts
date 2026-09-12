import { NextResponse } from "next/server";
import { after } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { SCHOOL_TYPES } from "@/lib/school-admin";
import { setActiveSchoolCookie } from "@/lib/school-active";
import { currentAcademicYear } from "@/lib/school-constants";
import { hasRealEmail } from "@/lib/auth";
import { MIN_B2B_SEATS, SCHOOL_PILOT_DAYS, pilotEndDate } from "@/lib/billing/terms";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { sendBrandedEmail, siteUrl } from "@/lib/email";

/** A plain address check — enough to refuse a typo, not a deliverability test. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Self-serve school creation, which is also where the school's free pilot starts.
 *
 * The creator becomes the school's admin_master, with an active current school
 * year. What keeps this from being a one-click way to litter the database with
 * schools is that it is not one click: the creator must pick a plan and declare
 * a headcount of at least MIN_B2B_SEATS, which are exactly the terms the pilot
 * then runs on. That commitment is recorded as a `trial` subscription carrying
 * the chosen plan and the declared seats, ending with the pilot. When the pilot
 * ends without a paid plan, the school turns read-only (resolveSeatGate).
 *
 * Any signed-in user with a real email can create a school, including someone who
 * already belongs to others (multi-school). The new school becomes the caller's
 * active school.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Staff gate: creating a school makes you its admin — an adult, recoverable
  // account. Anonymous (email-less) accounts are for basic learners only.
  if (!hasRealEmail(user.email)) {
    return NextResponse.json(
      {
        error: "Add a verified email before creating a school — staff accounts need one. You can link it in Settings.",
        code: "email_required",
      },
      { status: 403 },
    );
  }
  // Generous for a real founder (a group opening a second campus), useless for
  // someone scripting schools into existence.
  if (!(await checkStrictUserRateLimit("school_create", user.id, 3, "24 hours"))) {
    return NextResponse.json(
      { error: "You've created several schools today. Please try again tomorrow.", code: "rate_limited" },
      { status: 429 },
    );
  }

  let body: {
    name?: string;
    countryCode?: string;
    schoolType?: string;
    city?: string;
    email?: string;
    phone?: string;
    planId?: string;
    effectif?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "A school name is required." }, { status: 400 });
  const countryCode = (body.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null;
  if (!countryCode) return NextResponse.json({ error: "Choose the school's country." }, { status: 400 });
  const rawType = (body.schoolType ?? "").trim().toLowerCase();
  const schoolType = (SCHOOL_TYPES as readonly string[]).includes(rawType) ? rawType : null;
  const city = (body.city ?? "").trim().slice(0, 80) || null;
  const phone = (body.phone ?? "").trim().slice(0, 40) || null;
  const email = (body.email ?? "").trim().slice(0, 160) || null;
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "The school email doesn't look right." }, { status: 400 });
  }

  const effectif = Number(body.effectif);
  if (!Number.isInteger(effectif) || effectif < MIN_B2B_SEATS || effectif > 100_000) {
    return NextResponse.json(
      { error: `Declare how many students the school has — at least ${MIN_B2B_SEATS}.`, code: "effectif" },
      { status: 400 },
    );
  }

  const schools = createSchoolsAdminClient();

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const { data: planData } = planId
    ? await schools
        .from("subscription_plans")
        .select("id, name, tier, category")
        .eq("id", planId)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };
  const plan = planData as { id: string; name: string; tier: string | null; category: string | null } | null;
  if (!plan || plan.category !== "b2b") {
    return NextResponse.json({ error: "Choose a plan for your pilot.", code: "plan" }, { status: 400 });
  }

  const now = new Date();
  const pilotUntil = pilotEndDate(now);
  // The trial row ends at the close of the pilot's last day, so "still running"
  // (end_date >= now) and "pilot_until >= today" agree on the same date.
  const pilotEndsAt = `${pilotUntil}T23:59:59.999Z`;

  const { data: schoolIns, error: sErr } = await schools
    .from("schools")
    .insert({
      name,
      country_code: countryCode,
      school_type: schoolType,
      city,
      email,
      phone,
      pilot_until: pilotUntil,
      subscription_expires_at: pilotEndsAt,
    })
    .select("id")
    .single();
  if (sErr) return NextResponse.json({ error: clientError(sErr) }, { status: 500 });
  const schoolId = (schoolIns as { id: string }).id;

  const year = currentAcademicYear();
  const { data: yearIns, error: yErr } = await schools
    .from("school_years")
    .insert({ school_id: schoolId, ...year, is_active: true })
    .select("id")
    .single();
  if (yErr) return NextResponse.json({ error: clientError(yErr) }, { status: 500 });
  const yearId = (yearIns as { id: string }).id;

  // The school creator is the admin_master (director/IT). Profs are added later
  // by the admin_master and scoped to their assignments.
  const { error: aErr } = await schools
    .from("school_admins")
    .insert({ user_id: user.id, school_id: schoolId, role: "admin_master" });
  if (aErr) return NextResponse.json({ error: clientError(aErr) }, { status: 500 });

  // The pilot's terms, on record: the plan chosen and the headcount declared,
  // at no charge, until the pilot ends. activateSubscription cancels this row
  // when a paid plan replaces it.
  const { error: subErr } = await schools.from("subscriptions").insert({
    school_id: schoolId,
    plan_id: plan.id,
    status: "trial",
    start_date: now.toISOString(),
    end_date: pilotEndsAt,
    auto_renew: false,
    seat_limit: effectif,
    amount: 0,
    payment_method: "pilot",
    created_by: user.id,
  });
  if (subErr) return NextResponse.json({ error: clientError(subErr) }, { status: 500 });

  await schools.from("schools").update({ current_school_year_id: yearId }).eq("id", schoolId);

  // Land the creator in the school they just made (multi-school active pointer).
  await setActiveSchoolCookie(schoolId);

  const to = user.email as string;
  const until = new Date(pilotEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  after(() =>
    sendBrandedEmail({
      brand: "schools",
      to,
      subject: `Your ${SCHOOL_PILOT_DAYS}-day pilot has started — ${name}`,
      heading: `${name} is on Bluestift Schools`,
      lines: [
        `Your free ${SCHOOL_PILOT_DAYS}-day pilot has started on ${plan.name}, for ${effectif} students.`,
        `It runs until ${until}. Nothing is charged during the pilot.`,
        "To keep adding students and classes after that date, activate a plan from the Billing tab.",
      ],
      cta: { label: "Open your school", url: `${siteUrl("schools")}/school` },
    }),
  );

  return NextResponse.json({
    schoolId,
    name,
    currentYearId: yearId,
    currentYearLabel: year.label,
    planId: plan.id,
    effectif,
    pilotUntil,
  });
}
