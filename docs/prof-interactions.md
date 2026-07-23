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

## Dashboard enseignant complet (migration `prof_dashboard_tables`)

Le prof n'est plus un spectateur : `ProfView` (`components/school-admin.tsx`) est un vrai
tableau de bord — **Overview · Classes · Focus · Prepare · Insights · Reports · RAYA · Settings**.

- **Overview** (`components/school/prof-overview.tsx`) : KPIs de ses classes + fil « élèves à
  suivre » (→ Focus) + carte **Instructions → RAYA** par classe (rend `class-instructions.tsx`,
  extrait du roster pour éviter un import circulaire) + liens rapides.
- **Focus** (`FocusView`) : sélection classe→élève → `StudentDetailView` (cognitif + graphe) +
  **notes de suivi** partagées avec l'équipe de classe (`FollowupsPanel`,
  `components/school/prof-followups.tsx`). Sert le « suivi personnalisé » et le « mode focus ».
- **Prepare** (`components/school/prof-prepare.tsx`) : RAYA+Kernel génèrent exam/exo/worksheet/quiz
  **ancrés sur les lacunes réelles** (`buildClassContext`/`buildSubjectContext`). Une seule
  génération JSON produit les `questions[]` structurées ; le markdown est composé **de façon
  déterministe** (doc et jsonb ne peuvent pas diverger) → export PDF brandé + bibliothèque
  persistée. **Assignation aux élèves = branchée** (voir ci-dessous).
- **Reports** : `SchoolReports` réutilisé avec `allowedScopes={["class"]}` (le prof ne voit que
  ses classes ; école/matière restent admin).
- **Settings** : compte (thème/auth/billing) + **préférences d'enseignement**
  (`TeachingPreferencesCard`) — classe/matière par défaut, ton des rapports, focus lacunes.

### Nouvelles tables `schools` (RLS deny-all + grant service_role explicite)

- `student_followups` — notes de suivi, partagées équipe de classe (gate `assertClassAccess`).
- `teacher_resources` — bibliothèque exam/exo (`kind` CHECK exam|exercise|worksheet|quiz,
  `questions` jsonb = graine d'assignation future).
- `staff_preferences` — préférences par membership (`admin_id` = `school_admins.id`).

### Routes

`app/api/school/followups` (CRUD, `assertClassAccess`), `app/api/school/prepare`
(GET biblio / POST génère), `app/api/school/preferences` (GET/PATCH), `app/api/school/prof-overview`
(GET), `app/api/school/subjects` (GET ajouté, staff). `app/api/school/reports` **étendu** : un prof
peut générer un rapport `scope=class` sur une classe assignée (école/matière restent admin_master).

> Propagation « via RAYA » = côté prompt app (getStudentRecommendations), inchangée — le contrat
> Kernel n'ingère pas les consignes. Tout dégrade en douceur si le Kernel/LLM est indisponible.

## Assignation d'un exam/exo aux élèves (migration `assignment_challenges`)

Un `teacher_resources` peut être **assigné à une classe** : il est *matérialisé* en une
`learning.challenges` (scope `assignment`, nouveau dans le CHECK) + ses `challenge_questions`,
donc les élèves le passent via **le moteur de challenge existant** (1 tentative/user, QCM auto +
open notées par le LLM, boucle Kernel). Le lien est `schools.resource_assignments`
(`challenge_id` = uuid, couplage lâche cross-schema ; `class_id`, `due_at` optionnel, `is_active`).

- **Côté prof** (`prof-prepare.tsx`) : bouton **Assign** par item de biblio (classe + date limite
  optionnelle → `POST /api/school/prepare/assign`, gate `assertClassAccess`, dérive l'index QCM
  depuis `answer`), puis section **« Assigned to classes »** avec compteur *done/assigned* et
  **résultats par élève** (`GET /api/school/prepare/{assignments,results}`).
- **Côté élève** : nouvel onglet **Homework** (`/homework`, nav `raya-shell`, `AssignmentsView`
  réutilise `TestPlayer`). `GET /api/assignments` liste (statut à faire/fait+score/fermé),
  `?challengeId=` renvoie les questions **sans réponses**, `POST /api/assignments/submit` **garde**
  la passation : membre de la classe assignée, avant la date limite, **une seule tentative**
  (409 sinon), puis notation identique au challenge + feed Kernel.

> Décision : **1 tentative + date limite optionnelle** (vrai contrôle, pas entraînement).
> La notation est **dupliquée** (self-contained) plutôt que d'extraire le grader du chemin
> `/api/challenges/submit` éprouvé — même philosophie que le chemin de paiement.
