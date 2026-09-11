import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  // Same claim the hero's own chip makes ("site.hero.eyebrow"), so the tab and
  // the first thing on the page say one thing rather than two. Kept `absolute`
  // (no "· Bluestift" template suffix) with the brand spelled out in front —
  // a landing page's tab has to carry the name.
  title: { absolute: "Bluestift — The collaborative AI for education" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * An auth code that lands HERE is a misconfiguration, and it used to be a
 * silent one.
 *
 * Every `signInWithOtp` / `updateUser` call in this app asks for
 * `${origin}/auth/callback?next=/account`. Supabase honours that only if the
 * URL is in its **Redirect URLs** allowlist; when it is not, it silently
 * substitutes the project's **Site URL** — so the link in the email arrives at
 * the root of whatever that is set to, carrying `?code=` with it. The landing
 * page then rendered marketing copy over a perfectly valid, single-use auth
 * code and dropped it: no session, no error, nothing to report.
 *
 * Forwarding it costs one redirect and turns that dead end into a working
 * sign-in. It does NOT paper over the misconfiguration — the email still shows
 * the wrong host, which is the visible symptom that gets it fixed (see
 * docs/auth-email-setup.md §2) — it only stops the user paying for it.
 *
 * Root only, deliberately: `?code=` is a legitimate parameter elsewhere in the
 * product (a school's class access code), and a blanket rule in the proxy
 * would hijack that flow. Nothing legitimately sends `?code=` to `/`.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  // The same fallback delivers Supabase's failures here too (an expired or
  // already-used link). /login knows how to say that; the landing page does not.
  if (error) redirect("/login?error=auth");

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
