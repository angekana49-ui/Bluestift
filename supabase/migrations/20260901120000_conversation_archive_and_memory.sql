-- Two lifecycle stamps a conversation can carry, beyond "it exists".
--
-- The history list used to offer exactly one verb — delete — so the only way to
-- get a finished thread out of the way was to destroy it. That made the list an
-- all-or-nothing archive: keep everything and drown, or lose the work. These two
-- columns split that single verb into three honest ones (memorize / archive /
-- delete), each with a different promise to the learner.
--
--   archived_at   the learner filed it away. It leaves the default list and is
--                 no longer offered as context, but every message is kept and it
--                 can be restored. Nullable BECAUSE null is the normal state:
--                 a timestamp is both the flag and the "when", which a boolean
--                 could not carry.
--
--   memorized_at  the learner asked the Kernel to read the whole thread and fold
--                 it into their cognitive profile. This is the anchor: it marks
--                 which conversations are part of what Raya knows about them on
--                 purpose, as opposed to the automatic every-3rd-turn analysis,
--                 which nobody chose and nobody can point at.
--
-- Both additive and nullable, so every existing row stays valid and code written
-- before this migration keeps working — it simply never reads them.
alter table learning.conversations
  add column if not exists archived_at timestamptz,
  add column if not exists memorized_at timestamptz;

comment on column learning.conversations.archived_at is
  'When the learner archived this conversation. Non-null = hidden from the default history list and not offered as context; messages are KEPT and it can be restored.';

comment on column learning.conversations.memorized_at is
  'When the learner asked the Kernel to absorb this conversation (user-initiated /analyze). Non-null = deliberately anchored into their cognitive profile.';

-- The history list reads exactly this: one user''s non-archived solo threads,
-- newest first. A partial index keeps that read off the archived rows entirely,
-- which is the whole point of archiving a long tail of them.
create index if not exists conversations_user_live_idx
  on learning.conversations (user_id, updated_at desc)
  where archived_at is null and room_id is null;
