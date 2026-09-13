import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRealEmail } from "@/lib/auth";
import { requestAccountUpgrade } from "@/lib/account-upgrade";
import { getServerTranslate } from "@/lib/i18n/server";

export const runtime = "nodejs";

/**
 * POST — ask to turn this anonymous account into a verified one: an address and
 * a password. Sends the confirmation link; see lib/account-upgrade.ts.
 *
 * GET — where that stands, for the tab waiting on the link: `verified` once the
 * address is on the account (from any device), and the address still pending
 * otherwise. getUser() reads the account from Auth, not from this browser's
 * token, so it sees a swap made elsewhere.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await requestAccountUpgrade({
    supabase,
    user,
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
    origin: new URL(request.url).origin,
    tr: await getServerTranslate(),
  });

  if (!result.ok) {
    return NextResponse.json({ code: result.code, problem: result.problem }, { status: result.status });
  }
  return NextResponse.json({ ok: true, email: result.email, signedIn: result.signedIn });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ verified: false, signedOut: true }, { status: 401 });
  if (hasRealEmail(user.email)) return NextResponse.json({ verified: true });

  let pendingEmail: string | null = null;
  try {
    const { data } = await createAdminClient()
      .from("account_upgrades")
      .select("email, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) pendingEmail = data.email;
  } catch {
    // unknown is fine: the caller only needs `verified`
  }
  return NextResponse.json({ verified: false, pendingEmail });
}
