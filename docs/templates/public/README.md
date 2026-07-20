# Public site templates — design reference

Copie **verbatim** des fichiers stylisés du site public (issus des mockups
approuvés : `landing/research/survey-thebluestift.jsx`). Imports conservés tels
quels — c'est un dossier de **référence** pour enrichir un nouveau template, pas
du code branché. Les vrais fichiers vivent dans `components/public/` et `app/`.

## Système de design

- **Typographie** : Inter (sans) + Georgia italic (serif, pour le logo et les
  accents éditoriaux). Voir `serif` / `sans` dans `theme.ts`.
- **Fond clair**, encre `#111`, sous-texte `#4a5568`, muted `#9ca3af`.
- **Un accent signature par surface** (toutes définies dans `theme.ts`) :

| Surface   | Accent           | Hex        | Fond accent |
|-----------|------------------|------------|-------------|
| Landing   | teal             | `#1d9e75`  | `#e1f5ee`   |
| Research  | vert académique  | `#2d6a4f`  | `#e8f5ee`   |
| Survey    | ambre            | `#b45309`  | `#fef3c7`   |
| (base)    | violet           | `#8b7cf8`  | `#f0eeff`   |

- **Nav** : sticky, `backdrop-filter: blur(14px)`, fond translucide qui
  s'opacifie au scroll (>20px), pills centrales, CTA encre pleine à droite.
- **Layout** : styles inline partout, sauf les grilles responsive + le
  hide-on-mobile → `public-helpers.css` (à recopier dans le globals du template).

## Fichiers

| Fichier               | Rôle                                                        |
|-----------------------|-------------------------------------------------------------|
| `theme.ts`            | **Tokens** (couleurs par surface, fonts). Le point de départ.|
| `nav.tsx`             | Topbar partagée (pills, section label, CTA auth).           |
| `footer.tsx`          | Footer partagé (grille `pub-footer-grid`).                  |
| `landing.tsx`         | Landing `/` — hero nuage, feature strip, how-it-works, pricing. (copie de `app/page.tsx`) |
| `research-view.tsx`   | `/research` — posts, "À la une", filtres type, newsletter, collaborations. |
| `survey-view.tsx`     | `/survey` — flows prof/élève, done screen, mur "Expression libre". |
| `contact-view.tsx`    | `/contact` — formulaire.                                    |
| `feedback-view.tsx`   | `/feedback` — formulaire type/rating/message.               |
| `format.ts`           | Helpers de formatage partagés.                              |
| `public-helpers.css`  | Classes CSS globales (`pub-grid-*`, `pub-footer-grid`, `pub-hide-sm`). |

## Pour réutiliser

1. Repars de `theme.ts` : garde les tokens couleurs/typo, ou remappe-les sur ta
   palette. Tout le reste consomme ces constantes.
2. `nav.tsx` / `footer.tsx` donnent les patterns de shell (blur, pills, CTA).
3. Recopie `public-helpers.css` dans le globals de ton template (sinon les
   grilles et le responsive cassent).
4. Chaque `*-view.tsx` = la structure section-par-section d'une page à reprendre.
