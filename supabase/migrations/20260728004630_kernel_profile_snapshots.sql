-- Durable L2 under the in-memory kernel profile cache. On Vercel serverless
-- the per-instance Map is almost always cold, so without this Raya runs
-- profile-less on most turns. Service-role only: RLS on, NO policies.
create table if not exists learning.kernel_profile_snapshots (
  user_id uuid primary key references public.users(id) on delete cascade,
  profile jsonb,
  alerts jsonb not null default '[]'::jsonb,
  profile_updated_at timestamptz,
  alerts_updated_at timestamptz
);

alter table learning.kernel_profile_snapshots enable row level security;
