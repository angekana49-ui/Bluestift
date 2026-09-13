-- What an account IS — anonymous or verified by email — decided in one place,
-- from auth.users, whenever auth.users changes.
--
-- Before this, public.users.account_type / auth_method / email were written once
-- by handle_new_user and never again:
--   - an email-and-password signup was stamped 'verified' at INSERT, before the
--     address had been confirmed;
--   - an account that later gained or confirmed a real address kept
--     'anonymous', because only /auth/callback and /auth/confirm updated
--     anything (account_state), and a link opened on another device never
--     reaches either of them with a session;
--   - account_state was written from the browser (onboarding), so a client could
--     declare itself 'active_verified'.
--
-- The synthetic recovery address (anon-…@anon.bluestift.local, lib/auth.ts) is
-- confirmed in auth.users but is not an email anyone owns: it never counts.

-- 1. The rule. Idempotent; writes only when something actually differs.
create or replace function public.sync_account_status(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_real boolean;
  v_verified boolean;
  u public.users%rowtype;
  n_email text;
  n_method text;
  n_type text;
  n_verified_at timestamptz;
  n_state text;
begin
  select a.email, a.email_confirmed_at into v_email, v_confirmed
  from auth.users a where a.id = p_user_id;
  if not found then return; end if;

  select * into u from public.users where id = p_user_id;
  if not found then return; end if;

  v_real := coalesce(v_email, '') <> '' and lower(v_email) not like '%@anon.bluestift.local';
  v_verified := v_real and v_confirmed is not null;

  n_email := case when v_real then v_email else null end;
  n_method := case
    when v_real then 'email'
    when u.auth_method = 'recovery_key' then 'recovery_key'
    else 'anonymous'
  end;
  -- Paid and school-admin types are set by billing / Schools and outrank this.
  n_type := case
    when u.account_type in ('b2c_paid', 'school_admin') then u.account_type
    when v_verified then 'verified'
    else 'anonymous'
  end;
  n_verified_at := case when v_verified then coalesce(u.email_verified_at, v_confirmed) else null end;
  -- Onboarding and dormancy are journeys, not verification: left alone.
  n_state := case
    when u.account_state = 'active_unverified' and v_verified then 'active_verified'
    when u.account_state = 'active_verified' and not v_verified then 'active_unverified'
    else u.account_state
  end;

  if u.email is distinct from n_email
     or u.auth_method is distinct from n_method
     or u.account_type is distinct from n_type
     or u.email_verified_at is distinct from n_verified_at
     or u.account_state is distinct from n_state then
    update public.users
       set email = n_email,
           auth_method = n_method,
           account_type = n_type,
           email_verified_at = n_verified_at,
           account_state = n_state
     where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.sync_account_status(uuid) from public, anon, authenticated;
grant execute on function public.sync_account_status(uuid) to service_role;

-- 2. Run it whenever auth.users gains a row or changes its address or its
--    confirmation. Fires after on_auth_user_created (triggers fire in name
--    order), so the profile row exists. A failure here must never fail a
--    sign-up or a sign-in: it is logged and swallowed, and the next change —
--    or the callback's own call — repairs the row.
create or replace function public.on_auth_user_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.sync_account_status(new.id);
  exception when others then
    raise warning 'sync_account_status(%) failed: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.on_auth_user_status_sync() from public, anon, authenticated;

drop trigger if exists on_auth_user_status_sync on auth.users;
create trigger on_auth_user_status_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.on_auth_user_status_sync();

-- 3. account_state stays writable by the browser, because finishing onboarding
--    is the browser's to say. Which active state it lands in is not: the
--    database picks verified or unverified from auth.users, whoever writes.
--    A browser may only leave onboarding; it cannot wake a dormant account,
--    go back to onboarding, or put itself to sleep.
create or replace function public.guard_account_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('anon', 'authenticated');
  v_verified boolean;
begin
  if new.account_state is not distinct from old.account_state then
    return new;
  end if;

  if v_client and not (
    old.account_state = 'onboarding_pending'
    and new.account_state in ('active_unverified', 'active_verified')
  ) then
    new.account_state := old.account_state;
    return new;
  end if;

  if new.account_state in ('active_unverified', 'active_verified') then
    select coalesce(a.email, '') <> ''
           and lower(a.email) not like '%@anon.bluestift.local'
           and a.email_confirmed_at is not null
      into v_verified
      from auth.users a where a.id = new.id;
    new.account_state := case when coalesce(v_verified, false) then 'active_verified' else 'active_unverified' end;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_account_state() from public, anon, authenticated;

drop trigger if exists users_guard_account_state on public.users;
create trigger users_guard_account_state
  before update of account_state on public.users
  for each row execute function public.guard_account_state();

-- 4. Is a username free? Onboarding asks when the name step is left, not three
--    screens later when the account is saved. Usernames are public handles
--    (@username, room rosters), so this tells a caller nothing private. Same
--    comparison as users_username_lower_key; the caller's own row never clashes.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.users
    where lower(username) = lower(btrim(p_username))
      and id is distinct from auth.uid()
  );
$$;

revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- 5. Bring every existing row in line with the rule.
select public.sync_account_status(id) from auth.users;
