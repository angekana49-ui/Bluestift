import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/school-admin";
import { listPlans } from "@/lib/billing";
import { hasRealEmail } from "@/lib/auth";
import { needsAgeGate } from "@/lib/compliance/guard";
import { SchoolSetup, type LayerPlan } from "@/components/school-layer/school-setup";
import { TeacherJoin } from "@/components/school-layer/teacher-join";
import { EmailRequired } from "@/components/school-layer/email-required";

/**
 * The layer between onboarding and Schools, and the single way into a school
 * for someone who is not in one yet.
 *
 *   in a school already    → /school (unless `new=1`: an admin adding another)
 *   no real email          → the email door
 *   ?as=teacher            → the join form (code, or ask the school)
 *   otherwise              → the school form, whose plan cards start the pilot
 *
 * `as` comes from onboarding's role question ("I teach at a school" / "I run a
 * school"), which is the second filter; choosing Schools over Raya, which
 * requires an email, is the first.
 */
export default async function SchoolEnterPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; new?: string }>;
}) {
  const { as, new: another } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, memberships] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, birth_year, minor_consent_source, school_id")
      .eq("id", user.id)
      .maybeSingle(),
    getMemberships(user.id),
  ]);
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  if (memberships.length > 0 && another !== "1") redirect("/school");

  if (!hasRealEmail(user.email)) return <EmailRequired />;

  if (as === "teacher") {
    return <TeacherJoin displayName={profile.display_name || profile.username || ""} email={user.email as string} />;
  }

  const plans: LayerPlan[] = (await listPlans("b2b")).map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    price: p.price,
    priceUnit: p.priceUnit,
    features: p.features,
  }));
  return <SchoolSetup plans={plans} adminEmail={user.email as string} />;
}
