import { NextResponse } from "next/server";
import { getPaymentProvider, sandboxBlockedInProd } from "@/lib/billing/payments";
import { markPaymentPaid } from "@/lib/billing/payments-data";
import { reportIssue } from "@/lib/observability/report";

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
  if (!note) {
    // Rejection is normal one-off (a probe hitting a public URL) and alarming in
    // bulk: a rotated HMAC secret makes EVERY real payment land here, and the
    // symptom is silence — nobody is told their subscription never activated.
    await reportIssue({
      scope: "billing.webhook",
      severity: "warning",
      message: "notification rejected by the provider parser",
      tags: { provider: provider.id, contentType },
    });
    return NextResponse.json({ error: "invalid notification" }, { status: 400 });
  }

  // Pending is a non-event here — wait for a terminal status.
  if (note.status === "pending") return NextResponse.json({ ok: true });

  const result = await markPaymentPaid(provider.id, note.providerRef, note.status);
  if (!result.ok) {
    // A terminal status we could not attach to a pending payment. Either the ref
    // is unknown to us or activation failed and was rolled back — both mean a
    // customer may have paid without getting anything. The provider ref is what
    // makes it fixable by hand, so it is in the record.
    await reportIssue({
      scope: "billing.webhook",
      message: "could not reconcile a settled payment",
      tags: { provider: provider.id, providerRef: note.providerRef, status: note.status },
    });
    return NextResponse.json({ error: "could not reconcile" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, subscriptionId: result.subscriptionId ?? null });
}
