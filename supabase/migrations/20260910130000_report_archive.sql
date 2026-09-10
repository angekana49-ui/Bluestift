-- Same archive contract as 20260910120000_artifact_archive.sql, for the one
-- generated-artifact surface that migration missed: schools.reports (the
-- "Reports" tab, components/school-reports.tsx — school/class/subject
-- performance reports, distinct from schools.teacher_resources/"Prepare").
--
-- No delete counterpart on this table on purpose: unlike teacher_resources
-- (where only a CLASS-linked row matters to the record), every report counts
-- toward getYearArchive's "reports" section purely by its created_at falling
-- inside the school year's date range (lib/school-admin.ts getYearArchive),
-- regardless of scope. There is no class-less escape hatch here the way
-- there is for teacher_resources, so the app only ever offers archive for a
-- report, never a hard delete.
alter table schools.reports
  add column if not exists archived_at timestamptz;

comment on column schools.reports.archived_at is
  'When this report was archived by its author or an admin_master. Non-null = filed away out of the Reports tab; the row (and what getYearArchive reads from it) is untouched. Reports have no hard-delete in the app for that reason.';

create index if not exists reports_school_live_idx
  on schools.reports (school_id, created_at desc)
  where archived_at is null;
