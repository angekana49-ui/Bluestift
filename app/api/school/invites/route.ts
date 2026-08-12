import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

// Unambiguous alphabet (no 0/O/1/I). 8 chars — a staff code grants a personal
// membership, so more entropy than a 6-char class code.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = (len = 8) =>
  Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Generate a staff invite code for the admin_master's school. */
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

  let body: { autoApprove?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const autoApprove = body.autoApprove === true;

  const schools = createSchoolsAdminClient();
  // Insert a unique code (retry on the rare collision), like the class-code route.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const { data, error } = await schools
      .from("staff_invite_codes")
      .insert({
        school_id: membership.schoolId,
        code,
        auto_approve: autoApprove,
        is_active: true,
        created_by: membership.adminId,
      })
      .select("id, code, auto_approve, is_active")
      .single();
    if (!error) {
      const row = data as { id: string; code: string; auto_approve: boolean; is_active: boolean };
      return NextResponse.json({
        id: row.id,
        code: row.code,
        autoApprove: row.auto_approve,
        isActive: row.is_active,
      });
    }
    if (!/duplicate|unique|23505/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not allocate a unique code, try again." }, { status: 500 });
}

/** Activate / deactivate a staff invite code (admin_master of its school only). */
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

  let body: { codeId?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { codeId, isActive } = body;
  if (!codeId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "codeId and isActive are required." }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();
  // Scope the update to this admin's school so a foreign codeId can't be touched.
  const { data, error } = await schools
    .from("staff_invite_codes")
    .update({ is_active: isActive })
    .eq("id", codeId)
    .eq("school_id", membership.schoolId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Code not found." }, { status: 404 });
  return NextResponse.json({ id: codeId, isActive });
}
