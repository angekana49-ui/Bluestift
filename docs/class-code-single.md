# Un seul code d'accès courant par classe

Avant : une classe pouvait accumuler plusieurs codes actifs. Maintenant :

- **Un seul code courant par classe.** Il reste valable jusqu'à sa désactivation.
- Un code **désactivé à la main** peut être **réactivé** (réversible).
- **Générer un nouveau code retire l'ancien définitivement** (irréactivable).
- Les élèves déjà inscrits **gardent leur accès** : il vient de leur ligne
  `schools.student_identities`, pas de la validité du code — `join/route.ts` ne lit
  le code que pour résoudre la classe *au moment* du join.

Deux inactivités distinctes, qu'un booléen `is_active` ne portait pas :

| État | `is_active` | `retired_at` | Réactivable ? |
|---|---|---|---|
| Actif (courant) | `true` | `null` | — |
| Désactivé manuellement | `false` | `null` | **oui** |
| Retiré (remplacé) | `false` | *set* | **non** |

`getSchoolDashboard` ne remonte que les codes `retired_at is null` → la carte de
classe affiche **0 ou 1** code. Les codes retirés restent en base (audit) mais
invisibles. Aucun grant nouveau : la table est déjà écrite par la service_role.

## SQL à appliquer dans Supabase (une fois)

```sql
alter table schools.class_access_codes
  add column if not exists retired_at timestamptz;

-- Legacy : ne garder que le code le plus récent par classe comme courant, retirer les autres.
update schools.class_access_codes c
set is_active = false, retired_at = now()
where retired_at is null
  and exists (
    select 1 from schools.class_access_codes n
    where n.class_id = c.class_id
      and n.retired_at is null
      and (n.created_at, n.id) > (c.created_at, c.id)
  );
```

Après application, vérifier l'invariant (aucune classe avec >1 code courant) :

```sql
select class_id, count(*)
from schools.class_access_codes
where retired_at is null
group by class_id
having count(*) > 1;
```

Zéro ligne = OK.
