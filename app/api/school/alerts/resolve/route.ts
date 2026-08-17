import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership, canReachStudent } from "@/lib/school-admin";
import { getAlertOwner } from "@/lib/kernel/risk";
import { kernel, KernelError } from "@/lib/kernel/client";

/**
 * Acknowledge a pedagogical-safety alert (or reopen one closed by mistake).
 *
 * Three checks, in order, because each answers a different question:
 *   1. is there a session at all,
 *   2. is this person staff,
 *   3. is this alert about one of THEIR students — an alert id is a guessable
 *      UUID, so holding one proves nothing on its own.
 *
 * The kernel enforces its own rule underneath (service-only, alert rows only),
 * but it cannot know who teaches where. That part is ours.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  let body: { alertIds?: string[]; resolved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  // The dashboard shows one line per student, which may stand for several
  // alerts, so an acknowledgement closes the set behind that line.
  const alertIds = [...new Set((body.alertIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
  if (alertIds.length === 0) {
    return NextResponse.json({ error: "alertIds is required" }, { status: 400 });
  }
  if (alertIds.length > 50) {
    return NextResponse.json({ error: "Too many alerts in one call." }, { status: 400 });
  }

  // Every id is checked. Authorizing the first and trusting the rest is how a
  // caller smuggles someone else's alert in behind one of their own.
  for (const alertId of alertIds) {
    const owner = await getAlertOwner(alertId);
    if (!owner) return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    if (!(await canReachStudent(user.id, owner))) {
      return NextResponse.json({ error: "Not your student." }, { status: 403 });
    }
  }

  const resolved = body.resolved ?? true;
  const done: string[] = [];
  try {
    for (const alertId of alertIds) {
      await kernel.resolveAlert({
        alert_id: alertId,
        // The kernel has no staff directory, so it records what we vouch for.
        resolved_by: membership.adminId,
        resolved,
      });
      done.push(alertId);
    }
  } catch (err) {
    // Partial success is the honest answer: the first call may have woken the
    // container and succeeded before a later one failed. Report what landed so
    // the UI refetches rather than assuming all or nothing.
    const status = err instanceof KernelError ? 502 : 503;
    return NextResponse.json(
      {
        error:
          done.length > 0
            ? "Some alerts were not acknowledged. Refresh to see the current state."
            : "Could not reach the kernel — nothing was acknowledged. Try again.",
        resolvedIds: done,
      },
      { status },
    );
  }

  return NextResponse.json({ resolved, resolvedIds: done });
}
