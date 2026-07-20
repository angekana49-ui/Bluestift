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

## Notes
- `type` values map to `verifyOtp` in the confirm route: `email` (signup), `magiclink`,
  `email_change`, `recovery`.
- Anonymous → permanent conversion: `updateUser({ email })` sends the **Change Email
  Address** template; confirming it upgrades the account.
- CAPTCHA (Turnstile) is separate: enable it in **Authentication → Attack Protection →
  CAPTCHA** with the secret matching `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
