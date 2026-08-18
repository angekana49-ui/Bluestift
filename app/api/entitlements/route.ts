import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveRayaEntitlements,
  RAYA_ENTITLEMENTS,
  ENTITLEMENTS_ENFORCE,
  startOfDayIso,
} from "@/lib/entitlements";

export const runtime = "nodejs";

/**
 * The current user's resolved Raya entitlements, for CLIENT-SIDE UI gating
 * (disable/relabel PDF export, drop the watermark for paid tiers, etc.). This is
 * a convenience mirror of the server gates — the server routes remain the real
 * enforcement point; the client copy only shapes the UI. Signed-out callers get
 * the Free set so the UI degrades gracefully.
 *
 * `usage` carries what the day-scoped quotas need to be DISPLAYED before the
 * first send of a session. After that the chat response's own headers keep the
 * counter fresh, so this endpoint is not polled.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({
      tier: "free",
      enforce: ENTITLEMENTS_ENFORCE,
      ent: RAYA_ENTITLEMENTS.free,
      usage: { messagesToday: 0 },
    });
  }
  const [{ tier, ent }, { count }] = await Promise.all([
    resolveRayaEntitlements(user.id),
    supabase
      .schema("learning")
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", startOfDayIso()),
  ]);
  return NextResponse.json({
    tier,
    enforce: ENTITLEMENTS_ENFORCE,
    ent,
    usage: { messagesToday: count ?? 0 },
  });
}
