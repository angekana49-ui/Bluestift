import { createClient } from "@/lib/supabase/server";
import { SubprocessorsView } from "@/components/site/pages/SubprocessorsView";

export const metadata = {
  title: "BlueStift · Sub-processors",
  description: "The companies that process personal data on BlueStift's behalf, what each one sees, and where.",
};

export default async function SubprocessorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <SubprocessorsView signedIn={!!user} />;
}
