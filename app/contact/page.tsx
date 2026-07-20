import { createClient } from "@/lib/supabase/server";
import { ContactView } from "@/components/site/pages/ContactView";

export const metadata = {
  title: "BlueStift · Contact",
  description: "Schools, researchers, press — write to the BlueStift team.",
};

export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <ContactView signedIn={!!user} />;
}
