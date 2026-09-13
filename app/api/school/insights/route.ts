import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClassInsights, getSchoolDashboard, getSchoolSubjects } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

/** Kernel-certified class insights for an admin_master's school (read-only). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const insights = await getClassInsights(user.id);
  if (insights == null) return NextResponse.json({ error: await apiT("api.adminOnly") }, { status: 403 });
  const [subjects, dashboard] = await Promise.all([
    getSchoolSubjects(user.id),
    getSchoolDashboard(user.id),
  ]);
  const classes = (dashboard?.classes ?? []).map((c) => ({ id: c.id, name: c.name }));
  return NextResponse.json({ insights, subjects, classes });
}
