import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ageBand, allowsOptionalProcessing } from "@/lib/compliance/age";
import { forgetOptionalProcessing } from "@/lib/compliance/optional-processing";

/**
 * The "use my content to improve Raya" opt-in.
 *
 * It lives behind a server route rather than a direct table write because
 * `training_consent` is no longer in the client's column-level UPDATE whitelist
 * — a minor must not be able to grant it, and a checkbox the client can write
 * straight to the database is a checkbox that enforces nothing.
 *
 * ON by default for adults, and off for every minor whatever the request says.
 * The default changed on 2026-08-13; the band rule did not, and must not — a
 * minor cannot grant this, so there is no version of "on by default" for them.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { consent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.consent !== "boolean") {
    return NextResponse.json({ error: "consent must be true or false" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("users")
    .select("birth_year")
    .eq("id", user.id)
    .maybeSingle();

  // Withdrawal is always allowed — that's what makes the original consent free.
  // Granting is what the band gates.
  if (body.consent && !allowsOptionalProcessing(ageBand(row?.birth_year ?? null))) {
    return NextResponse.json(
      { error: "This option isn't available on accounts belonging to under-18s." },
      { status: 403 },
    );
  }

  const { error } = await admin
    .from("users")
    .update({
      training_consent: body.consent,
      // Stamped on BOTH directions. It used to be nulled on withdrawal, which
      // was harmless while the column was opt-in — but now that the default is
      // on, "no timestamp" means "never chose", and a backfill would read a
      // withdrawal as an untouched account and switch it back on. The timestamp
      // is what makes a "no" durable.
      training_consent_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The decision is memoised for five minutes on the read path; without this
  // the switch appears to do nothing for the rest of that window.
  forgetOptionalProcessing(user.id);

  return NextResponse.json({ ok: true, consent: body.consent });
}
