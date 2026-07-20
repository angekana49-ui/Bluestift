import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/routing";
import LandingPage from "@/components/site/LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // thebluestift.com is the public WEBSITE — open to everyone, signed in or not.
  // No login/onboarding gate lives here: that belongs to the PRODUCTS (RAYA,
  // Schools, Rooms, Tools), whose routes each enforce login → onboarding → home.
  // For a signed-in visitor we only resolve where the "Open app" CTA points
  // (their product home); if they haven't onboarded, the product route bounces
  // them to /onboarding at that point — never from the marketing site.
  const homeHref = user ? await resolveHome(user.id) : undefined;

  return <LandingPage signedIn={!!user} homeHref={homeHref} />;
}
