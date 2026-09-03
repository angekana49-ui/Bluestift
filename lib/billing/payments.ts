import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment-provider abstraction — the seam that keeps billing rails swappable.
 *
 * Two families live behind one interface:
 *   • MANUAL — no external checkout. An admin records a payment collected
 *     out-of-band (bank transfer, invoice) and the subscription is activated
 *     server-side. Still the right rail for institutional B2B (POs, wires).
 *   • ONLINE (aggregator) — self-serve checkout for the 3 paywalls: card /
 *     mobile money / PayPal. One aggregator (CinetPay-shaped) bundles all three
 *     as distinct channels. Flow is asynchronous: we open a hosted checkout
 *     (redirect), the payer pays, the aggregator calls our webhook, and the
 *     webhook activates the subscription. `SandboxProvider` simulates the whole
 *     loop with zero credentials so the flow is testable end-to-end.
 *
 * Callers only ever talk to this interface, so swapping the concrete aggregator
 * (or adding a native PayPal provider) never touches call sites.
 */

/** The three self-serve paywalls. Mirrors schools.payments.channel. */
export type PaymentChannel = "card" | "mobile_money" | "paypal";

/** Terminal/interim states we map every provider's vocabulary onto. */
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "cancelled";

export type CheckoutCustomer = {
  email?: string | null;
  name?: string | null;
  /** Required by most mobile-money aggregators. */
  phone?: string | null;
};

export type CheckoutInput = {
  /** Our schools.payments.id — used as the provider transaction id so the
   *  webhook can reconcile back to this exact intent. */
  paymentId: string;
  planId: string;
  channel: PaymentChannel;
  /** Amount to collect (already resolved server-side), in `currency` units. */
  amount: number | null;
  currency: string;
  description: string;
  customer?: CheckoutCustomer;
  /** Where to send the browser back after the hosted checkout. */
  returnUrl: string;
  /** Public URL the aggregator POSTs its notification to. */
  notifyUrl: string;
};

export type CheckoutResult =
  /** Manual: nothing to redirect to — the admin marks the payment as received. */
  | { mode: "manual" }
  /** Hosted checkout: send the browser to `url`. `providerRef` (token/id) is
   *  stored so the webhook can be matched even before the payer returns. */
  | { mode: "redirect"; url: string; providerRef?: string };

/** Normalized webhook read: which intent, and its new status. */
export type Notification = {
  /** Matches schools.payments.provider_ref (we set transaction_id = paymentId). */
  providerRef: string;
  status: PaymentStatus;
  /** Channel the payer actually used, if the provider reports it. */
  channel?: PaymentChannel | null;
};

export type NotificationInput = {
  headers: Headers;
  rawBody: string;
  json: unknown;
};

export interface PaymentProvider {
  readonly id: string;
  /** Channels this provider can actually process (drives which buttons show). */
  readonly supportedChannels: readonly PaymentChannel[];
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verify + normalize an incoming webhook. Returns null if invalid/unrelated. */
  parseNotification(input: NotificationInput): Promise<Notification | null>;
}

// ---- Manual (B2B out-of-band) ----------------------------------------------

/** Manual reconciliation — used by the admin activation flow, not self-serve. */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual";
  readonly supportedChannels: readonly PaymentChannel[] = [];
  async createCheckout(): Promise<CheckoutResult> {
    return { mode: "manual" };
  }
  async parseNotification(): Promise<Notification | null> {
    return null;
  }
}

// ---- Sandbox (zero-credential, all 3 channels) -----------------------------

/**
 * Simulated aggregator. `createCheckout` redirects to an internal page that lets
 * you approve/decline; that page posts to our webhook with `{ paymentId, status }`.
 * Lets the full pending→paid→activate loop run with no external account or keys.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = "sandbox";
  readonly supportedChannels: readonly PaymentChannel[] = ["card", "mobile_money", "paypal"];

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // The paymentId doubles as the provider ref in sandbox.
    const url = new URL(input.returnUrl);
    const base = `${url.protocol}//${url.host}`;
    const pay = new URL("/checkout/sandbox", base);
    pay.searchParams.set("pid", input.paymentId);
    pay.searchParams.set("channel", input.channel);
    return { mode: "redirect", url: pay.toString(), providerRef: input.paymentId };
  }

  async parseNotification({ json }: NotificationInput): Promise<Notification | null> {
    const body = (json ?? {}) as { paymentId?: unknown; status?: unknown; channel?: unknown };
    if (typeof body.paymentId !== "string") return null;
    const status = normalizeStatus(String(body.status ?? "paid"));
    if (!status) return null;
    return {
      providerRef: body.paymentId,
      status,
      channel: isChannel(body.channel) ? body.channel : null,
    };
  }
}

// ---- Aggregator (CinetPay-shaped hosted checkout) --------------------------

/** Map our channel to the aggregator's channel code (CinetPay vocabulary). */
const AGGREGATOR_CHANNEL: Record<PaymentChannel, string> = {
  card: "CREDIT_CARD",
  mobile_money: "MOBILE_MONEY",
  paypal: "PAYPAL",
};

/**
 * Real hosted-checkout provider, shaped after CinetPay's `/v2/payment` init +
 * server notification. Activates only when the `CINETPAY_*` env keys are present
 * (see getPaymentProvider). Kept defensive: any transport/shape error surfaces as
 * a thrown checkout error (the route turns that into a user-facing failure) and an
 * unverifiable webhook returns null (ignored).
 *
 * NOTE: the exact channel codes / PayPal availability depend on the aggregator
 * account. Swap AGGREGATOR_CHANNEL + the endpoints if you contract PayDunya /
 * Flutterwave instead; the interface above does not change.
 */
export class AggregatorPaymentProvider implements PaymentProvider {
  readonly supportedChannels: readonly PaymentChannel[] = ["card", "mobile_money", "paypal"];

  constructor(
    readonly id: string,
    private readonly cfg: { apiKey: string; siteId: string; baseUrl: string; secret?: string },
  ) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/v2/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apikey: this.cfg.apiKey,
        site_id: this.cfg.siteId,
        transaction_id: input.paymentId, // reconcile webhook back to our intent
        amount: input.amount ?? 0,
        currency: input.currency,
        channels: AGGREGATOR_CHANNEL[input.channel],
        description: input.description,
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
        customer_email: input.customer?.email ?? undefined,
        customer_name: input.customer?.name ?? undefined,
        customer_phone_number: input.customer?.phone ?? undefined,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      code?: string;
      data?: { payment_url?: string; payment_token?: string };
    } | null;
    const url = data?.data?.payment_url;
    if (!res.ok || !url) throw new Error("Aggregator checkout could not be created.");
    return { mode: "redirect", url, providerRef: data?.data?.payment_token ?? input.paymentId };
  }

  async parseNotification({ headers, json }: NotificationInput): Promise<Notification | null> {
    // CinetPay posts form-encoded fields incl. the transaction id. Two guards:
    //   1. authenticity — verify the HMAC `x-token` (soft by default; hard with
    //      CINETPAY_STRICT_WEBHOOK once the field order is confirmed live).
    //   2. truth — re-verify status server-to-server; never trust the POST's status.
    // The re-check is the real security boundary: a forged POST can't fake "paid".
    const body = (json ?? {}) as Record<string, unknown>;
    const ref =
      (typeof body.cpm_trans_id === "string" && body.cpm_trans_id) ||
      (typeof body.transaction_id === "string" && body.transaction_id) ||
      null;
    if (!ref) return null;

    if (this.cfg.secret && !verifyCinetpayToken(body, headers, this.cfg.secret)) {
      const strict = process.env.CINETPAY_STRICT_WEBHOOK === "true";
      console.warn(
        `[billing] CinetPay webhook HMAC mismatch for ${ref}` +
          (strict ? " — rejected" : " — soft, falling back to server re-check"),
      );
      if (strict) return null;
    }

    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/v2/payment/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apikey: this.cfg.apiKey, site_id: this.cfg.siteId, transaction_id: ref }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as {
      code?: string;
      data?: { status?: string; payment_method?: string };
    } | null;
    if (!data) return null;
    // "00" = accepted/paid. Anything not clearly terminal stays `pending` (a no-op
    // upstream), so a stray notification can never flip a live payment to failed.
    const status: PaymentStatus =
      data.code === "00" ? "paid" : normalizeStatus(data.data?.status ?? "") ?? "pending";
    return { providerRef: ref, status };
  }
}

// ---- Stripe (hosted Checkout Session) --------------------------------------

/**
 * Currencies Stripe treats as having NO minor unit.
 *
 * This is the single most dangerous line in the file. Stripe wants the amount in
 * the smallest currency unit, so $8 is `800` — but XOF, the West African CFA
 * franc this product will actually bill most of its schools in, has no centimes.
 * Multiplying it by 100 does not round oddly, it charges a hundred times the
 * price: a 5 000 XOF invoice presented as 500 000. The mistake looks like a
 * working integration right up until a real card is used.
 *
 * XOF and XAF (Central African CFA) are both here, alongside the rest of
 * Stripe's zero-decimal set.
 */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/** Amount in the unit Stripe charges in. Exported for the test that pins XOF. */
export function stripeMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

/**
 * Stripe Checkout, behind the same seam as everything else.
 *
 * WHY IT EXISTS ALONGSIDE THE AGGREGATOR, not instead of it. Stripe does not do
 * African mobile money, and mobile money is how most of this product's users
 * would pay; CinetPay does mobile money and is not how an international school
 * or a card-paying parent in Europe expects to pay. They are complementary
 * rails, not competing ones — which is why `supportedChannels` here is `card`
 * alone rather than the three the aggregator claims. A provider that overstates
 * its channels renders buttons that fail at the last step.
 *
 * `BILLING_PROVIDER` still picks ONE globally, so today choosing Stripe means no
 * mobile money and choosing CinetPay means no Stripe. That is a real limitation
 * and is written down in the README rather than papered over: routing by the
 * payer's region is a separate change, and pretending this is already regional
 * would be worse than saying it is not.
 *
 * The paywall is closed, so nothing here is exercised by a real payer yet. It is
 * written now because the shape of the webhook — verified against a raw body,
 * with a replay window — is not something to discover on the day money starts
 * moving.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe";
  /** Card only. See the class comment: mobile money is not a Stripe rail. */
  readonly supportedChannels: readonly PaymentChannel[] = ["card"];

  constructor(
    private readonly cfg: { secretKey: string; webhookSecret?: string; baseUrl?: string },
  ) {}

  private get api() {
    return (this.cfg.baseUrl ?? "https://api.stripe.com").replace(/\/$/, "");
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // Stripe's API is form-encoded, including its bracketed nested keys — there
    // is no JSON variant, and sending JSON fails with a confusing 400.
    const form = new URLSearchParams({
      mode: "payment",
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      // Both, deliberately: client_reference_id is what shows in the dashboard
      // and survives to most events, metadata is what we read back in the
      // webhook. Reconciling a real payment by hand is the case they are for.
      client_reference_id: input.paymentId,
      "metadata[payment_id]": input.paymentId,
      "metadata[plan_id]": input.planId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(
        stripeMinorUnits(input.amount ?? 0, input.currency),
      ),
      "line_items[0][price_data][product_data][name]": input.description,
    });
    if (input.customer?.email) form.set("customer_email", input.customer.email);

    const res = await fetch(`${this.api}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.cfg.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        // Our paymentId is unique per intent, so a retried checkout creation
        // reuses the same session instead of opening a second one the payer
        // could also complete.
        "idempotency-key": `checkout_${input.paymentId}`,
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; url?: string } | null;
    if (!res.ok || !data?.url) throw new Error("Stripe checkout could not be created.");
    return { mode: "redirect", url: data.url, providerRef: input.paymentId };
  }

  async parseNotification({ headers, rawBody, json }: NotificationInput): Promise<Notification | null> {
    /**
     * Unlike the aggregator, there is no server-to-server re-check to fall back
     * on: the signature IS the security boundary, so it is hard-required rather
     * than soft. Without a configured secret this refuses everything — an
     * unsigned "paid" event grants a subscription for free.
     */
    if (!this.cfg.webhookSecret) return null;
    if (!verifyStripeSignature(rawBody, headers.get("stripe-signature"), this.cfg.webhookSecret)) {
      return null;
    }

    const event = (json ?? {}) as {
      type?: unknown;
      data?: { object?: Record<string, unknown> };
    };
    const object = event.data?.object ?? {};
    const meta = (object.metadata ?? {}) as Record<string, unknown>;
    const ref =
      (typeof meta.payment_id === "string" && meta.payment_id) ||
      (typeof object.client_reference_id === "string" && object.client_reference_id) ||
      null;
    if (!ref) return null;

    // Only the events that settle something. Anything else is `pending`, which
    // is a no-op upstream — a stray event must never flip a live payment.
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        // `completed` fires for delayed methods before the money arrives, so the
        // payment_status field is what decides, not the event name.
        return {
          providerRef: ref,
          status: object.payment_status === "paid" ? "paid" : "pending",
          channel: "card",
        };
      case "checkout.session.async_payment_failed":
        return { providerRef: ref, status: "failed", channel: "card" };
      case "checkout.session.expired":
        return { providerRef: ref, status: "expired", channel: "card" };
      default:
        return { providerRef: ref, status: "pending" };
    }
  }
}

/**
 * Verify Stripe's `Stripe-Signature` header: `t=<unix>,v1=<hex>[,v1=<hex>]`,
 * where the signed payload is `${t}.${rawBody}` under HMAC-SHA256.
 *
 * Two things this must get right, both of which are easy to skip and neither of
 * which fails visibly:
 *
 *  - the RAW body, byte for byte. Re-serialising the parsed JSON changes key
 *    order and whitespace and every signature stops matching.
 *  - the TIMESTAMP window. Without it a valid old event can be replayed forever
 *    — the signature never expires on its own. Five minutes is Stripe's own
 *    recommendation and is generous next to a webhook's normal latency.
 */
const STRIPE_TOLERANCE_S = 5 * 60;

export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!header || !secret) return false;
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = v ?? null;
    // Stripe sends several v1 entries while a secret is being rotated.
    else if (k?.trim() === "v1" && v) signatures.push(v.trim());
  }
  if (!timestamp || signatures.length === 0) return false;

  const t = Number(timestamp);
  if (!Number.isFinite(t)) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > STRIPE_TOLERANCE_S) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  return signatures.some((sig) => {
    let given: Buffer;
    try {
      given = Buffer.from(sig, "hex");
    } catch {
      return false;
    }
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// ---- Selection --------------------------------------------------------------

/**
 * The active ONLINE provider. `BILLING_PROVIDER` selects it (default `sandbox`).
 * The aggregator is only used when its credentials are set — otherwise we fall
 * back to sandbox so a missing key never breaks checkout in dev/preview.
 */
export function getPaymentProvider(): PaymentProvider {
  const which = (process.env.BILLING_PROVIDER ?? "sandbox").toLowerCase();
  if (which === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      return new StripePaymentProvider({
        secretKey,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        baseUrl: process.env.STRIPE_BASE_URL,
      });
    }
  }
  if (which === "cinetpay") {
    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;
    const baseUrl = process.env.CINETPAY_BASE_URL ?? "https://api-checkout.cinetpay.com";
    if (apiKey && siteId) {
      return new AggregatorPaymentProvider("cinetpay", { apiKey, siteId, baseUrl, secret: process.env.CINETPAY_SECRET });
    }
  }
  return new SandboxPaymentProvider();
}

/**
 * True when the sandbox provider must NOT be used — i.e. we're in production and
 * it hasn't been explicitly allowed. The sandbox webhook is public and activates
 * real subscriptions, so shipping to prod without real credentials (which would
 * silently fall back to sandbox) must be refused, not fulfilled with free plans.
 */
export function sandboxBlockedInProd(): boolean {
  const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  return isProd && process.env.ALLOW_SANDBOX_BILLING !== "true";
}

/**
 * Is there a real cashier — can a visitor actually hand us money right now?
 *
 * A DIFFERENT question from `sandboxBlockedInProd`, and the two are easy to
 * confuse. That one asks "would pressing pay fail outright", which is false in
 * development, where the sandbox completes the loop end to end and is meant to.
 * This one asks whether the money at the end of that loop is real, and the
 * sandbox's never is — so it is not live anywhere, production or not.
 *
 * Read by lib/entitlements to decide whether the plan limits block or only
 * count. Deliberately derived from the provider itself rather than re-reading
 * the same env vars: a second copy of that condition would drift from
 * `getPaymentProvider` the first time a rail is added, and it would drift
 * silently, in the direction of walling people off with no way through.
 */
export function billingIsLive(): boolean {
  return getPaymentProvider().id !== "sandbox";
}

// ---- helpers ----------------------------------------------------------------

function isChannel(v: unknown): v is PaymentChannel {
  return v === "card" || v === "mobile_money" || v === "paypal";
}

/**
 * Verify CinetPay's HMAC-SHA256 notification token (`x-token` header) against the
 * documented field concatenation, keyed by the API secret, in constant time.
 * NOTE: the exact field set/order can vary by CinetPay API version — confirm it
 * against your account before enabling CINETPAY_STRICT_WEBHOOK.
 */
function verifyCinetpayToken(body: Record<string, unknown>, headers: Headers, secret: string): boolean {
  const token = headers.get("x-token");
  if (!token) return false;
  const f = (k: string) => (body[k] == null ? "" : String(body[k]));
  const payload =
    f("cpm_site_id") + f("cpm_trans_id") + f("cpm_trans_date") + f("cpm_amount") + f("cpm_currency") +
    f("signature") + f("payment_method") + f("cel_phone_num") + f("cpm_phone_prefixe") + f("cpm_language") +
    f("cpm_version") + f("cpm_payment_config") + f("cpm_page_action") + f("cpm_custom") + f("cpm_designation") +
    f("cpm_error_message");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Fold provider-specific status vocabulary onto our enum. */
function normalizeStatus(raw: string): PaymentStatus | null {
  const s = raw.toLowerCase();
  if (["paid", "accepted", "success", "successful", "completed", "00"].includes(s)) return "paid";
  if (["failed", "refused", "declined", "error"].includes(s)) return "failed";
  if (["expired"].includes(s)) return "expired";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (["pending", "waiting", "created"].includes(s)) return "pending";
  return null;
}
