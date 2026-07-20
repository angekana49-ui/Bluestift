# Années scolaires (anti-collision de classes)

Le modèle existait déjà : `schools.school_years { id, school_id, label, start_date,
end_date, is_active }`, `schools.classes.school_year_id`,
`schools.schools.current_school_year_id`. La création d'école pose une année active,
la création de classe attache `school_year_id = current_school_year_id`.

Ce qu'on met en place :

- **Scoping** : le dashboard admin ne montre que les classes de l'**année active**
  (`getSchoolDashboard` filtre `school_year_id = currentYearId`). Deux classes « 3e B »
  d'années différentes ne s'affichent donc plus ensemble.
- **Unicité dure** : un index unique empêche deux classes de même nom dans la **même**
  (école, année). Deux années différentes peuvent réutiliser « 3e B » sans conflit.
- **Nouvelle année** : `POST /api/school/year` crée une année active, désactive
  l'ancienne, met à jour `current_school_year_id`. La nouvelle année démarre **vide** —
  rien n'est copié ; les classes de l'ancienne année restent archivées sous elle,
  ainsi que leurs élèves (`student_identities` porte déjà `school_year_id`).

La bascule est **automatique et stricte en août** : `ensureCurrentSchoolYear` tourne
au chargement de `/school` par un admin et, si l'année active est terminée
(`end_date < aujourd'hui`), avance vers l'année scolaire qui couvre la date du jour
(sens avant uniquement — une année avancée manuellement à l'avance n'est jamais reculée).
Pas de cron dans l'app : la bascule se matérialise à la 1ʳᵉ visite admin après la fin
de l'année.

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
