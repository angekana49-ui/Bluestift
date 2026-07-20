import { NextResponse } from "next/server";
import { getPaymentProvider, sandboxBlockedInProd } from "@/lib/billing/payments";
import { markPaymentPaid } from "@/lib/billing/payments-data";

/**
 * Aggregator payment notification (public, no session — the caller is the PSP,
 * not a browser). The provider authenticates the payload (HMAC + re-checking
 * status server-to-server for real aggregators) and we activate the subscription
 * idempotently. Always ack 2xx once handled so the PSP stops retrying.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getPaymentProvider();
  if (provider.id !== providerId) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  // The sandbox webhook is forgeable by design — never let it settle in prod.
  if (provider.id === "sandbox" && sandboxBlockedInProd()) {
    return NextResponse.json({ error: "sandbox disabled in production" }, { status: 503 });
  }

  const rawBody = await request.text();
  const contentType = request.headers.get("content-type") ?? "";
  let json: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      json = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // malformed JSON → provider will see empty body and reject
    }
  } else {
    // Most aggregators (CinetPay) POST application/x-www-form-urlencoded.
    try {
      json = Object.fromEntries(new URLSearchParams(rawBody));
    } catch {
      // leave null → provider rejects
    }
  }

  const note = await provider.parseNotification({ headers: request.headers, rawBody, json });
  if (!note) return NextResponse.json({ error: "invalid notification" }, { status: 400 });

  // Pending is a non-event here — wait for a terminal status.
  if (note.status === "pending") return NextResponse.json({ ok: true });

  const result = await markPaymentPaid(provider.id, note.providerRef, note.status);
  if (!result.ok) return NextResponse.json({ error: "could not reconcile" }, { status: 409 });
  return NextResponse.json({ ok: true, subscriptionId: result.subscriptionId ?? null });
}
