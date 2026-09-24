-- DRAFT — NOT APPLIED. See supabase/drafts/README.md and docs/prepared-updates.md.
--
-- Social v1: friendships + notifications, made safe to switch on.
--
-- Both tables already exist live (learning.friendships, learning.notifications)
-- with RLS on, but with one `FOR ALL` policy each and no separate WITH CHECK.
-- Probed 2026-09-24:
--
--   friendships_owner   ALL  USING (user_id = auth.uid() OR friend_id = auth.uid())
--   notifications_owner ALL  USING (user_id = auth.uid())
--
-- For FOR ALL, the USING expression doubles as the WITH CHECK. That makes the
-- friendship table writable from the browser in ways the product must never
-- allow:
--   * a user can INSERT (user_id = <anyone>, friend_id = me, status = 'accepted')
--     — a friendship "requested" by someone who never asked, already accepted;
--   * the requester can UPDATE their own pending row to 'accepted' — accepting
--     on the other person's behalf;
--   * either side can flip 'blocked' back to 'accepted'.
-- And a notification row is writable in full by its recipient (type, payload,
-- sender_id), which is harmless today only because nothing reads them.
--
-- The fix is the same shape as the rest of the app: the browser READS, the
-- server WRITES. Every transition goes through lib/social/friendships.ts on the
-- service role, where the state machine (lib/social/rules.ts) and the minor
-- rule are enforced. The only client write left is marking one's own
-- notification read, restricted to that one column by a column grant.

begin;

-- ── friendships ───────────────────────────────────────────────────────────

drop policy if exists friendships_owner on learning.friendships;

create policy friendships_read_own on learning.friendships
  for select to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
-- No INSERT / UPDATE / DELETE policy: with RLS on, that denies them to
-- `authenticated` and `anon`. The service role bypasses RLS.

-- Nobody befriends themselves.
alter table learning.friendships
  add constraint friendships_not_self check (user_id <> friend_id);

-- One row per PAIR, not per direction. UNIQUE (user_id, friend_id) already
-- exists, but it lets A→B and B→A coexist, and two rows for one relationship
-- means two statuses that can disagree (one side blocked, the other accepted).
-- Fails if such a pair exists live — check first:
--   select least(user_id, friend_id), greatest(user_id, friend_id), count(*)
--   from learning.friendships group by 1, 2 having count(*) > 1;
create unique index if not exists friendships_pair_key
  on learning.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

-- "Who blocked whom" — the status alone cannot say, and only the blocker may
-- lift a block. Null unless status = 'blocked'.
alter table learning.friendships
  add column if not exists blocked_by uuid references public.users(id) on delete cascade;
alter table learning.friendships
  add constraint friendships_blocked_by_consistent
  check ((status = 'blocked') = (blocked_by is not null));

-- The recipient side of the RLS predicate and of the incoming-requests list.
create index if not exists friendships_friend_id_idx on learning.friendships (friend_id);

-- ── notifications ─────────────────────────────────────────────────────────

drop policy if exists notifications_owner on learning.notifications;

create policy notifications_read_own on learning.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_mark_read_own on learning.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The UPDATE policy says WHICH rows; the column grant says WHICH columns.
-- Without it a recipient could rewrite type/payload/sender_id on their own rows.
revoke update on learning.notifications from authenticated;
grant update (is_read) on learning.notifications to authenticated;

-- The feed query: newest first, per user; and the unread badge.
create index if not exists notifications_user_created_idx
  on learning.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on learning.notifications (user_id) where not is_read;

commit;

-- NOT in this draft, on purpose — decided in docs/prepared-updates.md:
--   * Realtime publication for notifications (polling first; add it once the
--     feed exists and the cost is measured).
--   * A retention job. Notifications are ephemeral; 90 days is the proposal,
--     implemented as a cron once there is something to prune.
