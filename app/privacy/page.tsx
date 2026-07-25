import { createClient } from "@/lib/supabase/server";
import { PrivacyView } from "@/components/site/pages/PrivacyView";

export const metadata = {
  title: "BlueStift · Privacy",
  description: "How BlueStift handles your data — anonymous-first, opt-in analytics, no ads, no data selling.",
};

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <PrivacyView signedIn={!!user} />;
}
