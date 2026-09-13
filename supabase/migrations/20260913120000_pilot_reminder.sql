-- The "pilot-started" email promises a reminder before a school's free pilot
-- ends. /api/cron/pilot-reminder keeps that promise, once per school.
--
-- Once is the whole difficulty. The cron runs daily with Vercel Hobby's ±59
-- minute precision and can miss a day, so it looks at a WINDOW (pilots ending
-- within a week) rather than at one exact date — which means the same school
-- shows up on several runs. This column is what makes those runs agree: the
-- cron claims a school by setting it (`where pilot_reminder_sent_at is null`)
-- before sending, so two overlapping runs cannot both email the same admin.
alter table schools.schools
  add column if not exists pilot_reminder_sent_at timestamptz;

comment on column schools.schools.pilot_reminder_sent_at is
  'When the "your pilot ends soon" email was sent (app/api/cron/pilot-reminder). '
  'Null until then. Set BEFORE sending, as the claim that keeps it to one email '
  'per pilot.';
