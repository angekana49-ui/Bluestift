import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership, getSchoolOverview } from "@/lib/school-admin";

/** School-wide roll-up (Établissement view) for the admin's school. */
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

  const overview = await getSchoolOverview(user.id);
  if (!overview) return NextResponse.json({ error: "You don't administer a school." }, { status: 403 });
  return NextResponse.json(overview);
}
