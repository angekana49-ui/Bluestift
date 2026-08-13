create table if not exists learning.shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'doc',
  title text,
  body text,
  brand text not null default 'raya',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table learning.shares enable row level security;
drop policy if exists shares_owner on learning.shares;
create policy shares_owner on learning.shares
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists shares_user_idx on learning.shares (user_id, created_at desc);
