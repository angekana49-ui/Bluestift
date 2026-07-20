import { createClient } from "@/lib/supabase/server";
import { getSurveyStats, listWallPosts } from "@/lib/content";
import { SurveyView } from "@/components/site/pages/SurveyView";

export const metadata = {
  title: "BlueStift · Survey",
  description: "5 minutes to tell us what really gets in the way when you teach or learn.",
};

export default async function SurveyPage() {
  const supabase = await createClient();
  const [{ data: auth }, posts, stats] = await Promise.all([
    supabase.auth.getUser(),
    listWallPosts(),
    getSurveyStats(),
  ]);

  return <SurveyView signedIn={!!auth.user} initialPosts={posts} stats={stats} />;
}
