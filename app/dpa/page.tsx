import { createClient } from "@/lib/supabase/server";
import { DpaView } from "@/components/site/pages/DpaView";

export const metadata = {
  title: "BlueStift · Data processing addendum",
  description: "How BlueStift handles school data: GDPR processor terms, the FERPA school-official commitments, and the COPPA school-consent basis.",
};

export default async function DpaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <DpaView signedIn={!!user} />;
}
