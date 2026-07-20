import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/routing";
import { LoginView } from "@/components/login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /login is the ALWAYS-REACHABLE door. A *finished* account never sits here —
  // it goes home. But a half-finished one (e.g. you tapped "Start anonymously",
  // then changed your mind) must NOT be bounced to /onboarding: that trapped
  // people in a setup they wanted to leave, with no way back to pick another
  // sign-in method. We render the door instead, with a "resume or switch" banner.
  let pendingSetup = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("account_state")
      .eq("id", user.id)
      .single();
    if (profile && profile.account_state !== "onboarding_pending") {
      redirect(await resolveHome(user.id));
    }
    pendingSetup = true;
  }

  const { error } = await searchParams;

  return (
    <main style={{ minHeight: "100vh", width: "100%" }}>
      <LoginView initialError={error} pendingSetup={pendingSetup} />
    </main>
  );
}
