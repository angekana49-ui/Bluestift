import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { stripeMinorUnits, verifyStripeSignature } from "@/lib/billing/payments";

/**
 * The Stripe rail. Written before the paywall opens, because the two things
 * below are not things to discover on the day money starts moving.
 */

describe("amounts", () => {
  it("charges XOF without inventing a minor unit", () => {
    /**
     * The most dangerous line in the integration. Stripe wants the smallest
     * currency unit, so $8 is 800 — but the CFA franc has no centimes, and
     * multiplying it by 100 does not round oddly, it charges a hundred times the
     * price. A 5 000 XOF invoice presented as 500 000.
     *
     * This is not a hypothetical currency for this product: it is what most of
     * its schools would actually be invoiced in.
     */
    expect(stripeMinorUnits(5000, "XOF")).toBe(5000);
    expect(stripeMinorUnits(5000, "xof")).toBe(5000); // case is not a bug source
    expect(stripeMinorUnits(2500, "XAF")).toBe(2500); // Central African CFA too
  });

  it("still converts the currencies that DO have minor units", () => {
    expect(stripeMinorUnits(8, "USD")).toBe(800);
    expect(stripeMinorUnits(8, "EUR")).toBe(800);
    expect(stripeMinorUnits(19.99, "USD")).toBe(1999);
  });

  it("rounds rather than truncating a float", () => {
    // 0.1 + 0.2 arithmetic reaching a payment amount is how you get a 1-cent
    // discrepancy that nobody can reconcile.
    expect(stripeMinorUnits(4.005, "USD")).toBe(401);
    expect(stripeMinorUnits(1.1 * 3, "USD")).toBe(330);
  });
});

describe("webhook signatures", () => {
  const SECRET = "whsec_test_secret";
  const BODY = JSON.stringify({ type: "checkout.session.completed", id: "evt_1" });
  const NOW = 1_800_000_000_000; // fixed clock, so the tolerance test is stable

  const sign = (body: string, t: number, secret = SECRET) =>
    `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex")}`;

  it("accepts a signature it just made", () => {
    const t = Math.floor(NOW / 1000);
    expect(verifyStripeSignature(BODY, sign(BODY, t), SECRET, NOW)).toBe(true);
  });

  it("refuses a body that changed by one byte", () => {
    const t = Math.floor(NOW / 1000);
    const header = sign(BODY, t);
    expect(verifyStripeSignature(BODY + " ", header, SECRET, NOW)).toBe(false);
    // The realistic version of that: re-serialising the parsed JSON. Key order
    // and whitespace both move, and every signature stops matching — which is
    // why the route hands the provider the RAW body.
    const reserialized = JSON.stringify(JSON.parse(BODY));
    const reordered = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    expect(verifyStripeSignature(reserialized, header, SECRET, NOW)).toBe(true); // identical here
    expect(verifyStripeSignature(reordered, header, SECRET, NOW)).toBe(false);
  });

  it("refuses the wrong secret", () => {
    const t = Math.floor(NOW / 1000);
    expect(verifyStripeSignature(BODY, sign(BODY, t, "whsec_other"), SECRET, NOW)).toBe(false);
  });

  it("refuses a replayed event, however valid its signature", () => {
    // A signature never expires on its own. Without the timestamp window, one
    // captured "paid" event grants a subscription again every time it is
    // re-POSTed, forever.
    const old = Math.floor(NOW / 1000) - 10 * 60;
    expect(verifyStripeSignature(BODY, sign(BODY, old), SECRET, NOW)).toBe(false);
    // And a timestamp from the future is equally suspect.
    const future = Math.floor(NOW / 1000) + 10 * 60;
    expect(verifyStripeSignature(BODY, sign(BODY, future), SECRET, NOW)).toBe(false);
  });

  it("accepts one of several v1 entries, so a secret can be rotated", () => {
    const t = Math.floor(NOW / 1000);
    const good = sign(BODY, t).split("v1=")[1];
    const header = `t=${t},v1=deadbeef,v1=${good}`;
    expect(verifyStripeSignature(BODY, header, SECRET, NOW)).toBe(true);
  });

  it("refuses everything when the header or the secret is missing", () => {
    const t = Math.floor(NOW / 1000);
    expect(verifyStripeSignature(BODY, null, SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(BODY, sign(BODY, t), "", NOW)).toBe(false);
    expect(verifyStripeSignature(BODY, "garbage", SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(BODY, `t=${t}`, SECRET, NOW)).toBe(false); // no v1
    expect(verifyStripeSignature(BODY, "t=notanumber,v1=aa", SECRET, NOW)).toBe(false);
  });
});
