# Auth email setup (Resend + Supabase)

The app uses the Supabase SSR **token-hash** verification flow. All email links must
point to `/auth/confirm?token_hash=...&type=...` — already handled by
`app/auth/confirm/route.ts`. Do the three dashboard steps below.

## 1. SMTP (Resend)

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your **Resend API key** (`re_...`) |
| Sender email | an address on your **verified Resend domain** (e.g. `no-reply@yourdomain.com`) |
| Sender name | `Bluestift` |

> The sender domain must be verified in Resend (DNS records) or delivery fails.

## 2. URL configuration

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: the production apex, e.g. `https://thebluestift.com`. `http://localhost:3000`
  is the dev value and **must not survive a deploy** — see the failure below.
- **Redirect URLs** (allowlist): every origin that signs anyone in.

```
https://thebluestift.com/**
https://schools.thebluestift.com/**
https://www.raya.thebluestift.com/**      ← spell out a two-label host
http://localhost:3000/**
```

> **`https://*.thebluestift.com/**` does not cover `www.raya.thebluestift.com`.**
> The wildcard matches one label, so it covers `schools.` and `raya.` but not a
> host with two labels in front. If DNS made a product live at `www.raya.`
> rather than `raya.`, that origin needs its own line.

### The failure this causes, and why it is hard to read

Every `signInWithOtp` / `updateUser` call in the app asks for
`${window.location.origin}/auth/callback?next=/account`. Supabase honours that
**only if it is allowlisted**. When it is not, it does not error — it silently
substitutes the **Site URL**. So one missing allowlist entry produces:

- links that point at the wrong host (localhost, if that value was left in place), and
- a landing at the **root** with `?code=…` instead of `/auth/callback?code=…`,

…for **every** email the product sends, all at once. Both symptoms, one cause.
`app/page.tsx` now forwards a stray `?code=` to `/auth/callback` so the sign-in
still completes, but that is a safety net: the wrong host in the email is the
symptom that tells you the configuration, not the code, is what needs fixing.

### The app sends its own email too — different wiring, same symptom

Two circuits share one Resend account, and a link can break in either:

| | Supabase auth mail (magic link, confirm, email change) | App mail (`lib/email.ts` — invites, join requests, receipts, share links) |
|---|---|---|
| Sent by | Supabase, through Resend as SMTP relay | the app, through the Resend API |
| Link built from | `{{ .SiteURL }}` (§2 above) | `siteUrl(surface)` → `NEXT_PUBLIC_SITE_URL` / `_RAYA_URL` / `_SCHOOLS_URL` |
| Breaks when | Site URL / allowlist are wrong in the dashboard | those vars are unset **in the build** |

`NEXT_PUBLIC_*` is inlined at **build** time, so setting it in Vercel does not
repair a deployment already built without it — rebuild, don't redeploy. Unset,
`siteUrl()` now falls back to `SITE_URL` (production) rather than the old
`https://app.bluestift.local`, which resolved nowhere and turned every app
email into a dead link while the send itself reported success.

Checking both takes two minutes: request a magic link and look at the host in
the URL, then trigger one app email (a staff invite is easiest) and look at the
host in its button.

## 3. Email templates

Supabase Dashboard → **Authentication → Emails → Templates**. Replace each template's
link with the versions below (English, token-hash flow).

### Confirm signup
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Confirm your email</a></p>
```

### Magic Link
```html
<h2>Sign in to Bluestift</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/">Log in</a></p>
```

### Change Email Address (used when an anonymous account links an email)
```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/">Confirm change</a></p>
```

### Reset Password (only if password auth is enabled later)
```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset">Reset password</a></p>
```

## 4. CAPTCHA (Turnstile)

One Cloudflare widget, **three** consumers. All three must agree, and the third is
the one people forget — it lives in a dashboard, not in this repo.

| Where | What goes there |
|---|---|
| Cloudflare → Turnstile → your widget | the source of truth: a site key, a secret key, and a **Domains** list |
| App env (`.env.local`, Vercel) | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (renders the widget) and `TURNSTILE_SECRET_KEY` (verifies the public content forms — survey, contact, feedback, wall, contribute) |
| Supabase → **Authentication → Attack Protection → CAPTCHA** | its **own copy of the secret key**, used to verify the token on `signInWithOtp` / `signInAnonymously` |

**Rotating the keys means updating all three.** Changing them in Cloudflare and the
app but not in Supabase leaves every sign-in failing, and the error blames the
captcha rather than the mismatch.

**The Domains list must contain every host that serves the app** — the apex, each
product subdomain (`schools.`, `raya.` — and `www.raya.` if that is the one DNS
actually resolves), plus any `*.vercel.app` preview you sign in from. A host that
isn't listed produces a token the widget will not validate.

### A token is single-use — exactly one side may redeem it

Whoever calls Cloudflare's `siteverify` first **spends** the token; the next caller
gets `timeout-or-duplicate`. So each route picks one redeemer, and the choice
follows whether the token is passed on (`test/auth.test.ts` pins this):

| Path | Redeemer | Why |
|---|---|---|
| `signInWithOtp` from the browser (magic link) | Supabase | the app server never sees the token |
| `/api/auth/anon` | Supabase, inside `signInAnonymously` | the route passes the token on, so it must not spend it first — it only refuses a *missing* one, which costs no redemption |
| `/api/auth/recover`, real email | Supabase, inside `signInWithOtp` | same reason |
| `/api/auth/recover`, email-less account | **the route**, via `verifyTurnstile` | nothing downstream sees the token, so this is the only place a captcha can be enforced at all |

Adding a "defensive" `verifyTurnstile()` in front of a path that already hands the
token to Supabase does not harden it — it breaks it.

## Notes
- `type` values map to `verifyOtp` in the confirm route: `email` (signup), `magiclink`,
  `email_change`, `recovery`.
- Anonymous → permanent conversion: `updateUser({ email })` sends the **Change Email
  Address** template; confirming it upgrades the account.
