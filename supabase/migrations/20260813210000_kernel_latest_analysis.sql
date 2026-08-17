-- Carry the cross-concept half of /analyze across turns.
--
-- The snapshot table already stored `profile` (per-concept state) and `alerts`,
-- but the chat route kept only the alerts from an AnalyzeResponse and dropped
-- `root_gap`, `detection_path` and `recommended_path` — the Kernel's actual
-- root-cause finding. `/load_profile` cannot supply them: it returns state per
-- concept, not the chain the Kernel walked between concepts. So they have to be
-- carried here or they are lost the moment the request ends.
--
-- L1 is an in-process Map and is almost always cold on serverless, which is why
-- this belongs next to the other two columns rather than in memory alone.
--
-- Additive and nullable: existing rows stay valid, and app code written before
-- this column existed keeps working (it simply never reads it).
alter table learning.kernel_profile_snapshots
  add column if not exists latest_analysis jsonb;

comment on column learning.kernel_profile_snapshots.latest_analysis is
  'Last /analyze cross-concept result: {root_gap, detection_path, recommended_path, confidence, at}. Freshness is enforced on read (30 min), not here.';
