import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostBySlug } from "@/lib/content";
import { ResearchPostView } from "@/components/site/pages/ResearchPostView";

/** First paragraph, trimmed to a search-result-shaped length. */
function excerpt(content: string | null): string | undefined {
  const first = (content ?? "").split(/\n{2,}/).find((p) => p.trim());
  if (!first) return undefined;
  const flat = first.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 159)}…` : flat;
}

// Every post needs its OWN title/description: without this, every research
// post shares the listing page's generic metadata, and neither a search
// result nor an AI answer engine can tell one post from another by its URL.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (!post) return {};

  const description = excerpt(post.content);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/research/${encodeURIComponent(slug)}` },
    openGraph: { title: post.title, description, type: "article" },
  };
}

export default async function ResearchPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: auth }, post] = await Promise.all([
    supabase.auth.getUser(),
    getPostBySlug(decodeURIComponent(slug)),
  ]);
  if (!post) notFound();

  return <ResearchPostView post={post} signedIn={!!auth.user} />;
}
