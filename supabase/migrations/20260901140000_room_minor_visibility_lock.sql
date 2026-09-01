-- A room holding a minor can never be public. Enforced in the database.
--
-- Private-by-default already lives in app/rooms/actions.ts, and that is the
-- right place for a DEFAULT. It is the wrong place for an INVARIANT: joinRoom
-- writes room_members with the SERVICE ROLE (it has to — a non-member cannot
-- insert into a private room under RLS), and the service role bypasses RLS
-- entirely. So every app-level guarantee about who ends up in which room is
-- exactly one forgotten check away from not being one.
--
-- These triggers close both directions of the same invariant:
--   * a room cannot BECOME public while it holds a minor;
--   * a minor cannot JOIN a room that is already public.
--
-- Age rule mirrors lib/compliance/age.ts exactly, and must keep mirroring it:
--   * we store a birth YEAR only, so the age is the MINIMUM the year allows
--     (`year - birth_year - 1`) — rounding a student down is harmless, rounding
--     one up is the failure that matters;
--   * a NULL birth year counts as a MINOR. "We don't know" resolves to the
--     protective reading here, exactly as isMinor(null) does in TypeScript.
--
-- Existing rows are untouched: triggers fire on write, not on history. A room
-- that is already public with a minor in it stays as it is until something
-- writes to it — flipping live rooms is a data decision, not a schema one.

-- ── helper ───────────────────────────────────────────────────────
create or replace function learning.room_has_minor(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from learning.room_members m
    left join public.users u on u.id = m.user_id
    where m.room_id = p_room_id
      and (
        -- No profile row, or no declared year: treated as a minor.
        u.birth_year is null
        or (extract(year from now())::int - u.birth_year - 1) < 18
      )
  );
$$;

comment on function learning.room_has_minor(uuid) is
  'True when at least one member of the room is (or may be) under 18. A NULL/absent birth year counts as a minor, mirroring isMinor(null) in lib/compliance/age.ts.';

-- `learning` is a PostgREST-exposed schema, so a SECURITY DEFINER function in it
-- is callable as an RPC by any signed-in client. Nobody should be able to ask
-- "does this room contain a child" by guessing room ids — the triggers below run
-- as the definer and reach it regardless of these grants.
revoke execute on function learning.room_has_minor(uuid) from public, anon, authenticated;

-- ── 1. a room cannot become public while it holds a minor ────────
create or replace function learning.enforce_room_visibility_minor_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility
     and new.visibility = 'public'
     and learning.room_has_minor(new.id)
  then
    raise exception 'room_visibility_locked_minor'
      using errcode = 'check_violation',
            hint = 'This room includes a member under 18, so its visibility is locked to private.';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_visibility_minor_lock on learning.rooms;
create trigger rooms_visibility_minor_lock
  before update of visibility on learning.rooms
  for each row
  execute function learning.enforce_room_visibility_minor_lock();

-- ── 2. a minor cannot join a room that is public ─────────────────
-- Fires on UPDATE too, not INSERT alone: joinRoom upserts on (room_id, user_id),
-- so a re-join takes the UPDATE path and would otherwise walk straight past an
-- INSERT-only guard.
create or replace function learning.enforce_no_minor_in_public_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibility text;
  v_birth_year smallint;
begin
  select r.visibility into v_visibility
  from learning.rooms r
  where r.id = new.room_id;

  if v_visibility is distinct from 'public' then
    return new;
  end if;

  select u.birth_year into v_birth_year
  from public.users u
  where u.id = new.user_id;

  if v_birth_year is null
     or (extract(year from now())::int - v_birth_year - 1) < 18
  then
    raise exception 'minor_cannot_join_public_room'
      using errcode = 'check_violation',
            hint = 'Members under 18 can only join private rooms, reached through an invite link.';
  end if;

  return new;
end;
$$;

drop trigger if exists room_members_no_minor_in_public on learning.room_members;
create trigger room_members_no_minor_in_public
  before insert or update of user_id, room_id on learning.room_members
  for each row
  execute function learning.enforce_no_minor_in_public_room();
