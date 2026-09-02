-- A second, durable slot for the analysis a learner ASKED to keep.
--
-- `latest_analysis` is written by the ambient every-3rd-turn pass and by the
-- explicit "Memorize" button, into the same column. That made memorising
-- pointless at the tutor's end, twice over:
--
--   1. the next ambient analysis (three turns later) overwrote it, and
--   2. it expired after 30 minutes anyway, because the read applies one TTL
--      chosen for the ambient case — "a root cause older than this describes a
--      session that has moved on", which is true of a pass nobody asked for and
--      false of one someone did.
--
-- So the dialog promised the thread was "anchored as something Raya can draw on
-- later", and thirty minutes later there was nothing left of it. This column is
-- the anchor: only the Memorize path writes it, nothing ambient touches it, and
-- it carries the Kernel's own summary of the conversation as well as the root
-- cause — which is the closest thing to "the conversation and its content"
-- that can honestly reach a later prompt, since we do not keep transcripts.
alter table learning.kernel_profile_snapshots
  add column if not exists anchored_analysis jsonb,
  add column if not exists anchored_updated_at timestamptz;

comment on column learning.kernel_profile_snapshots.anchored_analysis is
  'The most recent analysis the LEARNER asked for (Memorize), with the Kernel''s summary. Never written by the ambient post-conversation pass, and long-lived — unlike latest_analysis, which is the ambient slot and expires in minutes.';

comment on column learning.kernel_profile_snapshots.anchored_updated_at is
  'When anchored_analysis was written. Read-side TTL uses this.';
