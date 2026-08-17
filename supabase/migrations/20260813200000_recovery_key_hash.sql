-- Stop storing recovery keys in cleartext.
--
-- `public.users.recovery_code` held the 16-character key verbatim, and that key
-- doubles as the account password for email-less accounts (see lib/auth.ts,
-- `ensureRecoverable`). So a single read of that column — a leaked service_role
-- key, a stray RLS policy, an old backup — was direct sign-in for every
-- anonymous account. Those accounts belong disproportionately to children.
--
-- After this migration the column is always NULL and lookup goes through
-- `recovery_code_hash`.
--
-- WHY A PLAIN SHA-256, NO SALT AND NO PEPPER:
-- a recovery key is 16 characters from a 32-symbol alphabet = 80 bits of
-- uniform entropy, not a human-chosen password. There is no dictionary to run
-- and no rainbow table to build against a 2^80 keyspace, so the slow-KDF and
-- per-row-salt machinery that protects passwords buys nothing here — while a
-- per-row salt would forbid the O(1) equality lookup this flow depends on, and a
-- pepper would add a secret to manage and rotate for no gain against the threat
-- we are actually closing (offline read of the table). This is the same reasoning
-- behind storing API tokens as a bare SHA-256.
--
-- `sha256()` is a Postgres 11+ builtin — no pgcrypto dependency.

alter table public.users
  add column if not exists recovery_code_hash text,
  -- NULL = the key on file has never been shown to its owner (it came from the
  -- handle_new_user trigger and nobody ever read it). The app treats that as
  -- "not issued yet" and mints a fresh one on first sight. Non-NULL = the owner
  -- has been shown a key; it can never be displayed again, only replaced.
  add column if not exists recovery_code_issued_at timestamptz;

comment on column public.users.recovery_code_hash is
  'SHA-256 (hex) of the recovery key. The key itself is never stored: it is shown to its owner once and is unrecoverable afterwards.';
comment on column public.users.recovery_code_issued_at is
  'When the current recovery key was shown to its owner. NULL means no key has been issued yet.';
comment on column public.users.recovery_code is
  'DEPRECATED, always NULL — kept only so the handle_new_user trigger keeps working. A BEFORE trigger converts any write to recovery_code_hash. Read recovery_code_hash instead.';

-- ---------------------------------------------------------------------------
-- Backfill BEFORE the trigger exists, so existing rows convert exactly once.
--
-- Existing users have their key written on paper; invalidating it would lock
-- them out of accounts that have no other way in. So their key is preserved —
-- only its storage form changes — and issued_at is stamped so the app knows the
-- owner already holds it and must not silently replace it.
-- ---------------------------------------------------------------------------
update public.users
   set recovery_code_hash = encode(sha256(convert_to(recovery_code, 'UTF8')), 'hex'),
       recovery_code_issued_at = coalesce(recovery_code_issued_at, now())
 where recovery_code is not null
   and recovery_code_hash is null;

update public.users
   set recovery_code = null
 where recovery_code is not null;

-- Two rows must never share a key: the lookup in /api/auth/recover uses
-- maybeSingle(), so a duplicate would resolve to NO account and silently lock
-- both owners out rather than let either in. Partial, so the NULLs don't collide.
create unique index if not exists users_recovery_code_hash_key
  on public.users (recovery_code_hash)
  where recovery_code_hash is not null;

-- ---------------------------------------------------------------------------
-- Backstop. The app writes recovery_code_hash directly and never sends the
-- cleartext key to the database at all. But `handle_new_user` (which predates
-- this migrations folder and is not reproduced here) still writes a generated
-- key into recovery_code on every signup. Rather than rewrite a trigger whose
-- other responsibilities — default username, onboarding event — we would have to
-- restate from memory and could get wrong, this converts whatever it writes.
--
-- Net effect: cleartext can be written by anything, and still never lands.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (the default): this only rewrites the NEW row on its way in
-- and needs no elevation. An unnecessarily privileged function is a liability,
-- not a precaution.
create or replace function public.strip_recovery_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recovery_code is not null then
    -- Only adopt it as THE key if none is set. An UPDATE that touches an
    -- unrelated column must not resurrect a stale key over the live one.
    if new.recovery_code_hash is null then
      new.recovery_code_hash := encode(sha256(convert_to(new.recovery_code, 'UTF8')), 'hex');
    end if;
    new.recovery_code := null;
  end if;
  return new;
end;
$$;

comment on function public.strip_recovery_code() is
  'Converts any cleartext write to public.users.recovery_code into recovery_code_hash and nulls the cleartext. Backstop for handle_new_user.';

-- Trigger functions must not be callable as RPC (mirrors the hardening applied
-- to handle_new_user in 20260702114210_security_hardening_advisors.sql).
revoke execute on function public.strip_recovery_code() from public, anon, authenticated;

drop trigger if exists users_strip_recovery_code on public.users;
create trigger users_strip_recovery_code
  before insert or update of recovery_code on public.users
  for each row
  execute function public.strip_recovery_code();

-- The cleartext column is now vestigial and the hash is a credential verifier:
-- neither is for the client. The server reads them through the service role,
-- which column grants do not restrict.
--
-- NOTE: in PostgreSQL a column-level REVOKE cannot claw back a privilege that
-- was granted at TABLE level — it succeeds with a "no privileges could be
-- revoked" warning and the table grant stands. So treat these as belt-and-braces
-- on top of RLS (which already confines a reader to their own row), not as the
-- guarantee. The guarantee is that the cleartext column is empty.
revoke select (recovery_code) on public.users from anon, authenticated;
revoke update (recovery_code) on public.users from anon, authenticated;
revoke select (recovery_code_hash) on public.users from anon, authenticated;
revoke update (recovery_code_hash) on public.users from anon, authenticated;
