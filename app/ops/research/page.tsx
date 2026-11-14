import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformOwner } from "@/lib/ops";
import { OpsResearchForm } from "@/components/ops/ops-research-form";

/**
 * Founder-only research review console — not linked from any nav, gated on
 * `users.is_founder` (see lib/ops.ts). A non-owner (including a signed-out
 * visitor) gets a plain 404, same as a route that doesn't exist.
 *
 * Pending contributions wait here with their quarantined file; approving
 * copies the file to the public research-media bucket and publishes the post
 * to /research. Copy stays hardcoded English: this console has one reader.
 */
export default async function OpsResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) notFound();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Research review queue</h1>
      <p style={{ fontSize: 15, color: "#6b7794", margin: "0 0 28px" }}>
        Pending contributions and their quarantined files. Approve to publish to /research, reject to drop.
      </p>
      <OpsResearchForm />
    </main>
  );
}
