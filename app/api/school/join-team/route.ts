import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { setActiveSchoolCookie } from "@/lib/school-active";
import { hasRealEmail } from "@/lib/auth";
import { sendBrandedEmail, getUserEmail, siteUrl } from "@/lib/email";
import { checkStrictRateLimit } from "@/lib/rate-limit";

// Local shapes for the untyped `schools` schema.
type CodeRow = { id: string; school_id: string; auto_approve: boolean };
type SchoolRow = { name: string };

/**
 * Tell the school's admin(s) a teacher is waiting for approval — otherwise the
 * request sits invisible until someone happens to open the dashboard. Best-effort:
 * fans out to every admin_master with a real email; sendEmail never throws.
 */
async function notifyAdminsOfRequest(
  schools: ReturnType<typeof createSchoolsAdminClient>,
  schoolId: string,
  schoolName: string | null,
  requesterEmail: string | null,
) {
  const { data } = await schools
    .from("school_admins")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin_master");
  const adminIds = ((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  const name = schoolName ?? "your school";
  const who = requesterEmail ? `${requesterEmail} ` : "A teacher ";
  const email = {
    subject: `New request to join ${name}`,
    heading: `New request to join ${name}`,
    lines: [
      `${who}asked to join ${name} on Bluestift Schools and is waiting for your approval.`,
      "Open the Team page to approve or decline the request.",
    ],
    cta: { label: "Review requests", url: `${siteUrl("schools")}/school` },
  };
  await Promise.all(
    adminIds.map(async (id) => {
      const to = await getUserEmail(id);
      if (to) await sendBrandedEmail({ brand: "schools", to, ...email });
    }),
  );
}

/**
 * A signed-in teacher redeems a staff invite code.
 *  - auto_approve code → instant `prof` membership  → { status: 'joined' }
 *  - otherwise         → a pending join request      → { status: 'requested' }
 *  - already a member  → no-op                        → { status: 'already' }
 * Identity comes from the session; the client only supplies the code.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Staff gate: joining a school as a teacher requires a verified email —
  // anonymous accounts are for basic learners only. (Students join their CLASS
  // by code anonymously through /api/school/join, which stays open.)
  if (!hasRealEmail(user.email)) {
    return NextResponse.json(
      {
        error: "Add a verified email before joining a school as a teacher. You can link it in Settings.",
        code: "email_required",
      },
      { status: 403 },
    );
  }
  if (!(await checkStrictRateLimit(`school_staff_join:u:${user.id}`, "0.0.0.0", 20))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "A code is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();

  // Resolve the active code → school (service_role; teachers can't read codes).
  const { data: codeData } = await schools
    .from("staff_invite_codes")
    .select("id, school_id, auto_approve")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  const codeRow = (codeData ?? null) as CodeRow | null;
  if (!codeRow) {
    return NextResponse.json({ error: "Invalid or inactive code." }, { status: 404 });
  }

  const schoolName = await schoolNameOf(schools, codeRow.school_id);

  // Already a member of this school? Idempotent no-op.
  const { data: existing } = await schools
    .from("school_admins")
    .select("id")
    .eq("school_id", codeRow.school_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    // Already a member — make it the active school so they land in it.
    await setActiveSchoolCookie(codeRow.school_id);
    return NextResponse.json({ status: "already", schoolName });
  }

  if (codeRow.auto_approve) {
    const { error } = await schools
      .from("school_admins")
      .insert({ user_id: user.id, school_id: codeRow.school_id, role: "prof" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Land the teacher in the school they just joined.
    await setActiveSchoolCookie(codeRow.school_id);
    return NextResponse.json({ status: "joined", schoolName });
  }

  // Approval required. The unique index is partial (pending only), so it can't
  // arbitrate an ON CONFLICT upsert — check then insert, and treat the rare race
  // (23505 on the partial index) as "already requested".
  const { data: pending } = await schools
    .from("school_join_requests")
    .select("id")
    .eq("school_id", codeRow.school_id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) return NextResponse.json({ status: "requested", schoolName });

  const { error } = await schools.from("school_join_requests").insert({
    school_id: codeRow.school_id,
    user_id: user.id,
    code_id: codeRow.id,
    status: "pending",
  });
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return NextResponse.json({ status: "requested", schoolName });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fresh request — let the admins know, after the response is sent.
  after(() => notifyAdminsOfRequest(schools, codeRow.school_id, schoolName, user.email ?? null));

  return NextResponse.json({ status: "requested", schoolName });
}

async function schoolNameOf(
  schools: ReturnType<typeof createSchoolsAdminClient>,
  schoolId: string,
): Promise<string | null> {
  const { data } = await schools.from("schools").select("name").eq("id", schoolId).maybeSingle();
  return ((data ?? null) as SchoolRow | null)?.name ?? null;
}
