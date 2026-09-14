import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/server";

/**
 * `onboarding_completed`, emitted on the server.
 *
 * Onboarding is saved from the browser (components/onboarding-form.tsx writes
 * the users row directly), so there is no server request that IS its
 * completion. The browser asks this route once it has saved — and this route
 * does not take its word for it: the event goes out only if the row says
 * onboarding finished within the last few minutes, and its properties are read
 * from what was stored, not from the request. A client can therefore neither
 * invent a completion nor replay one into a second funnel entry days later.
 *
 * Always answers 204. Whether an event was sent is nobody's business but the
 * analytics pipeline's, and a caller must not be able to probe consent or age
 * through it.
 */

/** How long after the save the completion still counts as "just now". */
const FRESH_MS = 10 * 60 * 1000;

const done = () => new NextResponse(null, { status: 204 });

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return done();

  try {
    const admin = createAdminClient();
    const [{ data: row }, { data: step }] = await Promise.all([
      admin.from("users").select("onboarding_completed_at, school_level").eq("id", user.id).maybeSingle(),
      admin
        .from("onboarding_events")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("step", "username_set")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const completedAt = row?.onboarding_completed_at ? Date.parse(row.onboarding_completed_at) : NaN;
    if (!Number.isFinite(completedAt) || Date.now() - completedAt > FRESH_MS) return done();

    const meta = (step?.metadata ?? {}) as { track?: unknown; role?: unknown };
    const track = meta.track === "schools" ? "schools" : "raya";
    await captureServer(user.id, "onboarding_completed", {
      track,
      role: typeof meta.role === "string" ? meta.role : null,
      school_level: track === "raya" ? (row?.school_level ?? null) : null,
      anonymous: user.is_anonymous ?? false,
    });
  } catch {
    // analytics never fails a request
  }
  return done();
}
