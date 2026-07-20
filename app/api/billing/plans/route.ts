import { NextResponse } from "next/server";
import { listPlans } from "@/lib/billing";

/**
 * Public plan catalog (active plans). `?category=b2c` for student-facing plans,
 * `?category=b2b` for schools. Read via the service role inside listPlans — the
 * catalog is not sensitive, so no auth is required.
 */
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const filter = category === "b2b" || category === "b2c" ? category : undefined;
  const plans = await listPlans(filter);
  return NextResponse.json({ plans });
}
