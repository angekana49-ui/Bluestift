-- Split the anonymous-account reaper in two: SELECT here, DELETE in the app.
--
-- `delete_expired_anons` did both, deleting straight from auth.users and
-- relying on the cascade. That cascade never reaches the kernel schema (whose
-- user_id columns carry no foreign key), rag.conversation_embeddings, or object
-- storage — so a reaped account left its cognitive profile and its uploaded
-- files behind. It also only ANONYMISED room messages, because that FK is
-- ON DELETE SET NULL.
--
-- Rather than fix the same list of exceptions twice, the cron now calls the one
-- erasure routine the user's own delete button calls (lib/compliance/erasure.ts).
-- This function's only job is to say WHICH accounts qualify — the scope rules,
-- unchanged, in the one place they were already correct.
create or replace function public.list_expired_anons(
  p_days integer default 180,
  p_limit integer default 100
)
returns setof uuid
language sql
security definer
set search_path to 'public', 'auth', 'schools'
as $$
  select u.id
    from public.users u
    join auth.users au on au.id = u.id
   where (u.email is null or lower(u.email) like '%@anon.bluestift.local')
     and u.school_id is null
     and u.class_enrollment_id is null
     and not exists (select 1 from schools.student_identities si where si.user_id = u.id)
     and not exists (select 1 from schools.school_admins   sa where sa.user_id = u.id)
     and coalesce(au.last_sign_in_at, u.created_at) < now() - make_interval(days => p_days)
   limit p_limit;
$$;

revoke all on function public.list_expired_anons(integer, integer) from public, anon, authenticated;

comment on function public.delete_expired_anons(integer, integer) is
  'SUPERSEDED by list_expired_anons + lib/compliance/erasure.ts. It deletes from '
  'auth.users and leaves behind everything no cascade reaches (kernel.*, '
  'rag.conversation_embeddings, storage objects). Kept only so a rollback to the '
  'previous deploy still works; drop it once that is no longer needed.';
