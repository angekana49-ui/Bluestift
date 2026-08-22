import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/routing";
import { pricingSummary } from "@/lib/billing";
import LandingPage from "@/components/site/LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // thebluestift.com is the public WEBSITE — open to everyone, signed in or not.
  // No login/onboarding gate lives here: that belongs to the PRODUCTS (Raya,
  // Schools, Rooms, Tools), whose routes each enforce login → onboarding → home.
  // For a signed-in visitor we only resolve where the "Open app" CTA points
  // (their product home); if they haven't onboarded, the product route bounces
  // them to /onboarding at that point — never from the marketing site.
  const homeHref = user ? await resolveHome(user.id) : undefined;

  // The pricing cards' price lines come from the plan catalogue, not from
  // strings in the component — resolved here because this is the server half,
  // so the marketing page pays no client fetch and shows no loading state.
  const [soloPrices, schoolPrices] = await Promise.all([
    pricingSummary("b2c"),
    pricingSummary("b2b"),
  ]);

  return (
    <LandingPage
      signedIn={!!user}
      homeHref={homeHref}
      soloPrices={soloPrices}
      schoolPrices={schoolPrices}
    />
  );
}
