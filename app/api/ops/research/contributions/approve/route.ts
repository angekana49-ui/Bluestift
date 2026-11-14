import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createContentAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";
import {
  MAX_PUBLISH_BYTES,
  PUBLISH_BUCKET,
  QUARANTINE_BUCKET,
  classifyPublishFile,
  isPostType,
  isValidSlug,
  publishObjectName,
} from "@/lib/research/publish";

export const runtime = "nodejs";

type PendingRow = {
  id: string;
  title: string | null;
  category: string | null;
  contributor_name: string | null;
  description: string | null;
  storage_path: string | null;
  status: string;
};

/**
 * Owner-only publish step: a reviewed quarantine file leaves `contributions`
 * for the public `research-media` bucket, and the research post goes live.
 *
 * Body: { id, slug, type, title?, content?, authorName?, institution? }.
 * Unset title/content/authorName fall back to the contribution's own fields.
 * The file allowlist lives in lib/research/publish.ts — anything outside it
 * stays in quarantine (400, nothing written).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const id = str(body.id);
  const slug = str(body.slug).trim().toLowerCase();
  const type = str(body.type).trim().toLowerCase();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!isValidSlug(slug)) return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  if (!isPostType(type)) return NextResponse.json({ error: "bad_type" }, { status: 400 });

  const content = createContentAdminClient();
  const { data: row } = await content
    .from("contributions")
    .select("id, title, category, contributor_name, description, storage_path, status")
    .eq("id", id)
    .maybeSingle();
  const contribution = row as PendingRow | null;
  if (!contribution) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contribution.status !== "pending") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  const title = (str(body.title) || contribution.title || "").trim().slice(0, 200);
  const text = (str(body.content) || contribution.description || "").trim().slice(0, 50000);
  const authorName = (str(body.authorName) || contribution.contributor_name || "").trim().slice(0, 120);
  const institution = str(body.institution).trim().slice(0, 120) || null;
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "content_required" }, { status: 400 });
  if (!authorName) return NextResponse.json({ error: "author_required" }, { status: 400 });

  const { data: slugTaken } = await content
    .from("research_posts")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  if (slugTaken && slugTaken.length > 0) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  // Everything fallible is validated before anything is written.
  const file = contribution.storage_path ? classifyPublishFile(contribution.storage_path) : null;
  if (contribution.storage_path && !file) {
    return NextResponse.json({ error: "unsupported_file" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Author: reuse the exact-name row, else create.
  const { data: existingAuthor } = await content
    .from("research_authors")
    .select("id")
    .eq("full_name", authorName)
    .limit(1);
  let authorId = (existingAuthor as { id: string }[] | null)?.[0]?.id ?? null;
  if (!authorId) {
    const { data: created, error: authorError } = await content
      .from("research_authors")
      .insert({ full_name: authorName, institution })
      .select("id")
      .single();
    if (authorError || !created) return NextResponse.json({ error: "author_failed" }, { status: 500 });
    authorId = (created as { id: string }).id;
  }

  // Quarantine -> public, with the allowlisted content type (never the stored one).
  let publicUrl: string | null = null;
  if (file && contribution.storage_path) {
    const { data: blob, error: dlError } = await admin.storage
      .from(QUARANTINE_BUCKET)
      .download(contribution.storage_path);
    if (dlError || !blob) return NextResponse.json({ error: "download_failed" }, { status: 500 });
    if (blob.size > MAX_PUBLISH_BYTES || blob.size === 0) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    const objectName = publishObjectName(slug, file.ext);
    const { error: upError } = await admin.storage
      .from(PUBLISH_BUCKET)
      .upload(objectName, blob, { contentType: file.contentType, upsert: false });
    if (upError && !/already exists|duplicate/i.test(upError.message)) {
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }
    publicUrl = admin.storage.from(PUBLISH_BUCKET).getPublicUrl(objectName).data.publicUrl;
  }

  const finalContent =
    file?.kind === "attachment" && publicUrl
      ? `${text}\n\nDownload the attached file: ${publicUrl}`
      : text;

  const { data: post, error: postError } = await content
    .from("research_posts")
    .insert({ title, slug, content: finalContent, type, status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (postError || !post) return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  const postId = (post as { id: string }).id;

  const { error: linkError } = await content
    .from("research_post_authors")
    .insert({ post_id: postId, author_id: authorId, order: 1 });
  if (linkError) return NextResponse.json({ error: "publish_failed" }, { status: 500 });

  if (file?.kind === "media" && publicUrl) {
    const { error: mediaError } = await content
      .from("research_media")
      .insert({ post_id: postId, url: publicUrl, type: file.mediaType, title });
    if (mediaError) return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }

  await content
    .from("contributions")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", id);

  // Best effort: the quarantine copy is private and invisible, so a failed
  // delete must not fail an otherwise complete publish.
  if (contribution.storage_path) {
    try {
      await admin.storage.from(QUARANTINE_BUCKET).remove([contribution.storage_path]);
    } catch {
      /* leave it for manual cleanup */
    }
  }

  return NextResponse.json({ ok: true, slug });
}
