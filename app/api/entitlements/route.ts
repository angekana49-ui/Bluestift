import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveRayaEntitlements,
  RAYA_ENTITLEMENTS,
  ENTITLEMENTS_ENFORCE,
} from "@/lib/entitlements";

export const runtime = "nodejs";

/**
 * The current user's resolved Raya entitlements, for CLIENT-SIDE UI gating
 * (disable/relabel PDF export, drop the watermark for paid tiers, etc.). This is
 * a convenience mirror of the server gates — the server routes remain the real
 * enforcement point; the client copy only shapes the UI. Signed-out callers get
 * the Free set so the UI degrades gracefully.
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
    });
  }
  const { tier, ent } = await resolveRayaEntitlements(user.id);
  return NextResponse.json({ tier, enforce: ENTITLEMENTS_ENFORCE, ent });
}
