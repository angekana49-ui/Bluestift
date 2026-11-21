import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

type ShelfRow = {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  content: string;
  kind: string | null;
  class_id: string | null;
  subject_id: string | null;
  sent_by: string;
  sent_at: string;
  archived_at: string | null;
};

/**
 * GET → the school's shelf: frozen copies teachers chose to send up. An
 * admin sees everything (live + archived); a prof sees only what they sent,
 * so their library can show the "Sent" state on each item.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 });

  const schools = createSchoolsAdminClient();
  let listQuery = schools
    .from("school_library")
    .select("id, source_type, source_id, title, content, kind, class_id, subject_id, sent_by, sent_at, archived_at")
    .eq("school_id", membership.schoolId);
  if (membership.role !== "admin_master") listQuery = listQuery.eq("sent_by", membership.adminId);
  const { data } = await listQuery.order("sent_at", { ascending: false }).limit(100);
  const rows = (data as ShelfRow[] | null) ?? [];

  // Names for the shelf: who sent it, which class / subject it was made for.
  const senderIds = [...new Set(rows.map((r) => r.sent_by))];
  const sentByName = new Map<string, string>();
  if (senderIds.length) {
    const { data: adminData } = await schools.from("school_admins").select("id, user_id").in("id", senderIds);
    const admins = (adminData as { id: string; user_id: string }[] | null) ?? [];
    const admin = createAdminClient();
    const { data: us } = await admin
      .from("users")
      .select("id, display_name, username")
      .in("id", admins.map((a) => a.user_id));
    const nameByUser = new Map(
      ((us ?? []) as { id: string; display_name: string | null; username: string | null }[]).map((u) => [
        u.id,
        u.display_name || u.username || "Member",
      ]),
    );
    for (const a of admins) sentByName.set(a.id, nameByUser.get(a.user_id) ?? "Member");
  }
  const [{ data: classData }, { data: subjData }] = await Promise.all([
    schools.from("classes").select("id, name").eq("school_id", membership.schoolId),
    schools.from("subjects").select("id, name").or(`school_id.eq.${membership.schoolId},is_global.eq.true`),
  ]);
  const classById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const subjById = new Map(((subjData as { id: string; name: string }[] | null) ?? []).map((s) => [s.id, s.name]));

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      title: r.title,
      content: r.content,
      kind: r.kind,
      className: r.class_id ? classById.get(r.class_id) ?? null : null,
      subjectName: r.subject_id ? subjById.get(r.subject_id) ?? null : null,
      sentBy: sentByName.get(r.sent_by) ?? "Member",
      sentAt: r.sent_at,
      archivedAt: r.archived_at,
    })),
  });
}

/**
 * POST { type: "prepare" | "report", id } → freeze a copy of one of the
 * caller's own items onto the school shelf. Prof authors only: sending is a
 * teacher's decision, and the frozen copy survives whatever happens to the
 * original afterwards (edit, archive, delete). Sending twice refreshes the
 * snapshot instead of stacking duplicates.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 });
  if (membership.role !== "prof") {
    return NextResponse.json({ error: await apiT("api.teachersOnly") }, { status: 403 });
  }

  let body: { type?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const type = body.type === "prepare" || body.type === "report" ? body.type : null;
  const id = body.id;
  if (!type || !id) return NextResponse.json({ error: "type and id are required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  let snapshot: {
    title: string;
    content: string;
    kind: string | null;
    payload: unknown;
    class_id: string | null;
    subject_id: string | null;
  } | null = null;
  if (type === "prepare") {
    const { data: res } = await schools
      .from("teacher_resources")
      .select("id, school_id, created_by, title, content, questions, kind, class_id, subject_id")
      .eq("id", id)
      .maybeSingle();
    const row = res as {
      school_id: string;
      created_by: string;
      title: string;
      content: string;
      questions: unknown;
      kind: string;
      class_id: string | null;
      subject_id: string | null;
    } | null;
    if (!row || row.school_id !== membership.schoolId) {
      return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
    }
    if (row.created_by !== membership.adminId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    snapshot = {
      title: row.title,
      content: row.content,
      kind: row.kind,
      payload: { questions: row.questions ?? [] },
      class_id: row.class_id,
      subject_id: row.subject_id,
    };
  } else {
    const { data: rep } = await schools
      .from("reports")
      .select("id, school_id, created_by, scope, parameters")
      .eq("id", id)
      .maybeSingle();
    const row = rep as {
      school_id: string;
      created_by: string;
      scope: string | null;
      parameters: unknown;
    } | null;
    if (!row || row.school_id !== membership.schoolId) {
      return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
    }
    if (row.created_by !== membership.adminId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const p = (row.parameters ?? {}) as { title?: string; content?: string; classId?: string; subjectId?: string };
    snapshot = {
      title: p.title ?? "Report",
      content: p.content ?? "",
      kind: row.scope,
      payload: { parameters: row.parameters ?? {} },
      class_id: p.classId ?? null,
      subject_id: p.subjectId ?? null,
    };
  }

  // One live copy per source: re-sending refreshes the frozen snapshot.
  const { data: existing } = await schools
    .from("school_library")
    .select("id")
    .eq("school_id", membership.schoolId)
    .eq("source_type", type)
    .eq("source_id", id)
    .is("archived_at", null)
    .maybeSingle();
  const liveId = (existing as { id: string } | null)?.id ?? null;
  const sentAt = new Date().toISOString();
  if (liveId) {
    const { error: updErr } = await schools
      .from("school_library")
      .update({ ...snapshot, sent_at: sentAt })
      .eq("id", liveId);
    if (updErr) return NextResponse.json({ error: clientError(updErr) }, { status: 500 });
    return NextResponse.json({ ok: true, id: liveId, sentAt });
  }
  const { data: inserted, error: insErr } = await schools
    .from("school_library")
    .insert({
      school_id: membership.schoolId,
      source_type: type,
      source_id: id,
      ...snapshot,
      sent_by: membership.adminId,
      sent_at: sentAt,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: clientError(insErr) }, { status: 500 });
  return NextResponse.json({ ok: true, id: (inserted as { id: string }).id, sentAt });
}

/**
 * PATCH { id, action: "archive" | "unarchive" } → file a shelf item away (or
 * bring it back). Admin only, and archive only: the school side never
 * hard-deletes — there is no DELETE here on purpose.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: await apiT("api.adminOnly") }, { status: 403 });
  }

  let body: { id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (body.action !== "archive" && body.action !== "unarchive") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();
  const { data: item } = await schools.from("school_library").select("id, school_id").eq("id", id).maybeSingle();
  const row = item as { school_id: string } | null;
  if (!row || row.school_id !== membership.schoolId) {
    return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
  }

  const archived_at = body.action === "archive" ? new Date().toISOString() : null;
  const { error: updErr } = await schools.from("school_library").update({ archived_at }).eq("id", id);
  if (updErr) return NextResponse.json({ error: clientError(updErr) }, { status: 500 });

  return NextResponse.json({ ok: true, archivedAt: archived_at });
}
