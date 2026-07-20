# Student ↔ school link

Lets a student attach themselves to their school **by class access code** and
record their **real identity** (first + last name) for the school. The real
identity is deliberately kept OUT of the public profile: `public.users` only
exposes `username` / `display_name` / avatar to everyone; the real name lives in
a dedicated, school-private table readable only by the student and their school
admins.

## Flow

1. Student enters: **code + first name + last name** (`components/school-link.tsx`).
   The class (and therefore the school) is resolved from the code and shown
   read-only — the code (`schools.class_access_codes`) already points at exactly
   one class.
2. `POST /api/school/join` (auth'd; identity from the session, never the client):
   - Resolves `class_access_codes.code` (active) → `classes` → `school_id`,
     `school_year_id`, class `name`.
   - Upserts `schools.student_identities` (real name, school-private).
   - Sets `public.users.school_id` / `school_year_id`, and `class_enrollment_id`
     **only if** a billing `public.class_enrollments` row already exists for that
     class (its FK requires one; otherwise left null).

All reads/writes to the `schools` schema go through the service_role
(`createSchoolsAdminClient`) — that schema isn't in the generated types.

## SQL to apply in Supabase (once)

```sql
-- School-private real identity of a student. Separate from the public profile.
create table if not exists schools.student_identities (
  user_id        uuid primary key references public.users(id) on delete cascade,
  school_id      uuid not null references schools.schools(id) on delete cascade,
  class_id       uuid not null references schools.classes(id) on delete cascade,
  school_year_id uuid references schools.school_years(id) on delete set null,
  first_name     text not null,
  last_name      text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists student_identities_school_idx
  on schools.student_identities (school_id);
create index if not exists student_identities_class_idx
  on schools.student_identities (class_id);

alter table schools.student_identities enable row level security;

-- The student owns their row (self read + manage).
create policy student_reads_own_identity on schools.student_identities
  for select using (user_id = auth.uid());
create policy student_inserts_own_identity on schools.student_identities
  for insert with check (user_id = auth.uid());
create policy student_updates_own_identity on schools.student_identities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_deletes_own_identity on schools.student_identities
  for delete using (user_id = auth.uid());

-- School admins can read the identities of students in their own school.
create policy school_admin_reads_identities on schools.student_identities
  for select using (public.is_school_admin(school_id));

grant usage on schema schools to authenticated, anon;
grant select, insert, update, delete on schools.student_identities to authenticated;
grant select, insert, update, delete on schools.student_identities to anon;
```

> Anonymous-first: grants include `anon` so anonymous students can link too.
> The app performs the actual writes with the service_role, so RLS is a
> defense-in-depth boundary here, not the write path.
