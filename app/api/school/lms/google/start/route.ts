import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership } from "@/lib/school-admin";
import { buildAuthUrl, googleConfigured } from "@/lib/lms/google";
import { resolveSchoolEntitlements, ENTITLEMENTS_ENFORCE } from "@/lib/entitlements";

/** Kick off Google Classroom OAuth: redirect the admin to Google's consent screen. */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.redirect(`${origin}/school?lmsError=admin_only`);
  }
  // Google Classroom integration is a Custom-tier feature. This is a redirect
  // flow, so a denial redirects with an error flag rather than a JSON 403.
  const { ent } = await resolveSchoolEntitlements(membership.schoolId);
  if (ENTITLEMENTS_ENFORCE && !ent.lms) {
    return NextResponse.redirect(`${origin}/school?lmsError=plan_required`);
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/school?lmsError=not_configured`);
  }

  const redirectUri = `${origin}/api/school/lms/google/callback`;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(redirectUri, state));
  // CSRF guard: the callback must present the same state we set here.
  res.cookies.set("lms_g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  });
  return res;
}
