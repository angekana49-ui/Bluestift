import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getUserEmail, sendBrandedEmail, siteUrl } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far ahead of the pilot's last day the reminder goes out. */
const REMIND_DAYS_BEFORE = 7;
const BATCH = 200;

type SchoolRow = { id: string; name: string; pilot_until: string };

/**
 * Daily: remind a school's admins that its free pilot ends soon (Vercel Cron,
 * see vercel.json). This is the promise the "pilot-started" email makes —
 * "you'll get a reminder before the pilot ends, with an option to extend or
 * move to a paid plan" — kept once per school.
 *
 * It looks at a window, not a date: every pilot ending within the next
 * REMIND_DAYS_BEFORE days whose reminder hasn't gone out. Hobby cron timing is
 * ±59 minutes and a day can be skipped, so an exact "ends in 7 days" match
 * would drop schools. The window makes a school appear on several runs;
 * `pilot_reminder_sent_at` makes only the first one send (claimed before the
 * email, so overlapping runs can't both send).
 *
 * A school that already activated a plan is skipped (and claimed, so it isn't
 * reconsidered daily). "Extend" is a conversation, not a button: the email asks
 * the admin to reply, and replies reach a person (lib/email.ts replyTo).
 *
 * Protected by CRON_SECRET like the other crons (lib/cron-auth.ts).
 */
export async function GET(request: Request) {
  if (!authorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schools = createSchoolsAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + REMIND_DAYS_BEFORE);

  const { data, error } = await schools
    .from("schools")
    .select("id, name, pilot_until")
    .is("pilot_reminder_sent_at", null)
    .gte("pilot_until", today)
    .lte("pilot_until", horizon.toISOString().slice(0, 10))
    .limit(BATCH);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message }, { status: 500 });

  let reminded = 0;
  let skippedPaid = 0;
  let emails = 0;

  for (const school of (data as SchoolRow[] | null) ?? []) {
    // Claim first. Whoever sets the column is the one run that goes on.
    const { data: claimed } = await schools
      .from("schools")
      .update({ pilot_reminder_sent_at: nowIso })
      .eq("id", school.id)
      .is("pilot_reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    // Already on a paid plan: nothing to remind them of.
    const { data: paid } = await schools
      .from("subscriptions")
      .select("id")
      .eq("school_id", school.id)
      .eq("status", "active")
      .or(`end_date.is.null,end_date.gte."${nowIso}"`)
      .limit(1);
    if (paid?.length) {
      skippedPaid++;
      continue;
    }

    const { data: admins } = await schools
      .from("school_admins")
      .select("user_id")
      .eq("school_id", school.id)
      .eq("role", "admin_master");

    const ends = new Date(`${school.pilot_until}T12:00:00Z`);
    const daysLeft = Math.max(0, Math.round((ends.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000));
    const endsLabel = ends.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const inDays = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

    for (const { user_id } of (admins as { user_id: string }[] | null) ?? []) {
      const to = await getUserEmail(user_id);
      if (!to) continue;
      const sent = await sendBrandedEmail({
        brand: "schools",
        to,
        subject: `Your pilot ends ${inDays} — ${school.name}`,
        heading: `${school.name}'s pilot ends ${inDays}`,
        lines: [
          `The free Bluestift Schools pilot for ${school.name} ends on ${endsLabel}.`,
          "To keep adding students and classes after that date, choose a plan from the Billing tab. Nothing you have built is removed either way: without a plan, your school simply becomes read-only.",
          "Need more time to decide? Reply to this email and we'll talk about extending your pilot.",
        ],
        cta: { label: "Choose a plan", url: `${siteUrl("schools")}/school?tab=billing` },
      });
      if (sent.ok) emails++;
    }
    reminded++;
  }

  return NextResponse.json({ ok: true, considered: data?.length ?? 0, reminded, skippedPaid, emails });
}
