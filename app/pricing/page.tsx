import { createClient } from "@/lib/supabase/server";
import { listPlans } from "@/lib/billing";
import { PricingView } from "@/components/site/pages/PricingView";

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

  return <PricingView signedIn={!!user} b2c={b2c} b2b={b2b} initialAudience={initialAudience} />;
}
