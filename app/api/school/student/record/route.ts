import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertClassAccess } from "@/lib/school-admin";
import { buildStudentRecord } from "@/lib/compliance/school-record";
import { recordDataRequest } from "@/lib/compliance/erasure";

/**
 * Download one student's education record (FERPA inspect-and-review).
 *
 * The right belongs to the parent or eligible student and is exercised against
 * the SCHOOL, not against us — we hold the record on the school's behalf. So
 * this endpoint serves the staff member who received the request, gated on the
 * same class access as the rest of the dashboard, and every use is written to
 * the data-request log with the student as its subject. FERPA asks schools to
 * keep a record of disclosures; this is where ours comes from.
 */
export const maxDuration = 60;

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

  if (!(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not found or not yours." }, { status: 404 });
  }

  const record = await buildStudentRecord({ studentUserId: studentId, classId });
  const partial = Array.isArray(record._errors) && record._errors.length > 0;

  await recordDataRequest({
    userId: studentId,
    kind: "access",
    channel: "school",
    outcome: partial ? "partial" : "fulfilled",
    // Who saw it, which is the part a disclosure log exists to answer.
    note: `class:${classId} | released_to_staff:${user.id}`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(record, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="student-record-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
