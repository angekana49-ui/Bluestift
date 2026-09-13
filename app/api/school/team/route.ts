import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

/** Team view (subjects, profs, assignments) for an admin_master. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const team = await getTeam(user.id);
  if (!team) return NextResponse.json({ error: await apiT("api.adminOnly") }, { status: 403 });
  return NextResponse.json(team);
}
