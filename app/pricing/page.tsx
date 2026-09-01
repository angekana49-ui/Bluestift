import { createClient } from "@/lib/supabase/server";
import { listPlans, type BillingPlan } from "@/lib/billing";
import {
  normalizeRayaTier,
  normalizeSchoolTier,
  rayaComparison,
  rayaFeatureBullets,
  rayaTagline,
  schoolComparison,
  schoolFeatureBullets,
  schoolTagline,
} from "@/lib/entitlements";
import { PricingView } from "@/components/site/pages/PricingView";
import { getServerTranslate } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

/**
 * Replace each plan's seeded copy with what is DERIVED from the entitlements
 * matrix, so the public cards can never drift from what the tier actually
 * unlocks (and enforces). The plan's name+tier is the tier signal — matching
 * how the entitlements resolver reads a plan at runtime.
 *
 * `description` is replaced as well as `features`, and it was the more
 * dangerous of the two. Only the bullets were derived, so the seeded
 * description sat directly above them as the card's last unchecked sentence —
 * still promising the Max "priority" that had just been removed from the
 * bullets for describing a queue that does not exist. A single hand-authored
 * line among derived ones is where a retired claim goes to survive.
 */
function withDerivedCopy(plans: BillingPlan[], audience: "b2c" | "b2b", tr: (key: MessageKey) => string): BillingPlan[] {
  return plans.map((p) => {
    const signal = [p.name, p.tier].filter(Boolean).join(" ");
    return audience === "b2c"
      ? {
          ...p,
          description: rayaTagline(normalizeRayaTier(signal), tr),
          features: rayaFeatureBullets(normalizeRayaTier(signal), tr),
        }
      : {
          ...p,
          description: schoolTagline(normalizeSchoolTier(signal), tr),
          features: schoolFeatureBullets(normalizeSchoolTier(signal), tr),
        };
  });
}

export const metadata = {
  title: "BlueStift · Pricing",
  description:
    "Simple plans for solo learners and schools. Solo starts free; schools pay per enrolled student — their size, not per active user.",
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
    tr,
  ] = await Promise.all([
    supabase.auth.getUser(),
    listPlans("b2c"),
    listPlans("b2b"),
    searchParams,
    getServerTranslate(),
  ]);

  const initialAudience = forParam === "schools" ? "schools" : "solo";

  return (
    <PricingView
      signedIn={!!user}
      b2c={withDerivedCopy(b2c, "b2c", tr)}
      b2b={withDerivedCopy(b2b, "b2b", tr)}
      // Built here rather than in the view for the same reason the bullets are:
      // the entitlements matrix is server-only, and it is the single source both
      // the cards and the table have to agree with.
      soloCompare={rayaComparison(tr)}
      schoolCompare={schoolComparison(tr)}
      initialAudience={initialAudience}
    />
  );
}
