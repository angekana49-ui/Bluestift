# Années scolaires (anti-collision de classes)

Le modèle existait déjà : `schools.school_years { id, school_id, label, start_date,
end_date, is_active }`, `schools.classes.school_year_id`,
`schools.schools.current_school_year_id`. La création d'école pose une année active,
la création de classe attache `school_year_id = current_school_year_id`.

Ce qu'on met en place :

- **Scoping** : le dashboard admin ne montre que les classes de l'**année active**
  (`getSchoolDashboard` filtre `school_year_id = currentYearId`). Deux classes « 3e B »
  d'années différentes ne s'affichent donc plus ensemble. `getSchoolOverview` applique
  **le même filtre** : sans lui, Overview affichait des classes archivées comme si elles
  étaient vivantes pendant que tous les autres onglets disaient « No classes ».
- **Unicité dure** : un index unique empêche deux classes de même nom dans la **même**
  (école, année). Deux années différentes peuvent réutiliser « 3e B » sans conflit.
- **Nouvelle année (manuelle)** : `POST /api/school/year` crée une année active, désactive
  l'ancienne, met à jour `current_school_year_id`. La nouvelle année démarre **vide** —
  rien n'est copié ; les classes de l'ancienne année restent archivées sous elle,
  ainsi que leurs élèves (`student_identities` porte déjà `school_year_id`). C'est ce que
  la confirmation du bouton « New year » promet à l'admin.

La bascule est **automatique et stricte en août** : `ensureCurrentSchoolYear` tourne
au chargement de `/school` par un admin et, si l'année active est terminée
(`end_date < aujourd'hui`), avance vers l'année scolaire qui couvre la date du jour
(sens avant uniquement — une année avancée manuellement à l'avance n'est jamais reculée).
Pas de cron dans l'app : la bascule se matérialise à la 1ʳᵉ visite admin après la fin
de l'année.

## Report des classes (bascule automatique uniquement)

La bascule automatique **reporte la structure des classes** de l'année qui se termine
vers la nouvelle (`carryClassesForward`) : nom, niveau, effectif — plus un **code d'accès
neuf** par classe. Les élèves ne suivent pas : la nouvelle année démarre avec les mêmes
classes, vides.

Pourquoi cette différence avec le bouton manuel : la bascule automatique est prise **au
nom de l'école, sans la prévenir**. Sans report, une école installée en juillet trouvait
« No classes » dans Classes & codes, Reports, Team et LMS le matin de la rentrée — tout
en continuant de voir sa classe dans Overview. Le bouton manuel, lui, demande d'abord et
promet une année vierge : il ne copie rien.

Les codes encore actifs de l'année qui se termine sont **désactivés** au passage. Un
élève qui utiliserait l'ancien code atterrirait dans une classe archivée, invisible sur
tous les écrans de gestion — exactement le classement silencieux que le report existe
pour éviter. Les élèves déjà inscrits gardent leur accès (il vit sur `student_identities`,
pas sur le code).

Le report est **idempotent** : un nom déjà présent dans la nouvelle année est ignoré, et
une ligne perdue face à l'index unique (deux admins qui chargent `/school` en même temps)
est sautée. La règle de sélection est pure et testée dans
`test/school-year-rollover.test.ts`.

## Reconduction de l'équipe : un code par année

Les classes sont reportées, **l'équipe se re-déclare**. À chaque bascule (automatique ou
bouton « New year »), `rotateStaffCodeForYear` désactive les codes staff en cours et en
génère **un neuf pour l'année**. Un prof qui revient saisit ce code, l'admin valide.

Pourquoi c'est mieux qu'un report automatique des profs : les partants tombent d'eux-mêmes
(ils ne saisissent jamais le code) sans que l'admin ait à se souvenir de qui s'en va, et un
code qui a fuité dans un groupe WhatsApp de salle des profs cesse de marcher au changement
d'année.

**Ce qui n'est PAS reconduit : les affectations.** Un prof de maths en 2nde une année peut
prendre la Terminale la suivante — ce qu'on enseigne se redécide chaque rentrée. La
reconduction remet la *personne* dans l'équipe, pas l'emploi du temps de l'an dernier.
Conséquence assumée : `getProfClasses` est scopé à l'année courante, donc un prof reconduit
voit un tableau vide tant que l'admin ne l'a pas affecté — et vide est la réponse honnête,
pas les classes de septembre dernier.

Le parcours :

1. bascule → codes staff désactivés, un code neuf, les `admin_master` confirmés d'office ;
2. le prof ouvre `/school` → écran « New school year », il saisit le code (`RenewYear`) ;
3. `POST /api/school/join-team` reconnaît un membre non confirmé → `renewed` (code
   auto-approve) ou une demande en attente ;
4. l'admin valide dans Team → `confirmMembershipForYear` ;
5. les profs pas encore revenus portent un badge « Not back yet » ; l'admin retire ceux qui
   sont partis avec l'action déjà existante.

### Ne jamais enfermer un prof dehors

`needsYearReconfirmation` (pure, testée) a trois échappatoires délibérées, parce que le coût
d'un faux positif est un vrai prof bloqué hors de son école :

- un `admin_master` n'est **jamais** interrogé — il faut bien quelqu'un pour valider ;
- une base **sans la colonne** (`tracked: false`) confirme tout le monde : une migration non
  appliquée dégrade vers l'ancien comportement, pas vers une école inaccessible ;
- une école sans année active n'interroge personne.

C'est aussi pour ça que `pickActiveAdminRow` et `getTeam` font `select("*")` au lieu de
nommer la colonne : la nommer ferait échouer **toute** résolution d'appartenance sur une base
non migrée. Et `confirmMembershipForYear` est toujours un `UPDATE` séparé, jamais fondu dans
l'`INSERT` qui crée l'appartenance — sinon un prof ne pourrait plus rejoindre du tout.

### SQL à appliquer dans Supabase (une fois)

```sql
-- Quelle année scolaire cette appartenance a-t-elle confirmée.
alter table schools.school_admins
  add column if not exists confirmed_school_year_id uuid
    references schools.school_years(id) on delete set null;

-- Backfill : le personnel déjà en place compte comme confirmé pour l'année courante
-- de son école, pour que l'application de cette migration ne mette personne dehors
-- rétroactivement.
update schools.school_admins sa
   set confirmed_school_year_id = s.current_school_year_id
  from schools.schools s
 where s.id = sa.school_id
   and sa.confirmed_school_year_id is null;
```

> Tant que ce n'est pas appliqué : rien ne casse, personne n'est interrogé, le code staff
> tourne quand même à chaque année (c'est la confirmation qui n'est pas suivie).

## L'onglet Archive : le registre d'une année

L'archive n'est pas « les classes de l'an dernier », c'est **tout ce que l'école a produit
et collecté dans l'app pendant une année scolaire**. Elle a donc son propre onglet
(`nav.archive`, `components/school-archive.tsx`), pas un menu déroulant caché dans
« Classes & codes » — qui reste, lui, l'écran de travail de l'année vivante.

`GET /api/school/year` liste les années (`getSchoolYears`).
`GET /api/school/archive?yearId=` (`getYearArchive`) renvoie le registre : des sections
(classes, élèves inscrits, codes émis, insights certifiés, affectations, consignes Raya,
ressources profs, travail donné, suivis élèves, mappings LMS, rapports, simulations,
directives, personnel arrivé, demandes d'adhésion, codes d'invitation, ajustements
d'effectif, paiements, actions admin journalisées), chacune avec son total et ses entrées.
L'écran est en lecture seule **par construction** : il n'a aucun chemin d'écriture.

### Rattacher une ligne à une année

Trois bases, affichées à l'admin plutôt que masquées (`ArchiveBasis`) :

| base | tables | exactitude |
|---|---|---|
| `year` | `classes`, `student_identities`, `class_access_codes`, `class_insights`, `enrollment_adjustments` | exacte — la ligne porte `school_year_id` |
| `class` | `assignments`, `class_instructions`, `teacher_resources`, `resource_assignments`, `student_followups`, `lms_class_mappings` | exacte — la ligne pend à une classe, qui porte l'année |
| `period` | `reports`, `simulations`, `school_directives`, `school_join_requests`, `staff_invite_codes`, `school_admins`, `payments`, `school_admin_logs` | **approximative** — rattachée par `created_at` dans les dates de l'année |

`periodBounds` (pure, testée) est la seule définition de « créé pendant cette année » :
intervalle semi-ouvert `[début 00:00Z, fin+1j 00:00Z)`, donc la borne haute d'une année est
exactement la borne basse de la suivante — ni trou, ni doublon. Les dates sont en UTC : une
ligne créée à quelques heures d'une frontière d'année peut basculer du mauvais côté, et
l'UI le dit. Une année sans dates ne rattache **rien** par période (ouvrir l'intervalle
classerait tout l'historique de l'école sous cette année-là).

### Ce que le registre ne contient pas, volontairement

- **Le profil cognitif des élèves.** Il appartient à l'apprenant, pas à l'établissement.
  L'archive porte ce que l'**école** possède : ses listes, ses classes et codes, ce que son
  personnel a écrit, généré et décidé, et les agrégats certifiés au niveau classe. Une
  archive n'est pas un contournement de la frontière `school_id`.
- Le catalogue de matières, les clés API et les abonnements push : hors année, hors sujet.

Les sections sont plafonnées à 200 entrées listées ; les **totaux restent exacts** et une
note dit lesquelles ont été tronquées.

## Une liste de classes qui bouge

Une liste de classes n'est pas la même deux ans de suite : une classe est renommée,
disparaît, une autre apparaît. Ces modifications appartiennent à l'**année vivante** ;
les années passées sont un enregistrement.

**Modifier l'année courante.** `PATCH /api/school/classes` accepte désormais `name`,
`level` et `expectedSize` — seules les clés présentes sont écrites, donc l'éditeur
d'effectif et le renommage envoient chacun les siennes. `DELETE /api/school/classes`
retire une classe de l'année courante.

Les deux passent par `resolveEditableClass`, qui refuse (409) toute classe dont
`school_year_id` n'est pas l'année courante (`isArchivedClass`). C'est la garantie
demandée : **rien de ce qu'on fait cette année ne touche les années précédentes**.
Renommer « 3e B » cette année laisse le « 3e B » de l'an dernier intact, avec son nom,
ses élèves et ses codes — ce sont deux lignes distinctes.

Règles de suppression (`deleteBlockReason`, pures et testées) :

- classe archivée → refus, toujours ;
- classe avec des élèves → refus (c'est de la donnée ; elle sera archivée toute seule à
  la fin de l'année) ;
- sinon la ligne part avec ce qui n'a aucun sens sans elle : ses codes d'accès, ses
  affectations de profs, ses consignes Raya de classe. Le mapping LMS est **dé-pointé**
  (`class_id = null`) plutôt que supprimé — la classe externe reste listée dans la
  connexion et l'admin la re-pointe ailleurs. Toute autre référence fait échouer la
  suppression bruyamment plutôt que de cascader dans de la vraie donnée.

## SQL à appliquer dans Supabase (une fois)

```sql
-- Unicité du nom de classe par (école, année) — insensible à la casse.
create unique index if not exists classes_school_year_name_uniq
  on schools.classes (school_id, school_year_id, lower(name));

-- Une seule ligne d'année par (école, label) — sécurise le find-or-create de la
-- bascule automatique contre un doublon lors de deux chargements concurrents.
create unique index if not exists school_years_school_label_uniq
  on schools.school_years (school_id, label);
```

> Suppose qu'aucun doublon n'existe déjà dans une même année — sinon la création de
> l'index échoue. Sonder d'abord :
>
> ```sql
> select school_id, school_year_id, lower(name), count(*)
> from schools.classes
> group by 1, 2, 3
> having count(*) > 1;
> ```
>
> Doit être vide. S'il y a des doublons, renommer/supprimer avant de créer l'index.

Aucun grant nouveau : `schools.classes` est déjà écrite par la service_role.
