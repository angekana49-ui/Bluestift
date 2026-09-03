import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getYearArchive } from "@/lib/school-admin";

/**
 * The school's record for one year: everything it produced and collected in the
 * app, not just its class list. Admin-master only, and the year is resolved
 * against the caller's own school — a year id in a query string is a claim.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const yearId = new URL(request.url).searchParams.get("yearId");
  if (!yearId) return NextResponse.json({ error: "yearId is required." }, { status: 400 });

  const archive = await getYearArchive(user.id, yearId);
  if (!archive) return NextResponse.json({ error: "Year not found." }, { status: 404 });
  return NextResponse.json(archive);
}
