import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgeStatus } from "@/lib/compliance/gate";
import {
  ageBand,
  allowsOptionalProcessing,
  evaluateAccess,
  isPlausibleBirthYear,
} from "@/lib/compliance/age";
import { forgetOptionalProcessing } from "@/lib/compliance/optional-processing";
import { apiT } from "@/lib/i18n/server";
import { captureServer } from "@/lib/analytics/server";

/**
 * The age declaration (COPPA age screen / GDPR art. 8).
 *
 * GET  -> the server's current view of this account's age gate.
 * POST -> record a declared birth year, once.
 *
 * It has to be a server route rather than a client write because `birth_year`
 * is outside the column-level UPDATE whitelist on public.users. If the client
 * could write it, the gate would be advisory — a blocked child could simply
 * post a different year. Here the year comes in, the band is computed here,
 * and only the year is stored.
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = await getAgeStatus(user.id);
  return NextResponse.json({
    declared: status.declared,
    band: status.band,
    allowed: status.decision.allowed,
    reason: status.decision.allowed ? null : status.decision.reason,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { birthYear?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const birthYear = Number(body.birthYear);
  if (!isPlausibleBirthYear(birthYear)) {
    return NextResponse.json({ error: await apiT("api.enterTheYearYouWereBorn") }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("age_declared_at, school_id, minor_consent_source, training_consent_at")
    .eq("id", user.id)
    .maybeSingle();

  // One shot. An age screen you can retry until it lets you through is not an
  // age screen — a correction goes through support, where a human sees it.
  if (existing?.age_declared_at) {
    return NextResponse.json(
      { error: await apiT("api.yourAgeIsAlreadyOnFile") },
      { status: 409 },
    );
  }

  /**
   * This is where "on by default for adults" is actually applied.
   *
   * It cannot be a column default: the row is created at sign-up and the birth
   * year only arrives here, so at INSERT nobody's age is known and the storage
   * floor (migration 20260903100000) holds the column false until it is. An
   * adult's default therefore lands at the one moment we learn they are an
   * adult — which is also the first moment it could lawfully be granted.
   *
   * Only for an account that has never expressed a choice. `training_consent_at`
   * is the record of that, in either direction, so a "no" made earlier survives
   * declaring an age.
   *
   * And never for an account a school vouches for: the DPA promises schools
   * that their students' and staff's content trains nothing unless the account
   * holder explicitly opts in, so a school-linked adult starts OFF and chooses.
   */
  const isAdult = allowsOptionalProcessing(ageBand(birthYear));
  const grantDefault = isAdult && !existing?.training_consent_at && !existing?.school_id;

  const { data: stored, error } = await admin
    .from("users")
    .update({
      birth_year: birthYear,
      age_declared_at: new Date().toISOString(),
      ...(grantDefault ? { training_consent: true } : {}),
    })
    .eq("id", user.id)
    .select("id");
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });
  // No row, nothing stored — and every guarded page reads the year back from
  // that row. Answering "allowed" here sent the account onward to be gated
  // straight back to /onboarding.
  if (!stored?.length) {
    return NextResponse.json({ error: clientError(null, await apiT("api.yourProfileCouldNotBeFound")) }, { status: 500 });
  }

  // The band just changed, and the read path memoises it for five minutes.
  forgetOptionalProcessing(user.id);

  /**
   * `signed_up` is sent HERE, not where the account is created.
   *
   * At creation nobody's age is known, and the analytics gate treats an unknown
   * age as a minor's — so an event sent then is always dropped. This is the
   * first moment an account can be recorded at all: the age step, seconds into
   * onboarding. It carries the account's real creation time, so charts put the
   * sign-up on the day it happened.
   *
   * One shot like the declaration itself (the 409 above), so one event per
   * account. What it cannot see, by construction: anyone who leaves before the
   * age step, and every minor.
   */
  if (isAdult) {
    const createdAt = user.created_at ? new Date(user.created_at) : null;
    const known = createdAt && Number.isFinite(createdAt.getTime()) ? createdAt : undefined;
    void captureServer(
      user.id,
      "signed_up",
      {
        method: user.is_anonymous ? "anonymous" : (user.app_metadata?.provider ?? "email"),
        // An account made before the age question existed, asked it on return.
        declared_later: known ? Date.now() - known.getTime() > 24 * 60 * 60 * 1000 : false,
      },
      { timestamp: known },
    );
  }

  // Decided from what we just stored, alongside any school that already vouches
  // for this student — a child who joined a class first is not blocked.
  const decision = evaluateAccess({
    birthYear,
    schoolId: existing?.school_id ?? null,
    minorConsentSource: existing?.minor_consent_source ?? null,
  });

  return NextResponse.json({
    declared: true,
    band: decision.band,
    allowed: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
  });
}
