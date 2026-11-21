import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getViewerSubjects } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

/** List the caller's pickable subjects: all school subjects for an admin, assigned-only for a prof. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 });

  const subjects = await getViewerSubjects(user.id);
  return NextResponse.json({ subjects });
}

/** Create a subject for the admin_master's school. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: await apiT("api.adminOnly") }, { status: 403 });
  }

  let body: { name?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: await apiT("api.aSubjectNameIsRequired") }, { status: 400 });
  const code = (body.code ?? "").trim().toUpperCase().slice(0, 16) || null;

  const schools = createSchoolsAdminClient();
  const { data, error } = await schools
    .from("subjects")
    .insert({ name, code, is_global: false, school_id: membership.schoolId })
    .select("id, name, code")
    .single();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });

  const row = data as { id: string; name: string; code: string | null };
  return NextResponse.json({ id: row.id, name: row.name, code: row.code });
}
