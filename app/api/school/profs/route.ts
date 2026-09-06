import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";

/**
 * Add a prof to the admin_master's school BY EMAIL. The prof must already have a
 * Bluestift account.
 *
 * Email only, and username lookup is deliberately gone.
 *
 * Adding a teacher puts them on the team list, which shows their email address —
 * so a lookup that accepted a username turned this into a directory: type a
 * handle, add, read the address, remove. Anyone can create a school in one
 * signup, so "an admin" is not a small set of people. Requiring the email means
 * the caller already has the one thing this could have told them, and the
 * endpoint stops being able to reveal anything about an account nobody knew.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { identifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const identifier = (body.identifier ?? "").trim().toLowerCase().slice(0, 200);
  if (!identifier.includes("@")) {
    return NextResponse.json({ error: "Enter the teacher's email address." }, { status: 400 });
  }

  // Each attempt answers "does an account exist for this address", so the rate
  // limit is what stops the endpoint being walked through a list. Generous
  // against a real admin adding their staff one morning, useless for a sweep.
  if (!(await checkStrictUserRateLimit("school_prof_lookup", user.id, 40, "1 hour"))) {
    return NextResponse.json(
      { error: "Too many lookups — try again shortly." },
      { status: 429 },
    );
  }

  // Look up the user account (public.users is typed → typed admin client).
  // One equality lookup, not an interpolated PostgREST `.or()` filter.
  const admin = createAdminClient();
  const cols = "id, display_name, username, email";
  // Exact match on the lowercased address first — that is how Supabase Auth
  // stores it. The case-insensitive retry is for any row that predates that,
  // and `%`/`_` are refused above it because they are ilike wildcards, not
  // address characters: `%@%` would otherwise match a stranger's account.
  let { data: found } = await admin.from("users").select(cols).eq("email", identifier).maybeSingle();
  if (!found && !/[%_]/.test(identifier)) {
    ({ data: found } = await admin.from("users").select(cols).ilike("email", identifier).maybeSingle());
  }
  if (!found) {
    return NextResponse.json({ error: "No Bluestift account with that email." }, { status: 404 });
  }

  const schools = createSchoolsAdminClient();
  const { data: existing } = await schools
    .from("school_admins")
    .select("id")
    .eq("school_id", membership.schoolId)
    .eq("user_id", found.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That user is already in your school." }, { status: 409 });
  }

  const { data: created, error } = await schools
    .from("school_admins")
    .insert({ user_id: found.id, school_id: membership.schoolId, role: "prof" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });

  return NextResponse.json({
    adminId: (created as { id: string }).id,
    userId: found.id,
    name: found.display_name || found.username || "Prof",
    email: found.email,
  });
}

/** Remove a prof from the admin_master's school. Never removes an admin_master. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const adminId = new URL(request.url).searchParams.get("adminId");
  if (!adminId) return NextResponse.json({ error: "adminId is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  // Resolve and scope the membership BEFORE touching assignments. The previous
  // order let an admin from one school delete assignments belonging to an
  // arbitrary teacher id at another school.
  const { data: target } = await schools
    .from("school_admins")
    .select("id")
    .eq("id", adminId)
    .eq("school_id", membership.schoolId)
    .eq("role", "prof")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });

  // Drop the prof's assignments first in case the FK is not ON DELETE CASCADE.
  await schools.from("assignments").delete().eq("prof_id", adminId);

  // Scoped to this school and to role=prof so an admin_master can't be removed.
  const { data, error } = await schools
    .from("school_admins")
    .delete()
    .eq("id", adminId)
    .eq("school_id", membership.schoolId)
    .eq("role", "prof")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ ok: true, adminId });
}
