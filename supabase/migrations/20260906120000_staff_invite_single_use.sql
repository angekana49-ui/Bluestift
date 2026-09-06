-- An invitation addressed to one person should admit one person.
--
-- `POST /api/school/profs` stopped writing memberships and started sending
-- invitations (audit of 2026-09-06): it mints a code, mails it to one address,
-- and the membership is created only when that person redeems it. That fixed
-- the consent problem and left a hygiene one behind — nothing marks a code as
-- spent, so every invitation ever sent stays live until the year rolls over.
-- Each is a working credential for `prof` in that school, and a forwarded mail
-- is enough to use it.
--
-- The shared codes an admin generates for a staffroom are a different thing and
-- must keep working the way they do: one code, many teachers, all year. So the
-- distinction goes in the table rather than in a convention, and the default is
-- the existing behaviour — every row that exists today, and every code minted
-- by the invite screen, is unchanged.
alter table schools.staff_invite_codes
  add column if not exists single_use boolean not null default false;

comment on column schools.staff_invite_codes.single_use is
  'True for a code minted for ONE named invitation (app/api/school/profs). '
  'The redemption path deactivates it once it has admitted somebody, so a '
  'forwarded invitation does not become a second membership. False — the '
  'default, and every pre-existing row — is a shared staffroom code, which is '
  'meant to be redeemed many times and is retired by the year rollover.';

-- Redeeming is a lookup by code on a table that grows by one row per invitation,
-- so it gets the index it has been missing. Partial: an inactive code is never
-- looked up, and the school's history of retired codes has no business in the
-- hot path.
create index if not exists staff_invite_codes_active_code_idx
  on schools.staff_invite_codes (code)
  where is_active;
