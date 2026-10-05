import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ageGateResponse } from "@/lib/compliance/api-gate";
import { reportError } from "@/lib/observability/report";
import { kernel, KernelError } from "@/lib/kernel/client";
import { limitExpensive } from "@/lib/abuse-limits";

/**
 * "Why am I stuck on this?" — the Kernel's /prerequisite_gaps for the signed-in
 * student and one of their own concepts (Kernel handoff §2).
 *
 * A pure read on the Kernel side (no LLM, no state written), so it is safe on
 * demand. The `user_id` comes from the session, never from the client, and the
 * call travels on the student's own token like the profile proxy beside it.
 *
 * An unknown concept is the Kernel's 404 — answered here as `notFound` rather
 * than an error, because "the Kernel has never seen this concept" is an answer.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gated = await ageGateResponse(user.id);
  if (gated) return gated;

  const concept = (new URL(request.url).searchParams.get("concept") ?? "").trim().slice(0, 128);
  if (!concept) return NextResponse.json({ error: "concept required" }, { status: 400 });

  // Same budget as the profile: a person opening a few concepts, not a script.
  const limited = await limitExpensive("kernelProfile", user.id);
  if (limited) return limited;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const result = await kernel.prerequisiteGaps(
      { user_id: user.id, concept_label: concept, max_hops: 4, include_resources: false },
      // A sleeping Kernel container can outlast the default on a cold start;
      // the learner pressed a button and can wait a few seconds.
      { accessToken: session?.access_token, timeoutMs: 20_000 },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof KernelError && err.status === 404) {
      return NextResponse.json({ notFound: true });
    }
    if (err instanceof KernelError) {
      await reportError("kernel.prerequisites", err, { tags: { status: err.status } });
      return NextResponse.json({ error: "kernel_error" }, { status: 502 });
    }
    await reportError("kernel.prerequisites", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
