# Interactions profs : RAYA analytique, consignes, dashboard

Trois ajouts pour sortir le prof de son rôle de spectateur :

- **RAYA analytique** : `/api/school/raya` est ouvert au prof, avec un contexte **scopé à
  ses classes assignées** (`buildProfContext`). L'admin_master garde la vue école entière.
- **Consignes → RAYA élève** : le prof pose une consigne par (classe, matière). En chat
  **solo**, RAYA reçoit toutes les consignes actives de la classe de l'élève (fusionnées,
  bornées à 5 lignes / 1500 car.), injectées comme *guidage subordonné au guardrail
  socratique* — jamais une commande qui ferait donner la réponse. Résolution de la classe
  de l'élève via `student_identities` (service_role — l'élève n'a pas de RLS dessus).
- **Dashboard enrichi** : le prof voit les `class_insights` certifiés + les élèves à risque
  de ses classes (`getProfInsights`), lecture seule.

Seule la fonctionnalité « consignes » a besoin d'une table. RAYA-analytique et le
dashboard ne lisent que de l'existant (assignments, class_insights, kernel).

## SQL à appliquer dans Supabase (une fois)

```sql
create table if not exists schools.class_instructions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools.schools(id) on delete cascade,
  class_id    uuid not null references schools.classes(id) on delete cascade,
  subject_id  uuid references schools.subjects(id) on delete set null,  -- null = toutes matières
  created_by  uuid,                                                     -- school_admins.id
  content     text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists class_instructions_class_idx
  on schools.class_instructions (class_id) where is_active;

alter table schools.class_instructions enable row level security;  -- deny-all
grant select, insert, update, delete on schools.class_instructions to service_role;
```

> Écrite uniquement par la service_role via les routes (`assertClassAccess` gate l'accès :
> admin_master OU prof assigné à la classe). RLS deny-all suffit. Le grant explicite évite
> le piège des privilèges par défaut (cf. l'incident `schools.subjects`).

Tant que le SQL n'est pas appliqué, `getProfInsights`/RAYA marchent, et la section
Instructions dégrade en douceur (les lectures échouent en try/catch → liste vide).
