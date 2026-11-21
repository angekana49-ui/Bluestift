-- The school's own shelf: frozen copies of what teachers choose to send up
-- (Prepare resources + generated reports), decided by the prof, kept by the
-- school. The copy is a snapshot — title, content, payload frozen at send
-- time — so it survives the original being edited, archived or deleted in
-- the teacher's library. The school side only ever archives these rows,
-- never hard-deletes them; deletion lives in the teacher's library.
--
-- source_id is a reference, deliberately NOT a foreign key: deleting the
-- original must not cascade (or block) here.
create table if not exists schools.school_library (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  source_type text not null check (source_type in ('prepare', 'report')),
  source_id uuid,
  title text not null,
  content text not null default '',
  kind text,
  payload jsonb not null default '{}',
  class_id uuid,
  subject_id uuid,
  sent_by uuid not null,
  sent_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table schools.school_library is
  'Frozen copies sent by teachers to their school (Prepare resources + generated reports). One live row per source: re-sending refreshes the snapshot. School side archives, never deletes.';
comment on column schools.school_library.sent_by is
  'school_admins row id of the sending teacher — same identifier as created_by elsewhere, not the auth user id.';
comment on column schools.school_library.payload is
  'Frozen structured data: questions for a prepare copy, parameters for a report copy.';

create index if not exists school_library_school_live_idx
  on schools.school_library (school_id, sent_at desc)
  where archived_at is null;

-- One live copy per source: sending again refreshes the snapshot instead of
-- stacking duplicates.
create unique index if not exists school_library_source_live_uidx
  on schools.school_library (school_id, source_type, source_id)
  where archived_at is null and source_id is not null;

alter table schools.school_library enable row level security;

-- No policies on purpose: every read and write goes through the API routes
-- on the service-role admin client (RLS bypass), like the rest of the
-- schools schema. Direct client access stays denied by default.
