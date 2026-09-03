import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getSchoolYears, rotateStaffCodeForYear } from "@/lib/school-admin";
import { academicYear } from "@/lib/school-constants";

/**
 * Every year the school has on record — the year picker above "Classes & codes".
 * Past years are how an admin reaches the archive, so this is what makes a
 * rolled-over class findable instead of looking deleted.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  return NextResponse.json({ years: await getSchoolYears(user.id) });
}

/** The start year of the next academic year, derived from the active one's label. */
function nextStartYear(activeLabel: string | null): number {
  const m = activeLabel?.match(/(\d{4})/);
  if (m) return Number(m[1]) + 1;
  // No parseable active year — base it on today (Aug+ starts the new year).
  const now = new Date();
  return (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1) + 1;
}

/**
 * Start a new academic year for the admin's school. The previous year is
 * deactivated and archived (its classes/students stay under it); the new year
 * becomes current and starts empty — nothing is copied forward.
 */
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

  // Label of the current active year, to derive the next one.
  const { data: cur } = await schools
    .from("school_years")
    .select("id, label")
    .eq("school_id", membership.schoolId)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeLabel = (cur as { label: string | null } | null)?.label ?? null;

  const year = academicYear(nextStartYear(activeLabel));

  // Create-or-activate the next year, deactivate the rest, repoint the school —
  // one atomic transaction, so concurrent calls can't leave two active years.
  const { data, error } = await schools.rpc("set_active_school_year", {
    p_school_id: membership.schoolId,
    p_label: year.label,
    p_start: year.start_date,
    p_end: year.end_date,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = ((data as { out_id: string; out_label: string }[] | null) ?? [])[0];
  if (!row) return NextResponse.json({ error: "Could not start the year." }, { status: 500 });

  // Same staff roll as the automatic rollover: last year's codes stop working and
  // the year gets a fresh one for returning teachers to enter.
  const staff = await rotateStaffCodeForYear(membership.schoolId, row.out_id);

  return NextResponse.json({ id: row.out_id, label: row.out_label, staffCode: staff?.code ?? null });
}
