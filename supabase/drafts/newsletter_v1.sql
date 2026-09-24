-- DRAFT — NOT APPLIED. See supabase/drafts/README.md and docs/prepared-updates.md.
--
-- Newsletter v1: double opt-in, unsubscribe, issues written in the product and
-- sent from it, with a per-recipient delivery ledger so a send can be resumed
-- without mailing anyone twice.
--
-- Live state, probed 2026-09-24:
--   content.research_subscribers  id, email (unique), confirmed bool, created_at
--       subscribers_god_read  SELECT  is_god()
--       subscribers_insert    INSERT  WITH CHECK (true)      ← anon can insert
--   content.newsletter_issues     id, issue_number (unique), title, published_at,
--                                 content_url, created_at
--       newsletter_god_write  ALL     is_god()
--       newsletter_public_read SELECT true                   ← every row public
--
-- Tokens are NOT stored. Confirm and unsubscribe links carry an HMAC over the
-- subscriber id (lib/newsletter/tokens.ts, keyed by NEWSLETTER_SECRET), so
-- there is no token column to leak and nothing to look up.

begin;

-- ── subscribers ───────────────────────────────────────────────────────────

-- The app route already inserts through the service role, after captcha and
-- the per-IP limit. This policy is a second door that skips both.
drop policy if exists subscribers_insert on content.research_subscribers;

alter table content.research_subscribers
  add column if not exists confirmed_at    timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  -- The language the reader signed up in; the issue is sent in it when a
  -- translation exists, in English otherwise.
  add column if not exists locale          text not null default 'en'
    check (locale in ('en', 'fr', 'es', 'de'));

-- Rows confirmed under the old flag keep counting as confirmed.
update content.research_subscribers
   set confirmed_at = coalesce(confirmed_at, created_at)
 where confirmed and confirmed_at is null;

-- The audience of a send.
create index if not exists research_subscribers_audience_idx
  on content.research_subscribers (id)
  where confirmed and unsubscribed_at is null;

-- ── issues ────────────────────────────────────────────────────────────────

alter table content.newsletter_issues
  add column if not exists body_md text,
  add column if not exists status  text not null default 'published'
    check (status in ('draft', 'sending', 'sent', 'published')),
  add column if not exists sent_at timestamptz;
-- Default 'published' so every EXISTING row (an archive linking to
-- content_url) stays exactly as public as it is today. New issues written in
-- the product are inserted with status = 'draft' explicitly.
--
-- 'sent' and 'published' are both public; 'published' is an archive entry that
-- was never mailed from here.

-- Drafts must not be world-readable. Today every row is.
drop policy if exists newsletter_public_read on content.newsletter_issues;
create policy newsletter_public_read on content.newsletter_issues
  for select using (status in ('sent', 'published'));
-- lib/content.ts getNewsletterIssues() reads through the service role, which
-- bypasses this policy — it must gain the same filter IN THE SAME DEPLOY
-- (checklist item in docs/prepared-updates.md).

-- ── deliveries ────────────────────────────────────────────────────────────

create table if not exists content.newsletter_deliveries (
  id            bigint generated always as identity primary key,
  issue_id      uuid not null references content.newsletter_issues(id) on delete cascade,
  subscriber_id uuid not null references content.research_subscribers(id) on delete cascade,
  status        text not null check (status in ('sent', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  unique (issue_id, subscriber_id)
);
-- RLS on, no policies: service role only.
alter table content.newsletter_deliveries enable row level security;

commit;
