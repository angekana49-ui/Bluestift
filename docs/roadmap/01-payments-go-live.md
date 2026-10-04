# 01 — Payments: from founder-activated plans to online checkout

_Status 2026-10-04. Owner decision: until online payment is live, **the founder
collects payment in person or by transfer and activates plans by hand**. No
peer-to-peer "send money and paste a reference" flow: it is too much work for the
payer and too easy to get wrong._

## Where it stands

| Piece | State | Where |
|---|---|---|
| Plans, seats, pilot (45 days, ≥100 seats) | Live | `lib/billing.ts`, `schools.subscriptions` |
| **Founder console**: grant a plan to any school (by id) or person (by email) | Live, founder-only (`users.is_founder`) | `/ops/billing` → `POST /api/ops/billing/activate` |
| School admin "record a payment" form | **Live, and a hole** (see step 0) | Billing tab → `POST /api/school/billing` |
| Online checkout (card / mobile money / PayPal) | Built, **sandbox only** | `/checkout`, `POST /api/billing/checkout`, `lib/billing/payments.ts` |
| CinetPay (mobile money + card, francophone Africa) | Written, never run against the real API | `AggregatorPaymentProvider` |
| Stripe (card) | Written, never run with real keys | `StripePaymentProvider` |
| Webhooks, idempotent activation | Built and tested | `POST /api/billing/webhook/[provider]`, `lib/billing/payments-data.ts` |
| Regional prices (CFA zones) | Built | `lib/billing/regions.ts`, `schools.plan_region_prices` |
| Plan limits actually enforced | **Off** (`ENTITLEMENTS_ENFORCE=false`) | `lib/entitlements.ts` |

In production the sandbox is refused (`sandboxBlockedInProd`), so nobody can pay
online today. That is intended.

## Step 0 — close the self-activation hole (small, do first)

`POST /api/school/billing` lets any school `admin_master` activate **any plan, for
any number of months**, by declaring a payment that was "collected out of band".
Nothing checks that the money arrived, and the Billing tab shows this form to every
school admin. A school can therefore:
- lift its seat limit, and
- leave the read-only state a pilot falls into when it ends,

without paying.

That made sense when activation meant "the admin records what they paid us". Under
the founder-only model it does not. To fix it:
1. In `app/api/school/billing/route.ts` `POST`, also require
   `isPlatformOwner(user.id)` (`lib/ops.ts`). Or remove the `POST` and let
   `/api/ops/billing/activate` be the only manual path. Keep `GET` and `PATCH`
   (pilot seats) as they are.
2. In `components/school-billing.tsx`, replace the plan cards' activate form with
   a request:
   - "Contact us to activate", as a mailto link or a message sent through the
     existing contact form;
   - "Pay online" once step 2 below is live.
   Add the new strings in all four `lib/i18n` files.
3. Add a test with a mocked Supabase, following `test/analytics-events.test.ts`:
   a school admin who is not the founder gets 403 from the `POST`.

## Step 1 — the founder's routine (no code)

1. The school pays: cash, transfer or mobile money to the company account. Keep a
   receipt.
2. On `/ops/billing`, search the school, pick the plan, seats and months, and enter
   the amount, method and reference.
3. The activation emails the school admin a receipt (`sendActivationReceipt`).

Before turning `ENTITLEMENTS_ENFORCE=true` in Vercel, check that every school which
should have access has an active plan or pilot. Turning it on is what makes plan
limits real.

## Step 2 — go live online (large; needs a merchant account first)

Prerequisites that are not code:
- A registered business and a **CinetPay** merchant account (mobile money and
  cards in the CFA zones), and/or a **Stripe** account (cards; a country Stripe
  supports).
- A payments row is already on the sub-processors page (CinetPay, Stripe). Update
  its wording if the provider changes.

Then:
1. Put the keys in Vercel:
   - `BILLING_PROVIDER=cinetpay` with `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` and
     `CINETPAY_SECRET`;
   - or `BILLING_PROVIDER=stripe` with `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
2. Point the provider's notification URL at
   `https://<schools-domain>/api/billing/webhook/cinetpay` (or `/stripe`).
3. **CinetPay:** make one real small payment. Check that the HMAC the webhook
   computes matches what CinetPay sends (the field order is guessed). Then set
   `CINETPAY_STRICT_WEBHOOK=true`. The webhook already re-checks the status with
   CinetPay's `/v2/payment/check` instead of trusting the POST.
4. **PayPal:** CinetPay does not do PayPal. Either drop the PayPal button (the UI
   shows only `provider.supportedChannels`) or add a `PayPalProvider` behind the
   same `PaymentProvider` interface.
5. **One provider at a time:** `BILLING_PROVIDER` picks a single provider
   globally. Offering CinetPay to CFA-zone payers and Stripe to everyone else
   means choosing the provider per checkout. `detectZone` in `lib/billing/regions.ts`
   already knows the zone.
6. **Payments for individuals (B2C) stay in USD:** `public.users` has no country
   column. Add one, and add `plan_region_prices` rows for B2C, before charging
   local prices to individuals.
7. Remember: **only adults pay.** A minor's account can be paid for, but only
   with the guardian attestation the checkout route already requires
   (`requiresGuardianToPay`, `guardian_required`). Keep that check on every new
   payment path.

## Tests to keep green
`test/stripe-payments.test.ts`, `test/billing-terms.test.ts`,
`test/pricing-entry.test.ts`, `test/entitlements.test.ts`, `test/chat-quota.test.ts`.
