import { createClient } from "@/lib/supabase/server";
import { getNewsletterIssues, getPublishedPosts } from "@/lib/content";
import { ResearchView } from "@/components/site/pages/ResearchView";

export const metadata = {
  title: "BlueStift · Research",
  description: "Publications, field experiments and advances in the Cognitive Kernel.",
};

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const [{ data: auth }, posts, issues, { tab }] = await Promise.all([
    supabase.auth.getUser(),
    getPublishedPosts(),
    getNewsletterIssues(),
    searchParams,
  ]);

  return <ResearchView posts={posts} issues={issues} signedIn={!!auth.user} initialTab={tab} />;
}
