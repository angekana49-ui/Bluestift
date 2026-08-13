import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ageBand, allowsOptionalProcessing } from "@/lib/compliance/age";

/**
 * The "use my content to improve Raya" opt-in.
 *
 * It lives behind a server route rather than a direct table write because
 * `training_consent` is no longer in the client's column-level UPDATE whitelist
 * — a minor must not be able to grant it, and a checkbox the client can write
 * straight to the database is a checkbox that enforces nothing.
 *
 * Off by default, and off for every minor whatever the request says.
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
      training_consent_at: body.consent ? new Date().toISOString() : null,
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, consent: body.consent });
}
