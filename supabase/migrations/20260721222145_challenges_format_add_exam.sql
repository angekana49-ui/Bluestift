alter table learning.challenges drop constraint if exists challenges_format_check;
alter table learning.challenges add constraint challenges_format_check
  check (format = any (array['mcq'::text, 'open'::text, 'debate'::text, 'exam'::text]));
