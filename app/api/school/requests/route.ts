import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { sendBrandedEmail, getUserEmail, siteUrl } from "@/lib/email";

/** Tell a teacher their join request was decided (best-effort, non-blocking). */
async function notifyDecision(teacherUserId: string, schoolName: string, approved: boolean) {
  const to = await getUserEmail(teacherUserId);
  if (!to) return;
  const email = approved
    ? {
        subject: `You've joined ${schoolName}`,
        heading: `You've joined ${schoolName}`,
        lines: [
          `Your request to join ${schoolName} on Bluestift Schools was approved.`,
          "You can now open the school dashboard and start working with your classes.",
        ],
        cta: { label: "Open your dashboard", url: `${siteUrl("schools")}/school` },
      }
    : {
        subject: `Your request to ${schoolName}`,
        heading: `Update on your request to ${schoolName}`,
        lines: [
          `Your request to join ${schoolName} on Bluestift Schools wasn't approved this time.`,
          "If you think this is a mistake, reach out to your school administrator.",
        ],
      };
  await sendBrandedEmail({ brand: "schools", to, ...email });
}

type RequestRow = { id: string; school_id: string; user_id: string; status: string };

/**
 * Decide a pending join request (admin_master only). Approving inserts the
 * teacher as a `prof` of the school; rejecting just records the decision.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { requestId?: string; action?: "approve" | "reject" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { requestId, action } = body;
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "requestId and a valid action are required." }, { status: 400 });
  }

  const schools = createSchoolsAdminClient();
  const { data: reqData } = await schools
    .from("school_join_requests")
    .select("id, school_id, user_id, status")
    .eq("id", requestId)
    .maybeSingle();
  const reqRow = (reqData ?? null) as RequestRow | null;
  if (!reqRow || reqRow.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "That request was already decided." }, { status: 409 });
  }

  let adminId: string | null = null;
  if (action === "approve") {
    // Idempotent membership: reuse the row if they somehow already joined.
    const { data: existing } = await schools
      .from("school_admins")
      .select("id")
      .eq("school_id", reqRow.school_id)
      .eq("user_id", reqRow.user_id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      adminId = (existing as { id: string }).id;
    } else {
      const { data: created, error } = await schools
        .from("school_admins")
        .insert({ user_id: reqRow.user_id, school_id: reqRow.school_id, role: "prof" })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      adminId = (created as { id: string }).id;
    }
  }

  const { error: updErr } = await schools
    .from("school_join_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      decided_by: membership.adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Let the teacher know the outcome. Awaited (not fire-and-forget) so it isn't
  // dropped when the serverless function ends; sendEmail never throws.
  await notifyDecision(reqRow.user_id, membership.schoolName, action === "approve");

  return NextResponse.json({
    id: requestId,
    status: action === "approve" ? "approved" : "rejected",
    adminId,
  });
}
