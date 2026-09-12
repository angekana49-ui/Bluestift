import "server-only";
import type { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { sendBrandedEmail, getUserEmail, siteUrl } from "@/lib/email";

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
