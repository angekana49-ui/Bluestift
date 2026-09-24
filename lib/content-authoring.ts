import "server-only";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";

/**
 * Writing research posts and newsletter issues from inside the product,
 * instead of the Supabase dashboard. PREPARED, NOT WIRED: no /ops page or
 * route calls this yet.
 *
 * Posts need no migration — content.research_posts already has
 * status ∈ draft | published. Newsletter DRAFTS need
 * supabase/drafts/newsletter_v1.sql (body_md, status).
 *
 * Every write is gated on isPlatformOwner(actorId), resolved from the
 * database — the same operator check as the billing ops tools.
 *
 * Publishing is live on /research within lib/content.ts's one-minute cache.
 */

export const POST_TYPES = ["paper", "experiment", "article", "update"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const TITLE_MAX = 200;
export const SLUG_MAX = 80;
/** Generous; a post is Markdown, and the longest live one is far below this. */
export const CONTENT_MAX = 200_000;

/**
 * "L'Élève & la Machine — v2" → "l-eleve-la-machine-v2".
 * ASCII only: slugs are URLs people paste, and a percent-encoded slug reads as
 * breakage in a chat message.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export type PostInput = { title: string; slug?: string; content: string; type: string };

export type PostValidation =
  | { ok: true; value: { title: string; slug: string; content: string; type: PostType } }
  | { ok: false; errors: Array<"title" | "slug" | "content" | "type"> };

export function validatePost(input: PostInput): PostValidation {
  const errors: Array<"title" | "slug" | "content" | "type"> = [];
  const title = input.title.trim();
  const slug = slugify(input.slug?.trim() || title);
  const content = input.content.replace(/\r\n/g, "\n").trim();
  if (!title || title.length > TITLE_MAX) errors.push("title");
  if (!slug) errors.push("slug");
  if (!content || content.length > CONTENT_MAX) errors.push("content");
  if (!(POST_TYPES as readonly string[]).includes(input.type)) errors.push("type");
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { title, slug, content, type: input.type as PostType } };
}

export type AuthoringResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "invalid" | "duplicate" | "not_found" | "error"; errors?: string[] };

/** Create or update a post as a DRAFT. Publishing is its own step. */
export async function savePostDraft(
  actorId: string,
  input: PostInput & { id?: string },
): Promise<AuthoringResult<{ id: string; slug: string }>> {
  if (!(await isPlatformOwner(actorId))) return { ok: false, reason: "forbidden" };
  const v = validatePost(input);
  if (!v.ok) return { ok: false, reason: "invalid", errors: v.errors };

  const admin = createContentAdminClient();
  const { data: clash } = await admin
    .from("research_posts")
    .select("id")
    .eq("slug", v.value.slug)
    .maybeSingle();
  if (clash && (clash as { id: string }).id !== input.id) return { ok: false, reason: "duplicate", errors: ["slug"] };

  const row = { ...v.value, updated_at: new Date().toISOString() };
  const q = input.id
    ? admin.from("research_posts").update(row).eq("id", input.id).select("id, slug").maybeSingle()
    : admin.from("research_posts").insert({ ...row, status: "draft" }).select("id, slug").single();
  const { data, error } = await q;
  if (error) return { ok: false, reason: "error" };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, value: data as { id: string; slug: string } };
}

/**
 * Publish or unpublish. `published_at` is set on the FIRST publish only, so
 * unpublishing to fix a typo does not move a post to the top of the list.
 */
export async function setPostPublished(actorId: string, id: string, published: boolean): Promise<AuthoringResult> {
  if (!(await isPlatformOwner(actorId))) return { ok: false, reason: "forbidden" };
  const admin = createContentAdminClient();
  const { data: current } = await admin
    .from("research_posts")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, reason: "not_found" };
  const now = new Date().toISOString();
  const { error } = await admin
    .from("research_posts")
    .update({
      status: published ? "published" : "draft",
      published_at: (current as { published_at: string | null }).published_at ?? (published ? now : null),
      updated_at: now,
    })
    .eq("id", id);
  return error ? { ok: false, reason: "error" } : { ok: true, value: null };
}

/** A newsletter issue written in the product — always created as a draft. */
export async function saveIssueDraft(
  actorId: string,
  input: { id?: string; issueNumber: string; title: string; bodyMd: string },
): Promise<AuthoringResult<{ id: string }>> {
  if (!(await isPlatformOwner(actorId))) return { ok: false, reason: "forbidden" };
  const title = input.title.trim();
  const issueNumber = input.issueNumber.trim();
  const bodyMd = input.bodyMd.replace(/\r\n/g, "\n").trim();
  const errors: string[] = [];
  if (!title || title.length > TITLE_MAX) errors.push("title");
  if (!/^[0-9A-Za-z.-]{1,20}$/.test(issueNumber)) errors.push("issueNumber");
  if (!bodyMd || bodyMd.length > CONTENT_MAX) errors.push("bodyMd");
  if (errors.length) return { ok: false, reason: "invalid", errors };

  const admin = createContentAdminClient();
  const row = { title, issue_number: issueNumber, body_md: bodyMd };
  const q = input.id
    ? admin.from("newsletter_issues").update(row).eq("id", input.id).eq("status", "draft").select("id").maybeSingle()
    : admin
        .from("newsletter_issues")
        // published_at is NOT NULL live; for a draft it is the planned date,
        // overwritten by the send.
        .insert({ ...row, status: "draft", published_at: new Date().toISOString() })
        .select("id")
        .single();
  const { data, error } = await q;
  // 23505: issue_number is unique.
  if (error) return error.code === "23505" ? { ok: false, reason: "duplicate", errors: ["issueNumber"] } : { ok: false, reason: "error" };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, value: data as { id: string } };
}
