import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getStaffPreferences, type StaffPreferences } from "@/lib/school-admin";

/**
 * Per-staff teaching preferences (default class/subject, report tone, whether
 * generated exams focus on the class's weak concepts). Keyed by the caller's
 * active school_admins row. Read/write only through the service role.
 */

/** GET → the caller's preferences (merged with defaults). */
export async function GET() {
  const { user, error } = await authStaff();
  if (error) return error;
  const prefs = await getStaffPreferences(user.id);
  return NextResponse.json({ prefs });
}

/** PATCH { prefs } → merge and persist the caller's preferences. */
export async function PATCH(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  let body: { prefs?: Partial<StaffPreferences> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const incoming = body.prefs ?? {};

  // Whitelist + coerce every field — never persist arbitrary client JSON.
  const current = await getStaffPreferences(user.id);
  const next: StaffPreferences = {
    defaultClassId:
      "defaultClassId" in incoming ? strOrNull(incoming.defaultClassId) : current.defaultClassId,
    defaultSubjectId:
      "defaultSubjectId" in incoming ? strOrNull(incoming.defaultSubjectId) : current.defaultSubjectId,
    reportTone: "reportTone" in incoming ? strOrNull(incoming.reportTone) : current.reportTone,
    examFocusWeakConcepts:
      "examFocusWeakConcepts" in incoming
        ? Boolean(incoming.examFocusWeakConcepts)
        : current.examFocusWeakConcepts,
  };

  const schools = createSchoolsAdminClient();
  const { error: upErr } = await schools
    .from("staff_preferences")
    .upsert({ admin_id: membership.adminId, prefs: next, updated_at: new Date().toISOString() });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ prefs: next });
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, 120) : null;
}

async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const membership = await getAdminMembership(user.id);
  if (!membership) return { error: NextResponse.json({ error: "School staff only." }, { status: 403 }) } as const;
  return { user, membership, error: null } as const;
}
