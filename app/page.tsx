import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/routing";
import { pricingEntry } from "@/lib/billing";
import { SITE_DESCRIPTION } from "@/lib/seo";
import LandingPage from "@/components/site/LandingPage";

// The one page that didn't have its own metadata — every other route in
// app/ overrides the root layout's generic title/description; this one was
// silently relying on them instead, for the single page that most needs a
// specific one.
export const metadata: Metadata = {
  title: { absolute: "Bluestift — an AI tutor that refuses to do the homework" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

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

  // The pricing cards' figures come from the plan catalogue, not from strings
  // in the component — resolved here because this is the server half, so the
  // marketing page pays no client fetch and shows no loading state.
  const [soloPrice, schoolPrice] = await Promise.all([
    pricingEntry("b2c"),
    pricingEntry("b2b"),
  ]);

  return (
    <LandingPage
      signedIn={!!user}
      homeHref={homeHref}
      soloPrice={soloPrice}
      schoolPrice={schoolPrice}
    />
  );
}
