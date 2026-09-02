-- The stored value stops contradicting the rule enforced above it.
--
-- 20260813220000 flipped the column default to `true` and was careful to
-- backfill adults only. What it could not express is that the default fires at
-- INSERT, and at insert we do not yet know how old anyone is: the row is created
-- at sign-up and `birth_year` arrives later, from the age step. So every account
-- — including a 13-year-old's — was written with `training_consent = true` and
-- nothing ever moved it back.
--
-- Nothing was actually trained on. `trainingAllowed()` checks the age band
-- BEFORE the column and refuses every minor, which is why this survived. But
-- three things were wrong anyway:
--
--   · the data export hands a minor a JSON file saying `training_consent: true`,
--     directly contradicting the settings screen, which tells them it is off;
--   · "the column is meaningless on its own" is a fact that lives in one comment
--     and two functions, and is one refactor away from being forgotten;
--   · a value that is wrong-but-compensated is indistinguishable, from the
--     table, from a value that is wrong.
--
-- So the floor moves into the storage layer, where it cannot be routed around.

create or replace function public.enforce_training_consent_floor()
returns trigger
language plpgsql
as $$
begin
  -- The same arithmetic as lib/compliance/age.ts: only a birth YEAR is stored,
  -- so the age used is the MINIMUM the year allows (`year - birth_year - 1`).
  -- Rounding a student down is harmless; rounding one up would enrol a
  -- 17-year-old for the eleven months before their birthday.
  --
  -- A NULL birth year counts as a minor, matching `isMinor(null)` in the app:
  -- the safe reading of "we don't know" is the one that withholds. The value
  -- becomes true for an adult at the moment we learn they are one — see
  -- app/api/account/age/route.ts — not before.
  if new.birth_year is null
     or (extract(year from now() at time zone 'utc')::int - new.birth_year - 1) < 18
  then
    new.training_consent := false;
    -- `training_consent_at` is deliberately untouched. It means "the user
    -- expressed a choice", and this is not one — stamping it here would make a
    -- machine-set false look like a withdrawal the user had made, which is
    -- exactly the confusion the previous migration removed.
  end if;
  return new;
end;
$$;

drop trigger if exists training_consent_floor on public.users;
create trigger training_consent_floor
  before insert or update on public.users
  for each row
  execute function public.enforce_training_consent_floor();

-- Existing rows. Unlike the 2026-08-13 backfill this one runs in the RESTRICTIVE
-- direction, so it does not need to spare accounts that "already chose": a minor
-- cannot have validly chosen this, and an undeclared account has not been asked.
update public.users
   set training_consent = false
 where training_consent is distinct from false
   and (
     birth_year is null
     or birth_year > extract(year from now() at time zone 'utc')::int - 19
   );

comment on column public.users.training_consent is
  'May this account''s content be used to improve the models. True only for accounts whose declared birth year makes them 18+; the training_consent_floor trigger holds it false for every minor and for any account that has not declared an age yet, so the stored value agrees with lib/compliance/age.ts rather than relying on it. training_consent_at records when the USER last chose, in either direction, and is never stamped by the trigger.';
