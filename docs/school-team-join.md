# Rattacher un prof à une école — invitation + demande

Deux sens complémentaires, portés par une seule mécanique de code :

- **Admin → prof (invitation).** L'admin_master génère un code d'équipe et le partage
  (lien `/(school)?join=CODE`). Le prof le colle → rejoint. Si le code est
  `auto_approve`, le rattachement est **instantané** ; sinon il crée une **demande**.
- **Prof → admin (demande).** Le prof colle un code non-auto-approve → une demande en
  attente que l'admin **approuve/refuse** dans l'onglet Équipe.

Le rattachement reste une ligne `schools.school_admins { user_id, school_id, role:'prof' }`
— ces tables ne font que **le contrôler**. Un prof rattaché ne voit aucune classe tant
qu'une `assignments` (prof × classe × matière) n'est pas créée : c'est voulu, inchangé.

Comme tout le schéma `schools`, ces tables ne sont écrites que par la **service_role**
depuis les routes API → RLS `deny-all` suffit, aucune policy `authenticated`. Le
`grant … to service_role` est explicite : les privilèges par défaut du schéma ne
couvrent pas les tables créées hors de leur fenêtre (cf. l'incident `schools.subjects`).

Tant que le SQL n'est pas appliqué, `getTeam` dégrade en douceur (les `select` sur les
tables manquantes échouent, capturés) : l'onglet Équipe s'affiche sans les cartes
Invitations/Demandes, et redeem d'un code renvoie une erreur propre.

## SQL à appliquer dans Supabase (une fois)

```sql
-- Codes d'accès équipe (miroir de schools.class_access_codes).
create table if not exists schools.staff_invite_codes (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools.schools(id) on delete cascade,
  code         text not null unique,
  auto_approve boolean not null default false,  -- true = join instantané ; false = crée une demande
  is_active    boolean not null default true,
  created_by   uuid,                            -- school_admins.id de l'admin_master
  created_at   timestamptz not null default now()
);
create index if not exists staff_invite_codes_school_idx on schools.staff_invite_codes (school_id);

-- Demandes de rattachement prof → école (approbation requise).
create table if not exists schools.school_join_requests (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools.schools(id) on delete cascade,
  user_id     uuid not null,                    -- public.users.id du prof demandeur
  code_id     uuid references schools.staff_invite_codes(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  decided_by  uuid,
  decided_at  timestamptz
);
-- Au plus une demande en attente par (école, user).
create unique index if not exists school_join_requests_one_pending
  on schools.school_join_requests (school_id, user_id) where status = 'pending';

alter table schools.staff_invite_codes enable row level security;   -- deny-all
alter table schools.school_join_requests enable row level security;

grant select, insert, update, delete on schools.staff_invite_codes to service_role;
grant select, insert, update, delete on schools.school_join_requests to service_role;
```

Après application, confirmer que les tables répondent :

```sql
select to_regclass('schools.staff_invite_codes'),
       to_regclass('schools.school_join_requests');
```

Deux valeurs non nulles = prêt.
