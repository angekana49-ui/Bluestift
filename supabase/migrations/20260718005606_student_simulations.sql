create table if not exists learning.student_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  focus text,
  add_hours integer not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table learning.student_simulations enable row level security;

create policy sim_owner on learning.student_simulations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on learning.student_simulations to authenticated, service_role;

create index student_simulations_user_created_idx
  on learning.student_simulations (user_id, created_at desc);
