-- "Calcul rapide": a challenge of quick arithmetic, taken without the Maths
-- panel (the calculator solves equations, which would make the test pointless).
-- The app reads `format = 'quickcalc'` to lock the panel while it is taken.
-- Widening the CHECK only: every existing row stays valid.
alter table learning.challenges drop constraint if exists challenges_format_check;
alter table learning.challenges
  add constraint challenges_format_check
  check (format = any (array['mcq'::text, 'open'::text, 'debate'::text, 'exam'::text, 'quickcalc'::text]));
