import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kernel, KernelError } from "@/lib/kernel/client";

/**
 * Authenticated /load_profile proxy: returns the student's own cognitive
 * profile (K/V/P per concept + mindset) from the Kernel. The kernel `user_id`
 * is taken from the Supabase session, never the client — identity contract.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // This call is about exactly one student, and that student is right here, so
  // it travels on their own token rather than the service secret.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const result = await kernel.loadProfile(
      { user_id: user.id },
      { accessToken: session?.access_token },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof KernelError) {
      return NextResponse.json(
        { error: "kernel_error", detail: err.body },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "internal_error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
