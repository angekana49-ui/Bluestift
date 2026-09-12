import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { classCapacity } from "@/lib/school-admin";
import { resolveSeatGate } from "@/lib/billing";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { ageBand, isMinor } from "@/lib/compliance/age";
import { forgetOptionalProcessing } from "@/lib/compliance/optional-processing";

// Local shapes for the untyped `schools` schema (not in generated types).
type CodeRow = { class_id: string; school_year_id: string | null };
type ClassRow = {
  id: string;
  name: string;
  school_id: string;
  school_year_id: string | null;
  expected_size: number | null;
  max_overflow: number | null;
};
type SchoolRow = { name: string };

const clampName = (v: unknown) =>
  typeof v === "string" ? v.trim().slice(0, 80) : "";

/**
 * Link the signed-in student to their school via a class access code, and record
 * their real name (school-private). Identity is taken from the session — the
 * client only supplies the code and their name.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { code?: string; firstName?: string; lastName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const firstName = clampName(body.firstName);
  const lastName = clampName(body.lastName);
  if (!code) return NextResponse.json({ error: "A class code is required." }, { status: 400 });
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }
  /**
   * Bucketed on the ACCOUNT, not the address, and the address was wrong on both
   * counts here.
   *
   * It refused legitimate traffic: this is the one endpoint where thirty
   * children join at once, from one school's gateway, on the same morning — and
   * a fail-closed ceiling of thirty per ten minutes per IP turns the thirty-first
   * student away from the flow the route exists to serve. Chat is limited per
   * user for exactly this reason (see lib/rate-limit.ts).
   *
   * And it barely inconvenienced the thing it was for: a session is free, so an
   * IP bucket lets one account spray codes through every proxy an attacker has.
   * On the account, guessing costs a fresh signup each time — a Turnstile solve
   * against the twenty-per-hour-per-IP anon cap. A real student joins once, or
   * twice with a typo, never eight times in ten minutes.
   */
  if (!(await checkStrictUserRateLimit("school_class_join", user.id, 8, "10 minutes"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const schools = createSchoolsAdminClient();

  // Resolve the code → class → school (service_role; students can't read codes).
  const { data: codeData } = await schools
    .from("class_access_codes")
    .select("class_id, school_year_id")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  const codeRow = (codeData ?? null) as CodeRow | null;
  if (!codeRow) {
    return NextResponse.json({ error: "Invalid or inactive class code." }, { status: 404 });
  }

  const { data: classData } = await schools
    .from("classes")
    .select("id, name, school_id, school_year_id, expected_size, max_overflow")
    .eq("id", codeRow.class_id)
    .maybeSingle();
  const classRow = (classData ?? null) as ClassRow | null;
  if (!classRow) {
    return NextResponse.json({ error: "That class no longer exists." }, { status: 404 });
  }

  const schoolId = classRow.school_id;
  const schoolYearId = codeRow.school_year_id ?? classRow.school_year_id ?? null;

  // The student's existing identity (one per user), used by both size gates below.
  const { data: existingData } = await schools
    .from("student_identities")
    .select("class_id, school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const existing = (existingData ?? null) as { class_id: string; school_id: string | null } | null;
  const alreadyInThisClass = existing?.class_id === classRow.id;
  const newToSchool = existing?.school_id !== schoolId;

  // (1) Per-class size limit (effectif n → hard cap n + CLASS_OVERFLOW): a
  // pedagogical guardrail. Only counts against a student NEW to this class;
  // re-joining the same class is always allowed. No effectif set → no cap.
  const cap = classCapacity(classRow.expected_size, classRow.max_overflow);
  if (cap != null && !alreadyInThisClass) {
    const { count } = await schools
      .from("student_identities")
      .select("user_id", { count: "exact", head: true })
      .eq("class_id", classRow.id);
    if ((count ?? 0) >= cap) {
      return NextResponse.json(
        { error: "This class is full — ask your teacher for another class or code." },
        { status: 409 },
      );
    }
  }

  // (2) School-wide seat gate (the revenue control): total school headcount ≤
  // the plan's seats, enforced ABOVE the per-class cap. Only a student who is new
  // to THIS school consumes a seat (moving between classes in the same school is
  // seat-neutral). Ungated schools (pilot / no seat-limited plan) never block.
  if (newToSchool) {
    const gate = await resolveSeatGate(schoolId);
    if (gate.reason === "pilot_ended") {
      return NextResponse.json(
        { error: "This school isn't accepting new students right now — ask your school administrator." },
        { status: 409 },
      );
    }
    if (gate.limited && gate.used >= (gate.seats ?? Infinity)) {
      return NextResponse.json(
        { error: "This school has reached its seat limit — ask your school administrator to add seats." },
        { status: 409 },
      );
    }
  }

  // Record the school-private real identity (one per user).
  const { error: idErr } = await schools.from("student_identities").upsert(
    {
      user_id: user.id,
      school_id: schoolId,
      class_id: classRow.id,
      school_year_id: schoolYearId,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (idErr) return NextResponse.json({ error: clientError(idErr) }, { status: 500 });

  // Wire the coordination columns on public.users. class_enrollment_id has an FK
  // to a billing enrollment row — only set it when one already exists.
  const admin = createAdminClient();
  const [{ data: enrollment }, { data: ageRow }] = await Promise.all([
    admin
      .from("class_enrollments")
      .select("id")
      .eq("class_id", classRow.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    admin
      .from("users")
      .select("birth_year, training_consent_at")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // The school's authorisation is what lets an under-13 use Raya at all: we run
  // no verifiable-parental-consent mechanism of our own and rely on the COPPA
  // school-consent exception, which is also the FERPA "school official"
  // relationship. Record it at the moment it is given, so the age gate can see
  // it — otherwise a child who joins a class stays blocked forever.
  const minor = isMinor(ageBand(ageRow?.birth_year ?? null));

  // Joining a school moves the account under the DPA, which promises the school
  // that content trains nothing unless the holder explicitly opted in. A solo
  // adult's "on by default" is not that choice — `training_consent_at` is null
  // for them — so it is switched off here and stays off until they choose. A
  // choice they DID make, either way, is left exactly as it is.
  const dropDefaultTraining = !ageRow?.training_consent_at;

  const { error: uErr } = await admin
    .from("users")
    .update({
      school_id: schoolId,
      school_year_id: schoolYearId,
      ...(enrollment?.id ? { class_enrollment_id: enrollment.id } : {}),
      ...(dropDefaultTraining ? { training_consent: false } : {}),
      ...(minor
        ? {
            minor_consent_source: "school",
            minor_consent_at: new Date().toISOString(),
            minor_consent_note: schoolId,
          }
        : {}),
    })
    .eq("id", user.id);
  if (uErr) return NextResponse.json({ error: clientError(uErr) }, { status: 500 });
  // The training decision is memoised for five minutes and just changed input.
  forgetOptionalProcessing(user.id);

  // School name for the confirmation UI.
  const { data: schoolData } = await schools
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName = ((schoolData ?? null) as SchoolRow | null)?.name ?? null;

  return NextResponse.json({
    schoolName,
    className: classRow.name,
    firstName,
    lastName,
  });
}
