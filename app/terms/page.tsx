import { createClient } from "@/lib/supabase/server";
import { TermsView } from "@/components/site/pages/TermsView";

export const metadata = {
  title: "Terms of service",
  description: "The terms covering your use of Bluestift and Raya — who can sign up, what Raya is and isn't, and how accounts end.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <TermsView signedIn={!!user} />;
}
