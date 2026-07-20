import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClassRoster } from "@/lib/school-admin";

/** Roster (with per-student risk) of a class the caller administers. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });

  const roster = await getClassRoster(user.id, classId);
  if (!roster) return NextResponse.json({ error: "Class not found or not yours." }, { status: 404 });
  return NextResponse.json(roster);
}
