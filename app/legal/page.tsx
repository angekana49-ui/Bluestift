import { createClient } from "@/lib/supabase/server";
import { LegalIndexView } from "@/components/site/pages/LegalIndexView";

export const metadata = {
  title: "BlueStift · Legal",
  description:
    "Privacy, terms, the schools DPA and every sub-processor — plus the account controls that act on them.",
};

export default async function LegalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <LegalIndexView signedIn={!!user} />;
}
