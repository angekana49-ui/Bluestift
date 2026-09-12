import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { hasRealEmail } from "@/lib/auth";
import { notifyAdminsOfRequest } from "@/lib/school-join";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A school can be reached through at most this many matches per request. */
const MAX_SCHOOLS = 3;

/** `ilike` without its wildcards: an address is matched whole, never as a pattern. */
function literal(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * A teacher with no staff code asks their school directly.
 *
 * They name the school by an address they already know: the school's contact
 * email, or their administrator's. Any school matching either gets a pending
 * join request (no code attached) and its admins are emailed. This is the same
 * queue an approval-required code feeds, so the admin approves it where they
 * approve everything else.
 *
 * The answer is ALWAYS `{ status: "sent" }`, match or not. Anything else would
 * turn this form into a way to test which addresses belong to a school, and
 * which schools use Bluestift. The teacher is told the request went out "if a
 * school matches", which is true either way.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasRealEmail(user.email)) {
    return NextResponse.json(
      { error: "Add a verified email before joining a school as a teacher.", code: "email_required" },
      { status: 403 },
    );
  }
  if (!(await checkStrictUserRateLimit("school_request_access", user.id, 5, "60 minutes"))) {
    return NextResponse.json({ error: "Too many requests. Please try again later.", code: "rate_limited" }, { status: 429 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter your school's or your administrator's email." }, { status: 400 });
  }

  // All the work happens after the response. A match does lookups, inserts and
  // email a miss doesn't, so answering only once it was done would let response
  // TIME say what the body is careful not to.
  const requester = { id: user.id, email: user.email ?? null };
  after(() => fileRequests(requester, email));
  return NextResponse.json({ status: "sent" });
}

async function fileRequests(user: { id: string; email: string | null }, email: string): Promise<void> {
  const schools = createSchoolsAdminClient();
  const pattern = literal(email);

  // 1) Schools whose contact address this is.
  const { data: bySchool } = await schools.from("schools").select("id").ilike("email", pattern).limit(MAX_SCHOOLS);
  // 2) Schools whose admin_master signs in with it.
  const { data: people } = await createAdminClient().from("users").select("id").ilike("email", pattern).limit(1);
  const adminUserIds = ((people as { id: string }[] | null) ?? []).map((p) => p.id);
  const { data: byAdmin } = adminUserIds.length
    ? await schools
        .from("school_admins")
        .select("school_id")
        .in("user_id", adminUserIds)
        .eq("role", "admin_master")
        .limit(MAX_SCHOOLS)
    : { data: [] };

  const schoolIds = [
    ...new Set([
      ...((bySchool as { id: string }[] | null) ?? []).map((s) => s.id),
      ...((byAdmin as { school_id: string }[] | null) ?? []).map((a) => a.school_id),
    ]),
  ].slice(0, MAX_SCHOOLS);

  for (const schoolId of schoolIds) {
    // Already on the team, or already waiting: nothing to add, nobody to email.
    const [{ data: member }, { data: pending }] = await Promise.all([
      schools.from("school_admins").select("id").eq("school_id", schoolId).eq("user_id", user.id).limit(1).maybeSingle(),
      schools
        .from("school_join_requests")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle(),
    ]);
    if (member || pending) continue;

    const { error } = await schools
      .from("school_join_requests")
      .insert({ school_id: schoolId, user_id: user.id, code_id: null, status: "pending" });
    if (error) continue; // includes the partial-unique race: someone else's insert won

    const { data: school } = await schools.from("schools").select("name").eq("id", schoolId).maybeSingle();
    const schoolName = (school as { name: string } | null)?.name ?? null;
    await notifyAdminsOfRequest(schools, schoolId, schoolName, user.email);
  }
}
