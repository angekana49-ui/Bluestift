import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { apiT } from "@/lib/i18n/server";

/** Public newsletter signup -> content.research_subscribers. */
export async function POST(req: Request) {
  let body: { email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  // Captcha farms solve Turnstile for cents; a per-IP ceiling bounds what
  // one address can post regardless (lib/rate-limit.ts, fails open).
  if (!(await checkRateLimit("form_subscribe", clientIp(req), 20))) {
    return NextResponse.json({ error: await apiT("api.tooManyRequestsPleaseTryAgain") }, { status: 429 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  const admin = createContentAdminClient();
  const { data: existing } = await admin
    .from("research_subscribers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  const { error } = await admin.from("research_subscribers").insert({ email });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
