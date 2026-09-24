# Prepared updates — written, tested, not plugged in

_Written 2026-09-24._

Two roadmap items from `docs/project-status.md` §6.8 ("Later") are prepared
here: **Social v1** (friendships + notifications) and **Newsletter v1**
(double opt-in, unsubscribe, issues and posts written in the product, sending).

"Prepared" means precisely this, and nothing more:

- the code is in the repo, type-checked and unit-tested;
- the schema changes are **draft migrations** in `supabase/drafts/`, which
  nothing applies;
- **no route, page, component, cron or proxy imports any of it** —
  `test/prepared-updates.test.ts` fails if one does;
- each server entry point also refuses behind its own env switch, so even an
  accidental import cannot turn a feature on.

The only change to live code is `lib/email.ts` exporting two helpers it
already had (`fromHeader`, `replyTo`), so the newsletter batch send uses the
same sending identity as every other email. Behaviour is unchanged.

---

## Social v1

| File | What it is |
|---|---|
| `supabase/drafts/social_v1.sql` | RLS fix + constraints for `learning.friendships` and `learning.notifications` |
| `lib/social/rules.ts` | Pure: the friendship state machine and the who-may-connect rule |
| `lib/social/notification-types.ts` | Pure: typed payload per notification type, validated on read |
| `lib/social/friendships.ts` | Server: the only write path for friendships (service role) |
| `lib/social/notifications.ts` | Server: create / list / count unread / mark read |

### Why the draft migration is not optional

Both tables exist live, empty, with RLS on — but each has a single `FOR ALL`
policy whose `USING` doubles as the `WITH CHECK`. As they stand, a signed-in
browser can insert a friendship **from someone else, already accepted**,
accept its own pending request on the other person's behalf, or lift a block.
Harmless today only because nothing reads the table. The draft makes the
browser read-only on friendships and limits notifications to flipping
`is_read` on one's own rows. **Apply it before any social UI ships**, not with it.

### The model

- One row per **pair** (the draft adds an unordered-pair unique index).
  `user_id` asked first. Decline / cancel / remove / unblock **delete** the row,
  so "no row" is the only neutral state.
- A block records `blocked_by`; only the blocker can lift it; a blocked person
  only ever hears `unavailable`, never "you are blocked", and never sees the
  pair in their list.
- Notification payloads carry **ids only** — never names, emails or text — so
  a rename or an erasure is reflected the next time the feed renders.

### Decisions the owner signs off before switch-on

1. **Who may connect** (`canConnect` in `lib/social/rules.ts`), proposed:
   adult ↔ adult yes; adult ↔ minor never; minor ↔ minor only inside the same
   school (`users.school_id`). Undeclared birth year = minor. This is a contact
   rule for children, so it belongs next to the decisions in
   `docs/compliance.md`, and should be recorded there once agreed.
2. **How people find each other.** Nothing here searches users. The
   conservative option is: from a shared room or class only, never a global
   directory. `@handles` exist (`lib/names.ts`) if a direct lookup is wanted.
3. **Realtime vs polling** for the notification badge. Polling first.
4. **Retention** for notifications (proposal: 90 days, a cron).

### Switch-on checklist

1. Owner decisions above recorded.
2. Check no duplicate reversed pairs exist live (query is in the draft), then
   move `social_v1.sql` into `supabase/migrations/` with a fresh timestamp and
   apply it. Verify the policies on the live schema.
3. `npm run gen:types`; drop the untyped `learningAdmin()` in
   `lib/social/friendships.ts` for the typed admin client.
4. Add `friendships` and `notifications` to the data export
   (`lib/compliance/export.ts`) — they are personal data and are **not**
   exported today. Erasure is already covered: both reference `users(id)` with
   `ON DELETE CASCADE`.
5. Rate-limit friend requests per user (a `checkRateLimit` bucket) in the route.
6. Build the routes / UI; delete the social line from
   `test/prepared-updates.test.ts` in the same commit.
7. Set `SOCIAL_ENABLED=1` on the environment.
8. Roadmap copy (`RoadmapTimeline`, 4 locales) only once it is live.

---

## Newsletter v1

| File | What it is |
|---|---|
| `supabase/drafts/newsletter_v1.sql` | Subscriber lifecycle columns, issue status + body, delivery ledger, policy fixes |
| `lib/newsletter/tokens.ts` | Stateless HMAC confirm / unsubscribe links (`NEWSLETTER_SECRET`) |
| `lib/newsletter/render.ts` | Pure: issue Markdown → email HTML + text, confirm email, RFC 8058 headers |
| `lib/newsletter/subscribers.ts` | Server: double opt-in, confirm, unsubscribe |
| `lib/newsletter/send.ts` | Server: resumable, idempotent batch send via Resend |
| `lib/content-authoring.ts` | Server: write/publish research posts and newsletter drafts (operator only) |

### What changes for a subscriber

Today `/api/content/subscribe` is single opt-in: an address typed on the form
is `confirmed = false` forever and nothing is ever sent. After switch-on:

- signing up sends **one** confirmation mail (nothing else until confirmed;
  the link expires after 7 days); the form answers the same thing for new,
  pending, confirmed or unsubscribed addresses, so it cannot be used to test
  whether someone reads us;
- every issue carries an unsubscribe link **and** the `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers, which Gmail and Yahoo require of bulk
  senders;
- unsubscribing keeps the row with `unsubscribed_at`, so no stale list can
  re-mail the address.

### What the draft migration fixes on the way

- `subscribers_insert` lets **anon insert directly** through PostgREST,
  skipping the route's captcha and rate limit. Dropped.
- `newsletter_public_read` is `USING (true)`: once drafts exist, they would be
  public. Narrowed to `status in ('sent','published')`. Existing rows default
  to `published`, so today's archive is unchanged.

### Switch-on checklist

1. Generate `NEWSLETTER_SECRET` (32+ random chars). Rotating it later
   invalidates every unsubscribe link already in inboxes — pick once.
2. Move `newsletter_v1.sql` into `supabase/migrations/`, apply, verify policies.
   `npm run gen:types`.
3. **Same deploy**: add `.in("status", ["sent", "published"])` to
   `getNewsletterIssues()` in `lib/content.ts` — it reads through the service
   role, which bypasses the new policy, so without the filter drafts would
   appear on `/research`.
4. Routes: `GET /research/newsletter/confirm?token=` → `confirmSubscription`;
   `GET` + `POST /api/content/unsubscribe?token=` → `unsubscribe` (the POST is
   the RFC 8058 one-click; it must not require a session or a captcha).
   Paths are in `NEWSLETTER_PATHS`. Point `/api/content/subscribe` at
   `startDoubleOptIn`.
5. An `/ops` page for `content-authoring.ts` (posts + issue drafts) and a
   "send" button calling `sendIssue` with `dryRun: true` first, showing the
   audience count, then for real.
6. Legal: the privacy page names the newsletter's purpose and retention;
   Resend is already a listed subprocessor.
7. Delete the newsletter lines from `test/prepared-updates.test.ts`.
8. Set `NEWSLETTER_SENDING_ENABLED=1` only when the first issue is ready.

### Known limits, deliberately left

- Issues are sent in English; `locale` is stored for when translations exist.
- A batch that fails is recorded `failed` and retried by the next run; there is
  no per-recipient bounce handling (Resend webhooks) yet.
- Sending runs inside one request. At today's list size that is seconds; past
  a few thousand recipients it should move to a cron that resumes from the
  ledger — the ledger is already shaped for that.
