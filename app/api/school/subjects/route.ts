import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getSchoolSubjects } from "@/lib/school-admin";

/** List the subjects available to the caller's school (any staff). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  const subjects = await getSchoolSubjects(user.id);
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
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { name?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "A subject name is required." }, { status: 400 });
  const code = (body.code ?? "").trim().toUpperCase().slice(0, 16) || null;

  const schools = createSchoolsAdminClient();
  const { data, error } = await schools
    .from("subjects")
    .insert({ name, code, is_global: false, school_id: membership.schoolId })
    .select("id, name, code")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data as { id: string; name: string; code: string | null };
  return NextResponse.json({ id: row.id, name: row.name, code: row.code });
}
