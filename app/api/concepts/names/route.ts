import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadConceptNames } from "@/lib/kernel/concept-names-server";

/**
 * GET → `{ names }`: every Kernel concept's readable name per locale, for the
 * client hook `useConceptName()`.
 *
 * Signed-in only. The names are curriculum vocabulary, not anyone's data, but
 * the Kernel creates concepts from what students write, and a label is not
 * guaranteed to say nothing about a conversation.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const names = await loadConceptNames();
  return NextResponse.json(
    { names },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
