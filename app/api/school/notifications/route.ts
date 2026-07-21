import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminMembership,
  getTeam,
  getSchoolOverview,
  getProfInsights,
} from "@/lib/school-admin";

export type SchoolNotification = {
  id: string;
  kind: "request" | "risk" | "info";
  title: string;
  detail: string;
};

/**
 * A lightweight, DERIVED notifications feed for the RAYA-for-Schools right panel
 * — no new table. It aggregates signals that already exist:
 *   admin → pending team join-requests + the school-wide at-risk count
 *   prof  → at-risk students in their assigned classes
 * Read-only and best-effort; a failing source simply contributes nothing.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  const items: SchoolNotification[] = [];

  if (membership.role === "admin_master") {
    const [team, overview] = await Promise.all([
      getTeam(user.id).catch(() => null),
      getSchoolOverview(user.id).catch(() => null),
    ]);
    for (const r of team?.requests ?? []) {
      items.push({
        id: `req-${r.id}`,
        kind: "request",
        title: "Teacher join request",
        detail: `${r.name} asked to join your school.`,
      });
    }
    if (overview && overview.totals.alerts > 0) {
      items.push({
        id: "risk-school",
        kind: "risk",
        title: `${overview.totals.alerts} student${overview.totals.alerts === 1 ? "" : "s"} at risk`,
        detail: `${overview.totals.active} active over the last 7 days.`,
      });
    }
  } else {
    const insights = await getProfInsights(user.id).catch(() => null);
    for (const a of insights?.alerts ?? []) {
      items.push({
        id: `alert-${a.userId}`,
        kind: "risk",
        title: `${a.name} needs attention`,
        detail: `${a.className}${a.statusLabel ? ` · ${a.statusLabel}` : ""}`,
      });
    }
  }

  return NextResponse.json({ notifications: items });
}
