# Room de classe — spec (non construite)

> **Statut : spec seulement.** Rien de ce qui suit n'est codé. À construire lors d'une
> mise à jour future, une fois qu'il y aura de vrais utilisateurs pour valider les
> limites ci-dessous. Les chiffres (40 élèves, 1 room, 3 profs…) sont des points de
> départ à recalibrer sur l'usage réel, pas des décisions définitives.

## Pourquoi

Le modèle économique est « gratuit pour apprendre seul, payant pour apprendre ensemble » :

```
Solo gratuit → Room de classe (prof, gratuit) → Pilote école 45 j → Contrat ≥ 100 élèves
```

Aujourd'hui la marche du milieu manque. Un prof seul, avec sa classe de 30, n'a nulle part
où aller :

| Chemin actuel | Blocage pour un prof seul |
|---|---|
| **Room** (B2C) | 8 participants en Free, 25 en Plus, 50 en Max (`roomMaxParticipants`, plafond fixé par le plan du **créateur** — `app/rooms/actions.ts` `joinRoom`). Aucun outil prof. Pour 30 élèves, le prof paie Max (20 $) de sa poche. |
| **École** (B2B) | Création par un admin, ≥ `MIN_B2B_SEATS` (100) élèves déclarés, pilote `SCHOOL_PILOT_DAYS` (45 j) puis lecture seule (`lib/billing/terms.ts`, `app/api/school/create/route.ts`). Pensé pour un directeur, pas pour un prof. |

La Room de classe comble ce trou **sans toucher au plancher de 100** : ce n'est pas une
petite offre école, c'est ce qui amène une école à signer.

## Trois règles qui ne bougent pas

1. **Plafonnée sous le contrat école.** Une room de classe ne doit jamais pouvoir
   remplacer un contrat ≥ 100 élèves (plafond par room, par prof, et par établissement —
   voir *Anti-cannibalisation*).
2. **Limitée en fonctions, pas en durée.** Pas d'expiration : le prof garde sa room toute
   l'année. Ce qui reste réservé à l'école : Prepare, rapports, simulations, exports,
   consignes, multi-classes.
3. **Une seule porte de sortie : « Passer à l'école ».** Elle lance le pilote de 45 jours
   et y importe la classe et ses élèves.

## Définition

Une **Room de classe** est une Room existante (`learning.rooms`) avec un type distinct —
pas un nouvel objet. Elle réutilise tout ce que les Rooms ont déjà : adhésion, messages,
Raya partagée, verrou mineurs, analyses Kernel des participants.

| | Room gratuite | **Room de classe** | Pilote école |
|---|---|---|---|
| Créée par | tout utilisateur | **adulte, e-mail réel, se déclare prof** | admin d'école |
| Participants max | 8 | **40** | ≥ 100 (déclarés) |
| Nombre par créateur | 3 / mois | **1 active** | illimité |
| Durée | minuteur possible | **sans expiration** | 45 j puis lecture seule |
| Visibilité | privée par défaut | **toujours privée** | — |
| Vue prof par élève | ✗ | **✓ (minimale, voir plus bas)** | ✓ complète |
| Prepare / rapports / simulations / exports / consignes | ✗ | ✗ | ✓ |
| Prix | 0 | **0** | 0 pendant le pilote, puis contrat |

Les élèves d'une Room de classe gardent **leur propre plan** pour leur usage solo
(quota Free de 30 messages/jour, etc.). La Room de classe n'offre aucun avantage Plus aux
élèves : elle ne sert qu'à former le groupe et donner une vue au prof.

## Qui peut en créer une

- **Adulte** : `ageBand(birthYear) === "adult"` (`lib/compliance/age.ts`). Un compte à
  l'année de naissance non déclarée est traité comme mineur → refusé.
- **E-mail réel** : `hasRealEmail` (même garde que la création d'école) — pas de compte
  anonyme, puisque ce compte sera responsable d'un groupe de mineurs.
- **Se déclare enseignant** : case déclarative + nom de l'établissement (texte libre).
  Pas de vérification en v1 ; le nom sert à l'anti-cannibalisation et au futur import
  dans l'école.
- **Une seule Room de classe active** par prof. Pour une deuxième classe → école.

## Rejoindre

- Par **code ou lien d'invitation** (même mécanique que les Rooms privées).
- Les élèves **peuvent être anonymes** (sans e-mail), comme dans les écoles.
- **Année de naissance obligatoire** avant d'entrer.
- **Toujours privée** : le verrou `20260901140000_room_minor_visibility_lock.sql` s'applique
  déjà (une room avec un mineur ne peut pas devenir publique). La Room de classe va plus
  loin : la visibilité publique n'est jamais proposée.

### Moins de 13 ans — point juridique à trancher avant de construire

Dans une école, c'est **l'école** qui peut consentir à la place du parent pour l'usage
scolaire (exception « school authorization » de COPPA). **Un prof agissant seul n'est pas
l'école** : cette exception ne couvre pas une Room de classe.

Proposition v1, à faire valider :

- **Moins de 13 ans : pas d'entrée** dans une Room de classe, sauf via le parcours
  d'attestation du parent/tuteur déjà prévu (`lib/compliance/age.ts`, attestation stockée).
- **13–17 ans** : entrée possible, avec les mêmes règles que les Rooms actuelles.
- Relire la règle au regard des pays visés (RGPD art. 8 par État membre, et les lois
  nationales qui exigent le consentement parental jusqu'à 18 ans).

## Vue prof (minimale)

Une seule page, une ligne par élève. Rien de plus en v1.

| Colonne | Source | Note |
|---|---|---|
| Élève | pseudo dans la room | jamais l'e-mail |
| Dernière activité | messages / sessions | « il y a 3 j » |
| **Lacune principale** | dernière analyse Kernel (`root_gap`, `detection_path`) | le cœur de la valeur |
| Fiabilité du signal | `confidence` + nombre d'observations | affichée en mots (« indice faible / moyen / solide »), **jamais en %** : ce n'est pas une probabilité calibrée |
| Alertes | `/load_alerts` | seulement `passive_dependency` et `cognitive_overload` en v1 |

**Ce que le prof ne voit pas en v1 :**

- **Le contenu des conversations solo** des élèves (vie privée ; il voit les messages de la
  room, pas le reste).
- **Le « mindset »** (M) : exclu tant que son calcul n'est pas corrigé et validé côté
  Kernel.
- **Les notes, classements, comparaisons entre élèves** : cohérent avec la thèse « on mesure
  chacun par rapport à lui-même ».

**v2 (quand il y aura des données)** : « lacunes communes » — les notions vers lesquelles
convergent les lacunes de plusieurs élèves, pour que le prof sache quoi reprendre en classe.

## Kernel et coût

- **Aucun nouveau calcul** : les participants sont déjà analysés par la boucle existante
  (`/analyze` tous les 3 tours de chat). La vue prof ne fait que **lire** ces analyses.
- Le coût LLM d'un élève de Room de classe est celui d'un **utilisateur Free** (ses propres
  quotas s'appliquent). Une classe de 40 élèves tous au plafond ≈ 40 × 1–2 $/mois ; en usage
  réel, bien moins. À suivre via `tokens_used`, agrégé par room.

## Conversion vers l'école

**Déclencheurs du bouton « Passer à l'école »** (affiché, jamais imposé) :

- la room atteint son plafond de 40 ;
- le prof ouvre une fonction réservée (Prepare, rapports, deuxième classe…) ;
- un **deuxième prof du même établissement** crée sa Room de classe ;
- fin de période (trimestre / semestre), pour préparer la suivante.

**Parcours :**

1. Le prof crée l'école lui-même (il devient admin), **ou** envoie une invitation à son
   directeur (lien pré-rempli avec l'établissement et le nombre d'élèves de la room).
2. Création d'école inchangée : plan choisi, ≥ 100 élèves déclarés, pilote de 45 jours.
3. **Import** : la room devient une classe de l'école.
   - chaque membre reçoit une ligne `schools.student_identities` rattachée à son compte
     existant — **son profil Kernel est conservé** ;
   - le prof devient prof de cette classe ;
   - la room passe en lecture seule (historique conservé) et renvoie vers la classe.
4. Les autres Rooms de classe du même établissement se voient proposer le même import.

Le plancher de 100 élèves et la durée du pilote **ne changent pas**.

## Anti-cannibalisation

Risque : une école fait tourner 20 profs × 40 élèves en Rooms de classe gratuites
= 800 élèves sans contrat.

- **1 Room de classe active par prof**, 40 élèves max.
- **Plafond par établissement** : à partir du **3ᵉ prof** déclarant le même établissement
  (nom normalisé et/ou domaine e-mail), les nouvelles Rooms de classe de cet établissement
  sont proposées **uniquement via le pilote école**. Les rooms existantes continuent
  de fonctionner.
- Un élève ne compte qu'une fois par établissement, même s'il est dans plusieurs rooms.

## Ce qu'il faudra toucher (repères, pas un plan d'implémentation)

- **Données** : un type de room (`kind = 'standard' | 'class'`) sur `learning.rooms` ; le
  nom d'établissement déclaré ; migration + RLS.
- **Entitlements** (`lib/entitlements.ts`) : les limites de Room de classe viennent du
  **type de room**, pas du plan du créateur — aujourd'hui `joinRoom` prend le plafond dans
  le plan du créateur, il faudra une branche pour `kind = 'class'`.
- **Création** (`app/rooms/actions.ts` `createRoom`) : gardes adulte + e-mail réel + 1 active.
- **Vue prof** : une page lecture seule qui lit les analyses Kernel des membres
  (`lib/kernel/profile-cache.ts`, `/load_alerts`).
- **Conversion** : une route qui crée la classe dans l'école et les `student_identities`
  depuis les membres de la room.
- **i18n** : EN / FR / ES / DE.
- **Tests** : plafond 40, 1 active par prof, refus mineur/anonyme à la création, verrou
  mineurs, import sans perte de profil, plafond par établissement.

## À mesurer une fois en ligne

- Rooms de classe créées → **taux de conversion en pilote école** (l'indicateur qui compte).
- Élèves actifs par room et par semaine.
- Délai entre création de la room et demande de pilote.
- Coût LLM moyen par élève de room (`tokens_used`).
- Part des rooms qui touchent le plafond de 40.

## Questions ouvertes

1. 40 élèves est-il le bon plafond (classes de 25 à 70 selon les pays) ?
2. Le prof doit-il pouvoir lire les messages solo d'un élève **avec son accord** ?
3. Moins de 13 ans : exclusion ou attestation parentale — à faire valider juridiquement.
4. Plafond par établissement : 3 profs, ou plutôt un nombre total d'élèves ?
5. Le prof qui crée l'école en devient-il admin, ou faut-il toujours un directeur ?

## Hors périmètre

- Toute forme de paiement côté prof (la Room de classe est gratuite, point).
- Le social élève ↔ élève au-delà de la room (branche `prepared/social-newsletter`).
- L'intégration LMS (LTI, add-ons Google Classroom) — sujet séparé.
