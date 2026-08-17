-- Data sharing becomes ON by default, and stays switchable off by the user.
--
-- The column already existed as a pure opt-in (default false). Two changes:
--
-- 1. The default flips to true, so a new ADULT account starts with it on.
--
-- 2. `training_consent_at` changes meaning: it used to mark "granted", and was
--    reset to NULL on withdrawal. That is now a trap — a withdrawal that erases
--    its own timestamp is indistinguishable from a user who never chose, so the
--    backfill below (or any future one) would silently switch them back on.
--    From here it marks "the user expressed a choice", whichever way. The route
--    stamps it on both grant and withdrawal.
--
-- Minors are deliberately NOT included. `allowsOptionalProcessing()` refuses
-- them regardless of the column, the settings screen tells them why, and the
-- POST route rejects a grant on an under-18 account. Defaulting a 14-year-old's
-- conversations into training would contradict the age gate three files over,
-- and under 13 there is no opt-out construction that works at all. Adults only.
alter table public.users
  alter column training_consent set default true;

-- Existing accounts: only those that never expressed a choice, and only adults.
-- `training_consent_at is not null` means the user decided something — that
-- decision is theirs and is left exactly as it is, including a "no".
--
-- The adult test mirrors lib/compliance/age.ts: we store a birth YEAR, so the
-- minimum age it can represent is `year - birth_year - 1`. Requiring that to be
-- >= 18 gives `birth_year <= year - 19`, which rounds every borderline account
-- DOWN into the minor side. Rounding a student down is harmless here; rounding
-- one up would switch on training for a 17-year-old.
update public.users
   set training_consent = true
 where training_consent_at is null
   and training_consent is distinct from true
   and birth_year is not null
   and birth_year <= extract(year from now() at time zone 'utc')::int - 19;

comment on column public.users.training_consent is
  'May this account''s content be used to improve the models. Defaults to true for adults; always false in effect for minors, which lib/compliance/age.ts enforces above this column. training_consent_at records when the user last chose, in either direction.';
