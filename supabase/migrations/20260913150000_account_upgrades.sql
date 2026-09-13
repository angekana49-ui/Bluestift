-- The upgrade from an anonymous account to a verified one (owner decision,
-- 2026-09-13: "anonymous → verified, no data lost, smooth").
--
-- Why our own flow and not supabase.auth.updateUser({ email }): an anonymous
-- account carries a confirmed synthetic address (anon-…@anon.bluestift.local)
-- so its recovery key can mint sessions, and the project has Secure email
-- change on. Supabase therefore asks BOTH addresses to confirm, and the
-- synthetic one never receives mail: the change could never complete (probed
-- 2026-09-13).
--
-- One pending upgrade per account. Only a SHA-256 of the link's token is kept.
-- The row carries no password: the password is set on the account when the
-- upgrade is requested, and the address is swapped when the link is confirmed.
-- Service role only — no policy, no grant.

create table if not exists public.account_upgrades (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.account_upgrades enable row level security;
revoke all on table public.account_upgrades from anon, authenticated;

-- Is this address already some OTHER account's? Case-blind, like auth.
-- Checked before the swap, because the admin API answers a clash with a bare
-- 500 (probed) instead of a reason.
create or replace function public.auth_email_taken(p_email text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(p_email))
      and id is distinct from p_user_id
  );
$$;

revoke all on function public.auth_email_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.auth_email_taken(text, uuid) to service_role;
