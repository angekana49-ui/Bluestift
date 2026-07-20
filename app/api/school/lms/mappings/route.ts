import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

/** Map an external LMS class to an internal class (admin_master only). */
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

  let body: { connectionId?: string; externalClassId?: string; externalClassName?: string; classId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { connectionId, classId } = body;
  const externalClassId = (body.externalClassId ?? "").trim().slice(0, 120);
  const externalClassName = (body.externalClassName ?? "").trim().slice(0, 120) || null;
  if (!connectionId || !externalClassId || !classId) {
    return NextResponse.json({ error: "connectionId, externalClassId and classId are required." }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();
  const [{ data: conn }, { data: cls }] = await Promise.all([
    schools.from("lms_connections").select("id").eq("id", connectionId).eq("school_id", membership.schoolId).maybeSingle(),
    schools.from("classes").select("id, name").eq("id", classId).eq("school_id", membership.schoolId).maybeSingle(),
  ]);
  if (!conn) return NextResponse.json({ error: "Unknown connection." }, { status: 404 });
  if (!cls) return NextResponse.json({ error: "Unknown class." }, { status: 404 });

  const { data, error } = await schools
    .from("lms_class_mappings")
    .insert({
      lms_connection_id: connectionId,
      external_class_id: externalClassId,
      external_class_name: externalClassName,
      class_id: classId,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: (data as { id: string }).id,
    externalClassId,
    externalClassName,
    classId,
    className: (cls as { name: string }).name,
  });
}

/** Assign (or change) the internal class of a mapping — e.g. a synced course. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { id?: string; classId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { id, classId } = body;
  if (!id || !classId) return NextResponse.json({ error: "id and classId are required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: map } = await schools
    .from("lms_class_mappings")
    .select("id, lms_connection_id")
    .eq("id", id)
    .maybeSingle();
  const connId = (map as { lms_connection_id?: string } | null)?.lms_connection_id;
  if (!connId) return NextResponse.json({ error: "Mapping not found." }, { status: 404 });

  const [{ data: conn }, { data: cls }] = await Promise.all([
    schools.from("lms_connections").select("id").eq("id", connId).eq("school_id", membership.schoolId).maybeSingle(),
    schools.from("classes").select("id, name").eq("id", classId).eq("school_id", membership.schoolId).maybeSingle(),
  ]);
  if (!conn) return NextResponse.json({ error: "Not yours." }, { status: 403 });
  if (!cls) return NextResponse.json({ error: "Unknown class." }, { status: 404 });

  const { error } = await schools.from("lms_class_mappings").update({ class_id: classId }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, classId, className: (cls as { name: string }).name });
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
  // Ensure the mapping's connection belongs to this school before deleting.
  const { data: map } = await schools
    .from("lms_class_mappings")
    .select("id, lms_connection_id")
    .eq("id", id)
    .maybeSingle();
  const connId = (map as { lms_connection_id?: string } | null)?.lms_connection_id;
  if (!connId) return NextResponse.json({ error: "Mapping not found." }, { status: 404 });
  const { data: conn } = await schools
    .from("lms_connections")
    .select("id")
    .eq("id", connId)
    .eq("school_id", membership.schoolId)
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: "Not yours." }, { status: 403 });

  const { error } = await schools.from("lms_class_mappings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
