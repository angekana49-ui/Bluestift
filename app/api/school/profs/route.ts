import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, makeStaffCode } from "@/lib/school-admin";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { sendBrandedEmail, siteUrl } from "@/lib/email";

/**
 * INVITE a teacher to the admin_master's school, by email. They must already
 * have a Bluestift account, and they must accept — nothing is written to
 * `school_admins` here.
 *
 * It used to add them outright. Anyone can create a school in one signup, so
 * that let a stranger attach any account to a school of their own without ever
 * asking: the victim opened /school and found themselves staff somewhere they
 * had never heard of, listed by name to whoever put them there. Membership in
 * an organisation is not something one party should be able to decide alone.
 *
 * The acceptance runs through machinery that already exists rather than new
 * schema: a fresh auto-approve code is minted for this invitation, emailed to
 * that address, and redeemed at /api/school/join-team, which is already the
 * consented path in. The code is returned to the admin as well, because email
 * is optional in this deployment (`RESEND_API_KEY`) and an invitation nobody
 * can deliver has to be one the admin can read out instead.
 *
 * Email only, and username lookup is deliberately gone: adding a teacher puts
 * them on the team list, which shows their address, so a lookup that accepted a
 * handle was a directory — type a handle, invite, read the address. Requiring
 * the email means the caller already holds the one thing this could reveal.
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

  let body: { identifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const identifier = (body.identifier ?? "").trim().toLowerCase().slice(0, 200);
  if (!identifier.includes("@")) {
    return NextResponse.json({ error: "Enter the teacher's email address." }, { status: 400 });
  }

  // Each attempt answers "does an account exist for this address", so the rate
  // limit is what stops the endpoint being walked through a list. Generous
  // against a real admin adding their staff one morning, useless for a sweep.
  if (!(await checkStrictUserRateLimit("school_prof_lookup", user.id, 40, "1 hour"))) {
    return NextResponse.json(
      { error: "Too many lookups — try again shortly." },
      { status: 429 },
    );
  }

  // Look up the user account (public.users is typed → typed admin client).
  // One equality lookup, not an interpolated PostgREST `.or()` filter.
  const admin = createAdminClient();
  const cols = "id, display_name, username, email";
  // Exact match on the lowercased address first — that is how Supabase Auth
  // stores it. The case-insensitive retry is for any row that predates that,
  // and `%`/`_` are refused above it because they are ilike wildcards, not
  // address characters: `%@%` would otherwise match a stranger's account.
  let { data: found } = await admin.from("users").select(cols).eq("email", identifier).maybeSingle();
  if (!found && !/[%_]/.test(identifier)) {
    ({ data: found } = await admin.from("users").select(cols).ilike("email", identifier).maybeSingle());
  }
  if (!found) {
    return NextResponse.json({ error: "No Bluestift account with that email." }, { status: 404 });
  }

  const schools = createSchoolsAdminClient();
  const { data: existing } = await schools
    .from("school_admins")
    .select("id")
    .eq("school_id", membership.schoolId)
    .eq("user_id", found.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That user is already in your school." }, { status: 409 });
  }

  // A code for THIS invitation, not the school's shared one. Auto-approve
  // because the admin has already given their half of the consent by sending
  // it; what was missing was the other half.
  let code: string | null = null;
  let codeId: string | null = null;
  let inviteError: unknown = null;
  /**
   * `single_use` marks this as an invitation to ONE person rather than a
   * staffroom code, so the redemption path can spend it (migration
   * 20260906120000, applied 2026-09-07).
   *
   * This used to retry without the column, to cover the window where a deploy
   * could reach production before its migration did. That window has closed,
   * and the fallback was never free: any insert error whose message merely
   * mentioned the column would have downgraded a named invitation into a code
   * that admits everyone it is forwarded to, silently and with a 200. Now the
   * column is there, failing loudly is the right end of that trade.
   *
   */
  for (let attempt = 0; attempt < 6 && !code; attempt++) {
    const candidate = makeStaffCode();
    const { data, error } = await schools
      .from("staff_invite_codes")
      .insert({
        school_id: membership.schoolId,
        code: candidate,
        auto_approve: true,
        is_active: true,
        created_by: membership.adminId,
        single_use: true,
      })
      .select("id")
      .single();
    if (!error) {
      code = candidate;
      codeId = (data as { id: string }).id;
    } else if (!/duplicate|unique|23505/i.test(error.message)) {
      inviteError = error;
      break;
    }
  }
  if (!code || !codeId) {
    return NextResponse.json(
      { error: inviteError ? clientError(inviteError) : "Could not create the invitation." },
      { status: 500 },
    );
  }

  const name = found.display_name || found.username || "there";
  const sent = await sendBrandedEmail({
    brand: "schools",
    to: found.email ?? identifier,
    subject: `${membership.schoolName} invited you to join them on Bluestift`,
    heading: `${membership.schoolName} invited you`,
    lines: [
      `Hi ${name},`,
      `${membership.schoolName} has invited you to join their team on Bluestift Schools as a teacher.`,
      `Open Schools and enter this code to accept: ${code}`,
      "If you weren't expecting this, you can ignore it — nothing changes on your account unless you enter the code.",
    ],
    cta: { label: "Accept the invitation", url: `${siteUrl("schools")}/school` },
  });

  return NextResponse.json({
    invited: true,
    email: found.email,
    name: found.display_name || found.username || "Teacher",
    code,
    // The row id, so the code can be listed, copied and deactivated like any
    // other — an invitation the admin cannot withdraw is not an invitation.
    codeId,
    // The admin needs to know whether to pass the code on by hand.
    emailed: sent.ok === true,
  });
}

/** Remove a prof from the admin_master's school. Never removes an admin_master. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const adminId = new URL(request.url).searchParams.get("adminId");
  if (!adminId) return NextResponse.json({ error: "adminId is required." }, { status: 400 });

  const schools = createSchoolsAdminClient();
  // Resolve and scope the membership BEFORE touching assignments. The previous
  // order let an admin from one school delete assignments belonging to an
  // arbitrary teacher id at another school.
  const { data: target } = await schools
    .from("school_admins")
    .select("id")
    .eq("id", adminId)
    .eq("school_id", membership.schoolId)
    .eq("role", "prof")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });

  // Drop the prof's assignments first in case the FK is not ON DELETE CASCADE.
  await schools.from("assignments").delete().eq("prof_id", adminId);

  // Scoped to this school and to role=prof so an admin_master can't be removed.
  const { data, error } = await schools
    .from("school_admins")
    .delete()
    .eq("id", adminId)
    .eq("school_id", membership.schoolId)
    .eq("role", "prof")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ ok: true, adminId });
}
