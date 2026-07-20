import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/school-admin";

/** One student's cognitive detail, for an admin of that student's class. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");
  const studentId = params.get("userId");
  if (!classId || !studentId) {
    return NextResponse.json({ error: "classId and userId are required." }, { status: 400 });
  }

  const detail = await getStudentDetail(user.id, studentId, classId);
  if (!detail) return NextResponse.json({ error: "Not found or not yours." }, { status: 404 });
  return NextResponse.json(detail);
}
