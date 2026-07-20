import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

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
