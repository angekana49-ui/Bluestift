-- Rules for the two names a person picks at onboarding (owner decision, 2026-09-13).
--
-- Onboarding writes these columns straight from the browser (column grants on
-- public.users), so the app's own check (lib/names.ts) is a courtesy and this is
-- the rule. Checked before applying: no existing row breaks either.

-- 1. At least 3 characters, of any kind. No rule on letters, digits or symbols —
--    names come in every script and shape, and a character-type rule refuses
--    exactly the names its author didn't think of.
alter table public.users
  add constraint users_username_min_length
  check (username is null or char_length(btrim(username)) >= 3);

alter table public.users
  add constraint users_display_name_min_length
  check (display_name is null or char_length(btrim(display_name)) >= 3);

-- 2. A username is unique regardless of case. The existing users_username_key
--    is case-sensitive, so "Ada" and "ada" could both exist and be told apart
--    by nobody. Display names stay free to repeat: the @username is what
--    distinguishes two people called Ada.
create unique index if not exists users_username_lower_key
  on public.users (lower(username));
