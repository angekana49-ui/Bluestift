import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kernel, KernelError, clampHistory } from "@/lib/kernel/client";
import type { KernelMessage } from "@/lib/kernel/types";

/**
 * Example server route: proxy an authenticated /analyze call to the Kernel.
 * The kernel `user_id` is taken from the Supabase session (== public.users.id),
 * never from the client body — this is the backend<->kernel identity contract.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    conversation_history?: KernelMessage[];
    subject?: string;
    level?: string;
    trigger?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    !Array.isArray(body.conversation_history) ||
    body.conversation_history.length === 0
  ) {
    return NextResponse.json(
      { error: "conversation_history is required" },
      { status: 400 },
    );
  }

  // About one student, who is the caller: send their token, not the skeleton key.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const result = await kernel.analyze(
      {
        user_id: user.id,
        conversation_history: clampHistory(body.conversation_history),
        subject: body.subject,
        level: body.level,
        trigger: body.trigger,
      },
      { accessToken: session?.access_token },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof KernelError) {
      // The kernel rate-limits /analyze to bound LLM cost. That's a "come back
      // later", not a failure — passing it through as 502 would invite the
      // caller to retry immediately, which is exactly what tripped the limit.
      if (err.status === 429) {
        return NextResponse.json(
          { error: "rate_limited", detail: err.body },
          { status: 429 },
        );
      }
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
