import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { listCourses, refreshAccessToken } from "@/lib/lms/google";

type Conn = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

/** Pull Google Classroom courses into lms_class_mappings (class_id stays null until mapped). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const schools = createSchoolsAdminClient();
  const { data: connData } = await schools
    .from("lms_connections")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("school_id", membership.schoolId)
    .eq("provider", "google_classroom")
    .maybeSingle();
  const conn = connData as Conn | null;
  if (!conn) return NextResponse.json({ error: "Google Classroom is not connected." }, { status: 404 });

  // Refresh the access token if it's missing or expiring within a minute.
  let accessToken = conn.access_token ?? "";
  const expired = !conn.token_expires_at || new Date(conn.token_expires_at).getTime() - Date.now() < 60_000;
  if (expired) {
    if (!conn.refresh_token) {
      return NextResponse.json({ error: "Session expired — reconnect Google Classroom." }, { status: 401 });
    }
    try {
      const t = await refreshAccessToken(conn.refresh_token);
      accessToken = t.access_token;
      await schools
        .from("lms_connections")
        .update({
          access_token: t.access_token,
          token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
        })
        .eq("id", conn.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 80) : "refresh failed" }, { status: 502 });
    }
  }

  let courses;
  try {
    courses = await listCourses(accessToken);
  } catch (e) {
    await schools.from("lms_connections").update({ sync_status: "failed", sync_error: String(e).slice(0, 200) }).eq("id", conn.id);
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 120) : "sync failed" }, { status: 502 });
  }

  // Reconcile: insert mappings for new courses, keep existing (and their class_id) as-is.
  const { data: existingMaps } = await schools
    .from("lms_class_mappings")
    .select("external_class_id")
    .eq("lms_connection_id", conn.id);
  const known = new Set(((existingMaps as { external_class_id: string }[] | null) ?? []).map((m) => m.external_class_id));

  const toInsert = courses
    .filter((c) => !known.has(c.id))
    .map((c) => ({
      lms_connection_id: conn.id,
      external_class_id: c.id,
      external_class_name: [c.name, c.section].filter(Boolean).join(" · "),
      class_id: null,
    }));
  if (toInsert.length) await schools.from("lms_class_mappings").insert(toInsert);

  await schools
    .from("lms_connections")
    .update({ sync_status: "idle", sync_error: null, last_synced_at: new Date().toISOString() })
    .eq("id", conn.id);

  return NextResponse.json({ imported: toInsert.length, total: courses.length });
}
