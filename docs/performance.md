# Performance

The efficiency audit of 6 September 2026: what was measured, what changed, and
what was deliberately left alone. Companion to `docs/security.md`, and written
the same way — for the next person, including a stranger.

## How this was measured, and what the numbers are worth

A production build served locally, warmed, then seven samples per route with the
median taken. The database is the real remote Supabase project, so every number
includes a real round trip over a home connection.

**That makes these numbers pessimistic and relative, not absolute.** In
production the server sits near the database and a query costs tens of
milliseconds rather than hundreds. So read the ratios, not the milliseconds: a
page that halves here will halve there, on a smaller base. What travels
unchanged is the *count* of round trips, which is what the fixes below reduce.

Time to first byte, median of seven:

| Route       | Before | After |
| ----------- | -----: | ----: |
| `/`         |  607ms | 184ms |
| `/pricing`  |  427ms |  69ms |
| `/research` |  402ms | 280ms |
| `/survey`   |  500ms | 556ms |
| `/legal`    |   78ms | 124ms |
| `/login`    |   57ms |  77ms |

`/legal` and `/login` query nothing; their movement is the measurement noise on
this connection, which the raw samples put at ±60ms. `/survey` is unchanged on
purpose — see below.

## What changed

### 1. The proxy stopped asking the network who you are

`proxy.ts` runs on every request, and it called `supabase.auth.getUser()` —
which asks the Auth server to validate the token. Measured from here: **~370ms,
before any page began rendering**, on every navigation and every API call for
every signed-in user.

It now calls `getClaims()`, which verifies the token's signature locally against
the project's published key. That works because this project signs with ES256
and auth-js caches the key set process-wide (`GLOBAL_JWKS`), so it is fetched
once per server instance rather than once per request. `getClaims()` still calls
`getSession()` underneath, which is what refreshes an expiring token and writes
the new cookies — the one job that block exists to do is unchanged.

It is not a weaker check, and it costs no security here: **the result was always
thrown away**. Every page and route runs its own `getUser()` for authorisation.
This call has never been an authorisation check, only a refresh. If the project
ever moved back to a symmetric secret, `getClaims()` falls back to `getUser()`
internally — correctness survives, only the speed would be lost.

### 2. The plan catalogue and the published articles are remembered for a minute

`listPlans()` was a fresh query on every visit to the landing page, `/pricing`
and the public plans endpoint — the three things a stranger loads before they
have an account. Same for `getPublishedPosts()` and `getNewsletterIssues()`.
These change when someone edits a price or publishes an article.

They are now memoised per instance for 60 seconds, the same shape as the
entitlements cache that was already in `lib/entitlements.ts`: process-local, so
not shared between serverless instances, and self-healing — an edit is live
everywhere within the TTL with nothing to invalidate by hand.

One detail worth keeping: what is cached is a **successful** read, not a
non-empty one. Those are different facts. Treating "nothing published yet" as a
failure would mean paying the round trip on every visit exactly when there is
nothing to fetch — which is what the first version of this did, and why
`/research` did not move until it was fixed. A failed read is still never
cached, so a database hiccup cannot pin an empty page in front of a minute's
worth of visitors.

### 3. Half the font weight left the critical path

Four faces were preloaded on every page: **174.7 KB**. The largest was Caveat at
72.8 KB — a handwritten face that writes one greeting. Instrument Serif, an
accent for the marketing site, added 15.3 KB to the tutor's first paint.

Both now carry `preload: false`, so they load when something asks for them.
Preloaded fonts: **174.7 KB → 86.6 KB**, on every page load. Inter and IBM Plex
Sans stay preloaded; they are the body and heading faces and every page uses
them. `display: swap` means the greeting still appears immediately, in the
fallback, and changes hand a moment later.

### 4. One serial round trip removed from the school dashboard

`/school` awaited the plan label after the dashboard read, though it depends
only on the active school id that wave one had already resolved. It now starts
with the dashboard instead of queuing behind it.

## Investigated and left alone, with reasons

**The `getUser()` in pages and routes (~115 call sites) stays.** Replacing it
with `getClaims()` would remove the remaining auth round trip, and it is
tempting. It is also the real authorisation check, and local verification cannot
see a token revoked before it expires — up to an hour of access for an account
the lifecycle cron has just banned. In production that round trip is a
same-region hop; the security is worth more than the milliseconds. The proxy was
different because its answer was discarded.

**Variable fonts are already in use.** Removing the `weight` arrays to force the
variable cut changed nothing: Next 16 already resolves these families to their
variable file, and the emitted assets were byte-identical before and after. The
19 files are unicode-range subsets, of which a browser fetches the one or two it
needs. There is no saving here; the saving was in the preloading.

**The free-expression wall is not cached.** `/survey` reads it live and stays at
~550ms. Someone who posts expects to see it, and so does the next visitor. A
minute of staleness on a wall built for immediacy is the wrong trade.

**The chat path was already done.** The send is optimistic, the reply streams,
the pre-LLM work runs in two parallel waves, and `clientMsgId` makes a retry
idempotent. Nothing to add.

**Images are already handled.** The clouds ship as WebP with a PNG fallback
through `image-set()`; the launch screens are only fetched when iOS installs the
app.

## Second pass: the round trips themselves

The note below said the next lever was the NUMBER of round trips, not
milliseconds. One case was bad enough to fix straight away.

**Acknowledging alerts was an N+1.** `POST /api/school/alerts/resolve` takes up
to fifty alert ids and asked two questions about each — who is this alert about,
and do I teach them — one id at a time, in sequence. The second question
re-resolved the caller's classes every time. Up to about 350 sequential round
trips before a single write, on a button teachers press daily. Both questions
are now asked once for the whole set, and the per-id refusals are unchanged.

**`getAdminMembership` is still two queries**, and it runs three or four times
in one `/school` render because nothing in this codebase memoises per request.
Wrapping it in React's `cache()` is the obvious collapse, and it is wrong.

`app/school/page.tsx` calls `ensureCurrentSchoolYear` BETWEEN two of those
reads, deliberately and with a comment saying so: that write is what repoints
`schools.current_school_year_id` when a school year ends, and the dashboard
read after it scopes classes to the year it finds. A per-request memo would serve
the dashboard the pre-rollover year, and `/school` would render last year's
classes. Once a year, per school, with nothing in the logs — the failure is
annual, brief and invisible, which is the worst combination to ship.

So the win is real but it is not one line. It needs either memoising the callers
individually, or a request-scoped store that the rollover write invalidates.
Both are a round of their own. The reason is recorded on the function itself and
held by `test/export-completeness.test.ts`, so the next person to spot the easy
win meets the reason before the bug.

## Where the remaining time goes

After these changes the public pages are dominated by their own data queries,
and the signed-in app by one auth round trip plus its page queries. The next
real lever is not micro-optimisation, it is **how many separate database round
trips a page makes** — `getAdminMembership` alone is two, and `/school`'s first
wave is five parallel calls whose chains vary in length. Collapsing related
reads into single queries or Postgres functions would cut round trips rather
than shave them, which is the kind of change that survives being deployed
somewhere further from the database.
