-- Removing a teacher must never vaporize their data. The author columns below
-- reference schools.school_admins with cascading deletes: removing one prof
-- silently deleted their Prepare library, their reports, their student
-- follow-ups, their assignment records and the audit log rows about them —
-- from the prof's side and the admin's side alike, including the year-end
-- record entries built from those rows.
--
-- From here on those columns are plain uuid references (no FK), like
-- school_library.source_id: the membership goes, everything authored stays
-- under the school, and name lookups fall back for a departed author.
--
-- Deliberately kept: assignments (prof_id, created_by) — the removal route
-- deletes teaching assignments explicitly first; simulations_created_by —
-- only admin_masters author those and they are never removed this way;
-- staff_preferences_admin_id — the route deletes the prefs row first.
alter table schools.reports
  drop constraint if exists reports_created_by_fkey;
alter table schools.teacher_resources
  drop constraint if exists teacher_resources_created_by_fkey;
alter table schools.resource_assignments
  drop constraint if exists resource_assignments_assigned_by_fkey;
alter table schools.student_followups
  drop constraint if exists student_followups_author_admin_id_fkey;
alter table schools.school_admin_logs
  drop constraint if exists school_admin_logs_admin_id_fkey;

comment on column schools.reports.created_by is
  'school_admins row id of the author; plain reference, no FK — reports survive their author leaving the school.';
comment on column schools.teacher_resources.created_by is
  'school_admins row id of the author; plain reference, no FK — resources survive their author leaving the school.';
comment on column schools.resource_assignments.assigned_by is
  'school_admins row id of the assigner; plain reference, no FK — assignment records survive their author leaving the school.';
comment on column schools.student_followups.author_admin_id is
  'school_admins row id of the author; plain reference, no FK — follow-ups survive their author leaving the school.';
