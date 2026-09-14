import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { apiT } from "@/lib/i18n/server";

/** Attach an optional contact email (early access) to a submitted survey response. */
export async function POST(req: Request) {
  let body: { response_id?: string; email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase().slice(0, 254);
  const id = (body.response_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  // Captcha farms solve Turnstile for cents; a per-IP ceiling bounds what
  // one address can post regardless (lib/rate-limit.ts, fails open).
  if (!(await checkRateLimit("form_survey_contact", clientIp(req), 60))) {
    return NextResponse.json({ error: await apiT("api.tooManyRequestsPleaseTryAgain") }, { status: 429 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  const admin = createContentAdminClient();
  const { error } = await admin
    .from("survey_responses")
    .update({ contact_email: email })
    .eq("id", id)
    .is("contact_email", null);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
