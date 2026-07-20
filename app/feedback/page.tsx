import { createClient } from "@/lib/supabase/server";
import { FeedbackView } from "@/components/site/pages/FeedbackView";

export const metadata = {
  title: "BlueStift · Feedback",
  description: "A bug, an idea, an opinion — tell us everything.",
};

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <FeedbackView signedIn={!!user} />;
}
