import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getLmsConnections, LMS_PROVIDERS } from "@/lib/school-admin";

/**
 * LMS connection registry. Real provider OAuth/sync is NOT wired yet — a
 * connection is a manual record (sync_status = idle) that a future sync job
 * would drive. Admin_master only.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const connections = await getLmsConnections(user.id);
  if (connections == null) return NextResponse.json({ error: "Admin only." }, { status: 403 });
  return NextResponse.json({ connections });
}

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

  let body: { provider?: string; externalOrgName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const provider = body.provider ?? "";
  if (!(LMS_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: "Unknown LMS provider." }, { status: 400 });
  }
  const externalOrgName = (body.externalOrgName ?? "").trim().slice(0, 120) || null;

  const schools = createSchoolsAdminClient();
  const { data, error } = await schools
    .from("lms_connections")
    .insert({
      school_id: membership.schoolId,
      provider,
      external_org_name: externalOrgName,
      sync_status: "idle",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: (data as { id: string }).id,
    provider,
    externalOrgName,
    isActive: true,
    syncStatus: "idle",
    lastSyncedAt: null,
    mappings: [],
  });
}

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

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const schools = createSchoolsAdminClient();
  // Only within the admin's own school.
  const { data: conn } = await schools
    .from("lms_connections")
    .select("id")
    .eq("id", id)
    .eq("school_id", membership.schoolId)
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

  await schools.from("lms_class_mappings").delete().eq("lms_connection_id", id);
  const { error } = await schools.from("lms_connections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
