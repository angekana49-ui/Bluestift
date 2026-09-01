import { createClient } from "@/lib/supabase/server";
import { getNewsletterIssues, getPublishedPosts } from "@/lib/content";
import { billingIsLive } from "@/lib/billing/payments";
import { ENTITLEMENTS_ENFORCE } from "@/lib/entitlements";
import { ResearchView } from "@/components/site/pages/ResearchView";

export const metadata = {
  title: "BlueStift · Research",
  description: "Publications, field experiments, advances in the Cognitive Kernel — and where the product actually stands.",
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

  // The progress tab states these two about itself rather than asserting them
  // in prose that would go stale the day the provider keys land.
  return (
    <ResearchView
      posts={posts}
      issues={issues}
      signedIn={!!auth.user}
      initialTab={tab}
      paymentsLive={billingIsLive()}
      quotasEnforced={ENTITLEMENTS_ENFORCE}
    />
  );
}
