import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

const AUDIENCES = ["students", "teachers", "both"] as const;
type Audience = (typeof AUDIENCES)[number];

type DirectiveRow = { id: string; content: string; audience: string; is_active: boolean };

/**
 * School-wide directives the admin broadcasts through Raya. GET is role-aware
 * (admin manages all; a prof reads the teacher-facing active ones); writes are
 * admin_master only.
 */
export async function GET() {
  const { membership, error } = await authStaff();
  if (error) return error;

  const schools = createSchoolsAdminClient();
  let q = schools
    .from("school_directives")
    .select("id, content, audience, is_active")
    .eq("school_id", membership.schoolId)
    .order("updated_at", { ascending: false });
  if (membership.role !== "admin_master") {
    // A prof only reads active directives meant for teachers.
    q = q.eq("is_active", true).in("audience", ["teachers", "both"]);
  }
  const { data } = await q;
  const directives = ((data as DirectiveRow[] | null) ?? []).map((d) => ({
    id: d.id,
    content: d.content,
    audience: d.audience,
    isActive: d.is_active,
  }));
  return NextResponse.json({ directives });
}

/** POST { content, audience } → create (admin_master only). */
export async function POST(request: Request) {
  const { membership, error } = await authAdmin();
  if (error) return error;

  let body: { content?: string; audience?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim().slice(0, 500);
  const audience = (AUDIENCES as readonly string[]).includes(body.audience ?? "")
    ? (body.audience as Audience)
    : "both";
  if (!content) return NextResponse.json({ error: "Directive text is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data, error: insErr } = await schools
    .from("school_directives")
    .insert({
      school_id: membership.schoolId,
      audience,
      content,
      created_by: membership.adminId,
      is_active: true,
    })
    .select("id, content, audience, is_active")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const row = data as DirectiveRow;
  return NextResponse.json({ id: row.id, content: row.content, audience: row.audience, isActive: row.is_active });
}

/** PATCH { id, isActive?, content?, audience? } → edit / toggle (admin_master only). */
export async function PATCH(request: Request) {
  const { membership, error } = await authAdmin();
  if (error) return error;

  let body: { id?: string; isActive?: boolean; content?: string; audience?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const patch: { is_active?: boolean; content?: string; audience?: Audience; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.content === "string") patch.content = body.content.trim().slice(0, 500);
  if ((AUDIENCES as readonly string[]).includes(body.audience ?? "")) patch.audience = body.audience as Audience;

  const schools = createSchoolsAdminClient();
  const { data, error: updErr } = await schools
    .from("school_directives")
    .update(patch)
    .eq("id", id)
    .eq("school_id", membership.schoolId)
    .select("id")
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Directive not found." }, { status: 404 });
  return NextResponse.json({ ok: true, id });
}

/** DELETE ?id= → remove (admin_master only). */
export async function DELETE(request: Request) {
  const { membership, error } = await authAdmin();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data, error: delErr } = await schools
    .from("school_directives")
    .delete()
    .eq("id", id)
    .eq("school_id", membership.schoolId)
    .select("id")
    .maybeSingle();
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Directive not found." }, { status: 404 });
  return NextResponse.json({ ok: true, id });
}

async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const membership = await getAdminMembership(user.id);
  if (!membership) return { error: NextResponse.json({ error: "School staff only." }, { status: 403 }) } as const;
  return { membership, error: null } as const;
}

async function authAdmin() {
  const res = await authStaff();
  if (res.error) return res;
  if (res.membership.role !== "admin_master") {
    return { error: NextResponse.json({ error: "Admin only." }, { status: 403 }) } as const;
  }
  return res;
}
