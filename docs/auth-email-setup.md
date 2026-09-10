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

- **Site URL**: `http://localhost:3000` (dev) — set the production URL when you deploy.
- **Redirect URLs** (allowlist): add `http://localhost:3000/**` (and your prod URL `/**`).

The templates below use `{{ .SiteURL }}`, so Site URL must be correct.

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
