import "server-only";
import { createContentAdminClient } from "@/lib/supabase/admin";

/**
 * Read helpers for the public site over the `content` schema (service role —
 * that schema has no anon RLS policies; all public reads go through here and
 * only ever expose published material).
 *
 * CHECK constraints (probed against the live DB):
 *   research_posts.type   ∈ paper | experiment | article | update
 *   research_posts.status ∈ draft | published
 *   research_media.type   ∈ image | video | pdf
 */

export type PublicAuthor = {
  full_name: string;
  institution: string | null;
  avatar_url: string | null;
};

export type PublicResearchPost = {
  id: string;
  title: string;
  slug: string | null;
  content: string | null;
  type: string | null;
  published_at: string | null;
  created_at: string;
  authors: PublicAuthor[];
};

export type PublicMedia = {
  id: string;
  url: string | null;
  type: string | null;
  title: string | null;
};

export type PublicNewsletterIssue = {
  id: string;
  issue_number: string;
  title: string;
  published_at: string;
  content_url: string | null;
};

type AuthorLink = { post_id: string; author_id: string; order: number | null };

async function attachAuthors(
  posts: Omit<PublicResearchPost, "authors">[],
): Promise<PublicResearchPost[]> {
  if (posts.length === 0) return [];
  const admin = createContentAdminClient();
  const postIds = posts.map((p) => p.id);
  const { data: links } = await admin
    .from("research_post_authors")
    .select("post_id, author_id, order")
    .in("post_id", postIds);
  const authorIds = [...new Set((links as AuthorLink[] | null)?.map((l) => l.author_id) ?? [])];
  const authorsById = new Map<string, PublicAuthor>();
  if (authorIds.length > 0) {
    const { data: authors } = await admin
      .from("research_authors")
      .select("id, full_name, institution, avatar_url")
      .in("id", authorIds);
    for (const a of (authors ?? []) as Array<PublicAuthor & { id: string }>) {
      authorsById.set(a.id, {
        full_name: a.full_name,
        institution: a.institution,
        avatar_url: a.avatar_url,
      });
    }
  }
  return posts.map((p) => {
    const own = ((links as AuthorLink[] | null) ?? [])
      .filter((l) => l.post_id === p.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((l) => authorsById.get(l.author_id))
      .filter((a): a is PublicAuthor => !!a);
    return { ...p, authors: own };
  });
}

export async function getPublishedPosts(): Promise<PublicResearchPost[]> {
  const admin = createContentAdminClient();
  const { data, error } = await admin
    .from("research_posts")
    .select("id, title, slug, content, type, published_at, created_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error || !data) return [];
  return attachAuthors(data as Omit<PublicResearchPost, "authors">[]);
}

export async function getPostBySlug(
  slug: string,
): Promise<(PublicResearchPost & { media: PublicMedia[] }) | null> {
  const admin = createContentAdminClient();
  const { data } = await admin
    .from("research_posts")
    .select("id, title, slug, content, type, published_at, created_at")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const [post] = await attachAuthors([data as Omit<PublicResearchPost, "authors">]);
  const { data: media } = await admin
    .from("research_media")
    .select("id, url, type, title")
    .eq("post_id", post.id);
  return { ...post, media: (media ?? []) as PublicMedia[] };
}

export type WallPost = {
  id: string;
  content: string;
  profile: string | null;
  language: string | null;
  created_at: string;
  resonates: number;
  important: number;
};

/** Free-expression wall posts with aggregated reaction counts. */
export async function listWallPosts(): Promise<WallPost[]> {
  const admin = createContentAdminClient();
  const { data: posts } = await admin
    .from("survey_posts")
    .select("id, content, profile, language, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (!posts || posts.length === 0) return [];

  const ids = posts.map((p) => p.id as string);
  const { data: reactions } = await admin
    .from("survey_post_reactions")
    .select("post_id, type")
    .in("post_id", ids);

  const counts = new Map<string, { resonates: number; important: number }>();
  for (const r of (reactions ?? []) as Array<{ post_id: string; type: string }>) {
    const c = counts.get(r.post_id) ?? { resonates: 0, important: 0 };
    if (r.type === "resonates") c.resonates += 1;
    if (r.type === "important") c.important += 1;
    counts.set(r.post_id, c);
  }
  return posts.map((p) => ({
    id: p.id as string,
    content: (p.content as string) ?? "",
    profile: p.profile as string | null,
    language: p.language as string | null,
    created_at: p.created_at as string,
    resonates: counts.get(p.id as string)?.resonates ?? 0,
    important: counts.get(p.id as string)?.important ?? 0,
  }));
}

/** Real public counters for the survey landing (no fabricated numbers). */
export async function getSurveyStats(): Promise<{ responses: number; posts: number }> {
  const admin = createContentAdminClient();
  const [r, p] = await Promise.all([
    admin.from("survey_responses").select("id", { count: "exact", head: true }).eq("completed", true),
    admin.from("survey_posts").select("id", { count: "exact", head: true }),
  ]);
  return { responses: r.count ?? 0, posts: p.count ?? 0 };
}

export async function getNewsletterIssues(): Promise<PublicNewsletterIssue[]> {
  const admin = createContentAdminClient();
  const { data } = await admin
    .from("newsletter_issues")
    .select("id, issue_number, title, published_at, content_url")
    .order("published_at", { ascending: false })
    .limit(50);
  return (data ?? []) as PublicNewsletterIssue[];
}
