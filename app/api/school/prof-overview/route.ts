import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfOverview } from "@/lib/school-admin";

/** A teacher's home aggregate: their classes + at-risk feed (read-only). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const overview = await getProfOverview(user.id);
  if (!overview) return NextResponse.json({ error: "School staff only." }, { status: 403 });
  return NextResponse.json({ overview });
}
