import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { exchangeCode, getUserInfo } from "@/lib/lms/google";

/** OAuth callback: exchange the code for tokens and store the connection. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const done = (params: string) => NextResponse.redirect(`${origin}/school?tab=lms&${params}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  if (oauthError) return done(`lmsError=${encodeURIComponent(oauthError)}`);

  // CSRF: the state must match the cookie set in /start.
  const cookieStore = await cookies();
  const expected = cookieStore.get("lms_g_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return done("lmsError=bad_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") return done("lmsError=admin_only");

  const redirectUri = `${origin}/api/school/lms/google/callback`;
  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (e) {
    return done(`lmsError=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 60) : "exchange_failed")}`);
  }
  const info = await getUserInfo(tokens.access_token);
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const schools = createSchoolsAdminClient();
  // One google_classroom connection per school — update in place if present.
  const { data: existing } = await schools
    .from("lms_connections")
    .select("id")
    .eq("school_id", membership.schoolId)
    .eq("provider", "google_classroom")
    .maybeSingle();

  const row = {
    school_id: membership.schoolId,
    provider: "google_classroom",
    access_token: tokens.access_token,
    // Google only returns a refresh_token on first consent — keep the old one otherwise.
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    token_expires_at: expiresAt,
    external_org_id: info.hd ?? null,
    external_org_name: info.hd ?? info.email ?? "Google Classroom",
    is_active: true,
    sync_status: "idle",
    updated_at: new Date().toISOString(),
  };

  const existingId = (existing as { id?: string } | null)?.id;
  const { error } = existingId
    ? await schools.from("lms_connections").update(row).eq("id", existingId)
    : await schools.from("lms_connections").insert(row);

  const res = error ? done("lmsError=save_failed") : done("connected=1");
  res.cookies.delete("lms_g_state");
  return res;
}
