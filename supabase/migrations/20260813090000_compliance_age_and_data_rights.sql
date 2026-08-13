-- Compliance foundations: age assurance (COPPA / GDPR art. 8) and the audit
-- trail for data-subject requests (GDPR art. 15/17/20, FERPA inspect & review).
--
-- Two deliberate design choices, both about not holding more than we must:
--
-- 1. We store the BIRTH YEAR, never a full date of birth. A year is enough to
--    run every age rule we have and is far less identifying. The age *band*
--    (child / teen / adult) is NOT stored: it is derived on read by
--    lib/compliance/age.ts, so a student who turns 13 is reclassified without
--    a backfill and there is no second source of truth to drift.
--
-- 2. public.users grants UPDATE column-by-column to `authenticated` (a
--    whitelist), so the columns added here are NOT client-writable — the age
--    declaration has to go through the server route, which is what stops a
--    12-year-old from posting themselves an adult band. `training_consent` is
--    revoked below for the same reason: it is an opt-in a minor must not be
--    able to flip.

-- ---------------------------------------------------------------- age ------
alter table public.users
  add column if not exists birth_year smallint,
  add column if not exists age_declared_at timestamptz,
  add column if not exists minor_consent_source text,
  add column if not exists minor_consent_at timestamptz,
  add column if not exists minor_consent_note text;

comment on column public.users.birth_year is
  'Declared year of birth. Year only, never a full DOB. Null = not yet declared.';
comment on column public.users.age_declared_at is
  'When the user answered the age question. Presence, not value, marks the gate as passed.';
comment on column public.users.minor_consent_source is
  'How a minor is authorised to use the service: their school (COPPA school-consent '
  'exception / FERPA school official) or a parent. Null for adults.';
comment on column public.users.minor_consent_note is
  'Free-text reference for the authorisation above, e.g. the school id that vouched.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_birth_year_range') then
    alter table public.users add constraint users_birth_year_range
      check (birth_year is null or (birth_year >= 1900 and birth_year <= 2200));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_minor_consent_source_allowed') then
    alter table public.users add constraint users_minor_consent_source_allowed
      check (minor_consent_source is null or minor_consent_source in ('school', 'parent'));
  end if;
end $$;

-- Opt-ins a minor must not be able to grant for themselves. Both now move
-- through server routes that check the age band first.
revoke update (training_consent) on public.users from authenticated;

-- ------------------------------------------------- data-subject requests ---
-- The accountability record for every access / export / erasure request.
--
-- `subject_user_id` carries NO foreign key on purpose: the row's whole job is
-- to outlive the account it describes. An ON DELETE CASCADE here would erase
-- the proof of erasure at the exact moment we need it.
create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null,
  kind text not null check (kind in ('access', 'export', 'erasure')),
  channel text not null default 'self_serve'
    check (channel in ('self_serve', 'support', 'school', 'parent')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text check (outcome in ('fulfilled', 'partial', 'refused')),
  note text
);

comment on table public.data_requests is
  'Audit trail for data-subject requests. Deliberately has no FK to users: an '
  'erasure record must survive the erasure it documents.';

create index if not exists data_requests_subject_idx
  on public.data_requests (subject_user_id, requested_at desc);

-- Deny-all by default: RLS on with zero policies. Only the service role (which
-- bypasses RLS) reads or writes this — no client ever touches it.
alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon, authenticated;
