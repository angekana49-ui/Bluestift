import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

/**
 * Add a prof to the admin_master's school by email or username. The prof must
 * already have a Bluestift account.
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
  const identifier = (body.identifier ?? "").trim().slice(0, 200);
  if (!identifier) return NextResponse.json({ error: "An email or username is required." }, { status: 400 });

  // Look up the user account (public.users is typed → typed admin client).
  // Match on email first, then username — two equality lookups instead of
  // interpolating the raw identifier into a PostgREST `.or()` filter.
  const admin = createAdminClient();
  const cols = "id, display_name, username, email";
  let { data: found } = await admin.from("users").select(cols).eq("email", identifier).maybeSingle();
  if (!found) {
    ({ data: found } = await admin.from("users").select(cols).eq("username", identifier).maybeSingle());
  }
  if (!found) {
    return NextResponse.json({ error: "No Bluestift account with that email/username." }, { status: 404 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  // Drop the prof's assignments first in case the FK is not ON DELETE CASCADE.
  const schools = createSchoolsAdminClient();
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ ok: true, adminId });
}
