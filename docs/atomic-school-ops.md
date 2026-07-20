# Atomic school ops (RPC)

Two multi-write operations were done as sequential statements from the app, so a
double-click / concurrent request could interleave and leave inconsistent state
(two active class codes; two active school years). These move into single
Postgres functions — each function body is one transaction, so the writes commit
all-or-nothing.

Authorization stays in the routes (`assertAdminMaster` / role checks); the
functions only do the atomic data work and are called with the service_role.

## SQL to apply in Supabase (once)

```sql
-- Regenerate a class access code atomically: retire the current one(s) for good,
-- mint a fresh unique 6-char code, return it. Unambiguous alphabet (no 0/O/1/I).
create or replace function schools.regenerate_class_code(
  p_class_id uuid,
  p_school_year_id uuid
) returns table(out_id uuid, out_code text, out_is_active boolean)
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  i int;
  attempt int;
begin
  update schools.class_access_codes cac
     set is_active = false, retired_at = now()
   where cac.class_id = p_class_id and cac.retired_at is null;

  for attempt in 1..8 loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      return query
        insert into schools.class_access_codes (class_id, school_year_id, code, is_active)
        values (p_class_id, p_school_year_id, new_code, true)
        returning class_access_codes.id, class_access_codes.code, class_access_codes.is_active;
      return;
    exception when unique_violation then
      -- code collided — try another
    end;
  end loop;
  raise exception 'could not allocate a unique class code';
end;
$$;

-- Make a school year the sole active one atomically: find-or-create it by label,
-- deactivate every other year, point the school at it. Idempotent. Used by both
-- the manual "Start a new year" action and the automatic August rollover.
create or replace function schools.set_active_school_year(
  p_school_id uuid,
  p_label text,
  p_start date,
  p_end date
) returns table(out_id uuid, out_label text)
language plpgsql
as $$
declare
  y_id uuid;
begin
  select sy.id into y_id
    from schools.school_years sy
   where sy.school_id = p_school_id and sy.label = p_label
   limit 1;

  if y_id is null then
    insert into schools.school_years (school_id, label, start_date, end_date, is_active)
    values (p_school_id, p_label, p_start, p_end, true)
    returning id into y_id;
  else
    update schools.school_years sy set is_active = true where sy.id = y_id;
  end if;

  update schools.school_years sy set is_active = false
   where sy.school_id = p_school_id and sy.id <> y_id;

  update schools.schools s set current_school_year_id = y_id
   where s.id = p_school_id;

  return query select y_id, p_label;
end;
$$;

grant execute on function schools.regenerate_class_code(uuid, uuid) to service_role;
grant execute on function schools.set_active_school_year(uuid, text, date, date) to service_role;
```

> The functions are SECURITY INVOKER (default): they run as the caller
> (service_role), which already has full DML on `schools.*` and now EXECUTE on
> these. Nothing new is exposed to `anon`/`authenticated`.

Until applied, the routes error (they call an RPC that doesn't exist) — apply
before shipping the change.
