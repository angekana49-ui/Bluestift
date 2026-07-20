import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

/** Public contact form -> content.contact_messages (source: form). */
export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const message = (body.message ?? "").trim().slice(0, 4000);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  const admin = createContentAdminClient();
  const { error } = await admin.from("contact_messages").insert({
    name: (body.name ?? "").trim().slice(0, 120) || null,
    email,
    phone: (body.phone ?? "").trim().slice(0, 40) || null,
    subject: (body.subject ?? "").trim().slice(0, 200) || null,
    message,
    source: "form",
  });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
