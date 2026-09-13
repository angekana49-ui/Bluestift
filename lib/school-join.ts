import "server-only";
import { createAdminClient, type createSchoolsAdminClient } from "@/lib/supabase/admin";
import { firstNameOf, sendBrandedEmail, sendSchoolLinkedEmail, getUserEmail, siteUrl } from "@/lib/email";
import { apiT } from "@/lib/i18n/server";

type SchoolsClient = ReturnType<typeof createSchoolsAdminClient>;

/**
 * Tell the school's admin(s) a teacher is waiting for approval — otherwise the
 * request sits invisible until someone happens to open the dashboard. Best-effort:
 * fans out to every admin_master with a real email; sendEmail never throws.
 *
 * Shared by the two ways a request is made: redeeming an approval-required staff
 * code (/api/school/join-team) and asking a school directly without one
 * (/api/school/request-access).
 */
export async function notifyAdminsOfRequest(
  schools: SchoolsClient,
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
  // In the requesting teacher's language: the one this request carries, and the
  // one a school's staff most likely share.
  const v = { school: schoolName ?? (await apiT("email.joinRequest.yourSchool")), who: requesterEmail ?? "" };
  const email = {
    subject: await apiT("email.joinRequest.subject", v),
    heading: await apiT("email.joinRequest.subject", v),
    lines: [
      requesterEmail ? await apiT("email.joinRequest.line1Email", v) : await apiT("email.joinRequest.line1", v),
      await apiT("email.joinRequest.line2"),
    ],
    cta: { label: await apiT("email.joinRequest.cta"), url: `${siteUrl("schools")}/school` },
  };
  await Promise.all(
    adminIds.map(async (id) => {
      const to = await getUserEmail(id);
      if (to) await sendBrandedEmail({ brand: "schools", to, ...email });
    }),
  );
}

/**
 * Tell a teacher their EXISTING account is now on a school's team — the
 * "school-linked" template. Sent at the moment the membership actually exists:
 * an auto-approve code redeemed (/api/school/join-team) or a request approved
 * (/api/school/requests). Not for a year renewal, which links nothing new, and
 * not for students (often minors, often without an email).
 */
export async function notifyTeacherLinked(userId: string, schoolName: string): Promise<void> {
  const to = await getUserEmail(userId);
  if (!to) return;
  const { data } = await createAdminClient().from("users").select("display_name").eq("id", userId).maybeSingle();
  await sendSchoolLinkedEmail({
    to,
    firstname: firstNameOf(data?.display_name, to),
    schoolName,
    role: "teacher",
  });
}
