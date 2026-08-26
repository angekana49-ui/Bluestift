import { createClient } from "@/lib/supabase/server";
import { listPlans, type BillingPlan } from "@/lib/billing";
import {
  normalizeRayaTier,
  normalizeSchoolTier,
  rayaComparison,
  rayaFeatureBullets,
  schoolComparison,
  schoolFeatureBullets,
} from "@/lib/entitlements";
import { PricingView } from "@/components/site/pages/PricingView";

/**
 * Replace each plan's seeded `features` with the bullets DERIVED from the
 * entitlements matrix, so the public cards can never drift from what the tier
 * actually unlocks (and enforces). The plan's name+tier is the tier signal —
 * matching how the entitlements resolver reads a plan at runtime.
 */
function withDerivedFeatures(plans: BillingPlan[], audience: "b2c" | "b2b"): BillingPlan[] {
  return plans.map((p) => {
    const signal = [p.name, p.tier].filter(Boolean).join(" ");
    const features =
      audience === "b2c"
        ? rayaFeatureBullets(normalizeRayaTier(signal))
        : schoolFeatureBullets(normalizeSchoolTier(signal));
    return { ...p, features };
  });
}

export const metadata = {
  title: "BlueStift · Pricing",
  description:
    "Simple plans for solo learners and schools. Solo starts free; schools pay per enrolled student — their effectif, not per active user.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    b2c,
    b2b,
    { for: forParam },
  ] = await Promise.all([
    supabase.auth.getUser(),
    listPlans("b2c"),
    listPlans("b2b"),
    searchParams,
  ]);

  const initialAudience = forParam === "schools" ? "schools" : "solo";

  return (
    <PricingView
      signedIn={!!user}
      b2c={withDerivedFeatures(b2c, "b2c")}
      b2b={withDerivedFeatures(b2b, "b2b")}
      // Built here rather than in the view for the same reason the bullets are:
      // the entitlements matrix is server-only, and it is the single source both
      // the cards and the table have to agree with.
      soloCompare={rayaComparison()}
      schoolCompare={schoolComparison()}
      initialAudience={initialAudience}
    />
  );
}
