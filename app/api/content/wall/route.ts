import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { listWallPosts } from "@/lib/content";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/request-ip";
import { checkRateLimit } from "@/lib/rate-limit";

const PROFILES = new Set(["teacher", "student", "anonymous"]);

/** Public free-expression wall: list posts with reaction counts. */
export async function GET() {
  return NextResponse.json({ posts: await listWallPosts() });
}

/** Publish a wall post (captcha-gated). */
export async function POST(req: Request) {
  let body: { content?: string; profile?: string; language?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const content = (body.content ?? "").trim().slice(0, 1000);
  if (content.length < 3) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }
  // Defense-in-depth beyond the captcha (also covers the dev case where
  // TURNSTILE_SECRET_KEY is unset and verification is skipped).
  if (!(await checkRateLimit("wall_post", clientIp(req), 20))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = createContentAdminClient();
  const { data, error } = await admin
    .from("survey_posts")
    .insert({
      content,
      profile: PROFILES.has(body.profile ?? "") ? body.profile! : "anonymous",
      language: (body.language ?? "fr").slice(0, 10),
    })
    .select("id, content, profile, language, created_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ post: { ...data, resonates: 0, important: 0 } });
}
