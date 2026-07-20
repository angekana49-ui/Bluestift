import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostBySlug } from "@/lib/content";
import { ResearchPostView } from "@/components/site/pages/ResearchPostView";

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
