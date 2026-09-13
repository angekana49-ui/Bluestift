import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership, getSchoolOverview } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

/** School-wide roll-up (Établissement view) for the admin's school. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: await apiT("api.adminOnly") }, { status: 403 });
  }

  const overview = await getSchoolOverview(user.id);
  if (!overview) return NextResponse.json({ error: await apiT("api.noSchoolAdministered") }, { status: 403 });
  return NextResponse.json(overview);
}
