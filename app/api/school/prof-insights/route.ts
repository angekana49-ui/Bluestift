import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership, getProfInsights } from "@/lib/school-admin";
import { apiT } from "@/lib/i18n/server";

/** Certified insights + at-risk students for the caller's assigned classes. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 });

  const data = await getProfInsights(user.id);
  if (!data) return NextResponse.json({ error: await apiT("api.noData") }, { status: 403 });
  return NextResponse.json(data);
}
