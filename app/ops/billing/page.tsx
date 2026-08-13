import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformOwner } from "@/lib/ops";
import { OpsBillingForm } from "@/components/ops/ops-billing-form";

/**
 * Founder-only manual activation console — not linked from any nav, gated on
 * `users.is_founder` (see lib/ops.ts). A non-owner (including a signed-out
 * visitor) gets a plain 404, same as a route that doesn't exist, so this page
 * never confirms its own existence to anyone but the owner.
 */
export default async function OpsBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) notFound();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Manual billing activation</h1>
      <p style={{ fontSize: 14, color: "#6b7794", margin: "0 0 28px" }}>
        Grants a plan directly — payment collected out-of-band. Individual (B2C) plans activate
        by email; school (B2B) plans activate by school id and respect the same seat floor as the
        school&apos;s own self-service activation.
      </p>
      <OpsBillingForm />
    </main>
  );
}
