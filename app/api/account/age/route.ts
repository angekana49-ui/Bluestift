import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgeStatus } from "@/lib/compliance/gate";
import { evaluateAccess, isPlausibleBirthYear } from "@/lib/compliance/age";

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
    return NextResponse.json({ error: "Enter the year you were born." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("age_declared_at, school_id, minor_consent_source")
    .eq("id", user.id)
    .maybeSingle();

  // One shot. An age screen you can retry until it lets you through is not an
  // age screen — a correction goes through support, where a human sees it.
  if (existing?.age_declared_at) {
    return NextResponse.json(
      { error: "Your age is already on file. Contact support if it needs correcting." },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("users")
    .update({ birth_year: birthYear, age_declared_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
