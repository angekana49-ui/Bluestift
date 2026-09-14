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
import { firstNameOf, sendPilotStartedEmail } from "@/lib/email";
import { MIN_NAME_LENGTH, isNameTooShort, normalizeName } from "@/lib/names";
import { apiT } from "@/lib/i18n/server";
import { captureServer } from "@/lib/analytics/server";

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
        error: await apiT("api.addAVerifiedEmailBeforeCreating"),
        code: "email_required",
      },
      { status: 403 },
    );
  }
  // Generous for a real founder (a group opening a second campus), useless for
  // someone scripting schools into existence.
  if (!(await checkStrictUserRateLimit("school_create", user.id, 3, "24 hours"))) {
    return NextResponse.json(
      { error: await apiT("api.youveCreatedSeveralSchoolsTodayPlease"), code: "rate_limited" },
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
  if (isNameTooShort(name)) {
    return NextResponse.json(
      { error: await apiT("api.theSchoolNameNeedsAtLeast", { minNameLength: MIN_NAME_LENGTH }), code: "name" },
      { status: 400 },
    );
  }
  const countryCode = (body.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null;
  if (!countryCode) return NextResponse.json({ error: await apiT("api.chooseTheSchoolsCountry"), code: "country" }, { status: 400 });
  const rawType = (body.schoolType ?? "").trim().toLowerCase();
  const schoolType = (SCHOOL_TYPES as readonly string[]).includes(rawType) ? rawType : null;
  // Required: country + name alone do not identify a school. Every state has its
  // Lincoln High and its Roosevelt High; the city is what tells them apart.
  const city = (body.city ?? "").trim().slice(0, 80);
  if (!city) return NextResponse.json({ error: await apiT("api.enterTheSchoolsCity"), code: "city" }, { status: 400 });
  const phone = (body.phone ?? "").trim().slice(0, 40) || null;
  const email = (body.email ?? "").trim().slice(0, 160) || null;
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: await apiT("api.theSchoolEmailDoesntLookRight") }, { status: 400 });
  }

  const effectif = Number(body.effectif);
  if (!Number.isInteger(effectif) || effectif < MIN_B2B_SEATS || effectif > 100_000) {
    return NextResponse.json(
      { error: await apiT("api.declareHowManyStudentsTheSchool", { minB2bSeats: MIN_B2B_SEATS }), code: "effectif" },
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
    return NextResponse.json({ error: await apiT("api.chooseAPlanForYourPilot"), code: "plan" }, { status: 400 });
  }

  /**
   * One admin, one copy of a school.
   *
   * Name, country and city together are what a school is to the people in it,
   * and the admin's account is the last word that separates two genuinely
   * different schools sharing all three (two Lincoln Highs in one Springfield,
   * run by two different people). So the same three, under the same admin,
   * are the same school, and a second one is a double submit or a forgotten
   * first try, not a new campus. Different admins may share the three freely;
   * each school keeps its own id either way.
   *
   * Compared on normalizeName: accents, case and spacing don't make a school.
   */
  const { data: mine } = await schools
    .from("school_admins")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("role", "admin_master");
  const mineIds = ((mine as { school_id: string }[] | null) ?? []).map((m) => m.school_id);
  if (mineIds.length) {
    const { data: existing } = await schools.from("schools").select("id, name, city, country_code").in("id", mineIds);
    const clash = ((existing as { id: string; name: string; city: string | null; country_code: string | null }[] | null) ?? []).find(
      (s) =>
        s.country_code === countryCode && normalizeName(s.name) === normalizeName(name) && normalizeName(s.city) === normalizeName(city),
    );
    if (clash) {
      return NextResponse.json(
        {
          error: await apiT("api.youAlreadyHaveInOpenIt", { name: clash.name, city: clash.city ?? city }),
          code: "duplicate_school",
          schoolId: clash.id,
        },
        { status: 409 },
      );
    }
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

  // The school's name and city identify it — neither goes to the analytics
  // processor. Size and plan are what the funnel needs.
  void captureServer(user.id, "school_created", {
    plan_tier: plan.tier,
    seats: effectif,
    country: countryCode,
    school_type: schoolType,
    pilot_days: SCHOOL_PILOT_DAYS,
    first_school: mineIds.length === 0,
  });

  // The "pilot-started" template (Resend). Its promise of a reminder before the
  // pilot ends is kept by /api/cron/pilot-reminder.
  const to = user.email as string;
  // display_name only: the seeded username ("user_1a2b3c4d") is not a name.
  const { data: me } = await supabase.from("users").select("display_name").eq("id", user.id).maybeSingle();
  after(() =>
    sendPilotStartedEmail({
      to,
      adminFirstname: firstNameOf(me?.display_name, to),
      schoolName: name,
      pilotDays: SCHOOL_PILOT_DAYS,
      pilotUntil,
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
