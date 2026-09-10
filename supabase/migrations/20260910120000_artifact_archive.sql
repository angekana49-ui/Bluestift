-- The same archive/delete split conversations already have (see
-- 20260901120000_conversation_archive_and_memory.sql), extended to the other
-- three places a learner or a teacher accumulates generated work:
--
--   learning.tool_outputs    Raya Tools — summaries, quizzes, flashcards, mind
--                             maps (components/tools.tsx).
--   learning.challenges      Raya self-tests (room_id null) AND room challenges
--                             (room_id set) — both quiz/exam/skills sets.
--   schools.teacher_resources Raya for Schools "Prepare" library — exams,
--                             exercise sets, worksheets, quizzes.
--
-- Same contract as conversations: archived_at is nullable, additive, and a
-- pure timestamp flag — archiving never touches the row's content, and every
-- existing row stays valid (archived_at null = live, same as today).
alter table learning.tool_outputs
  add column if not exists archived_at timestamptz;
alter table learning.challenges
  add column if not exists archived_at timestamptz;
alter table schools.teacher_resources
  add column if not exists archived_at timestamptz;

comment on column learning.tool_outputs.archived_at is
  'When the learner archived this generated artifact. Non-null = filed away (dimmed, kept, restorable); the output_content is untouched.';
comment on column learning.challenges.archived_at is
  'When this self-test or room challenge was archived. Non-null = filed away for whoever could delete it (the creator, or for a room challenge also the room owner); questions and attempts are kept.';
comment on column schools.teacher_resources.archived_at is
  'When this Prepare resource was archived by its author or an admin_master. Non-null = filed away; content, questions and any class assignment are kept.';

-- Each surface's default list reads "mine, not archived, newest first" (or,
-- for challenges, "this room's" / "mine"); a partial index keeps that read off
-- the archived tail, same reasoning as conversations_user_live_idx.
create index if not exists tool_outputs_user_live_idx
  on learning.tool_outputs (user_id, created_at desc)
  where archived_at is null;
create index if not exists challenges_room_live_idx
  on learning.challenges (room_id, created_at desc)
  where archived_at is null;
create index if not exists teacher_resources_school_live_idx
  on schools.teacher_resources (school_id, created_at desc)
  where archived_at is null;
