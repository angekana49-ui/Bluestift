# Directives école-wide (admin → RAYA → l'école)

Le cran au-dessus des recommandations prof (`class_instructions`, par classe). Ici
l'**admin_master** pose une directive à l'échelle de **toute l'école**, avec une
**audience ciblable** par directive :

- `students` → descend aux élèves via RAYA (banner « 📌 For you » sur `/chat`, source
  « Your school », + préférence douce dans le prompt — jamais une obligation).
- `teachers` → visible aux profs (banner « 📌 From your school » dans leur espace),
  cadrage informatif pour aligner leurs propres recos de classe. Pas d'injection RAYA.
- `both` → les deux.

Même philosophie que les recos prof : suggestion douce, RAYA n'oblige jamais l'élève et
ne lâche jamais de réponse. Diffusion élèves fusionnée dans `getStudentRecommendations`
(résolution école via `student_identities.school_id`, service_role).

Écrit uniquement par la service_role via `/api/school/directives` (POST/PATCH/DELETE
gate `admin_master` ; GET rôle-aware : admin voit tout pour gérer, prof voit les actives
`teachers`/`both`).

## SQL à appliquer dans Supabase (une fois)

```sql
create table if not exists schools.school_directives (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools.schools(id) on delete cascade,
  audience    text not null default 'both' check (audience in ('students','teachers','both')),
  content     text not null,
  created_by  uuid,                       -- school_admins.id
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists school_directives_school_idx
  on schools.school_directives (school_id) where is_active;

alter table schools.school_directives enable row level security;  -- deny-all
grant select, insert, update, delete on schools.school_directives to service_role;
```

> Grant explicite (piège `schools.subjects`). Tant que non appliqué, tout dégrade en
> douceur : les lectures échouent en try/catch → aucune directive, pas de crash.
