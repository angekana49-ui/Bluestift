# Domaines : trois origines, pas sept

Décision d'architecture, pas encore appliquée. Ce document dit **ce qu'on fait,
ce que ça casse, et dans quel ordre le faire** — le découpage a un coût précis
et localisable, et il vaut mieux l'avoir écrit avant de bouger un DNS.

## La décision

| Origine | Ce qu'elle sert |
|---|---|
| `thebluestift.com` | le site public **et** `/research`, `/survey`, les pages légales, `/pricing`, `/contact`, `/s/<token>` |
| `raya.thebluestift.com` | le tuteur : `/chat`, `/rooms`, `/homework`, `/tools`, `/profile` |
| `schools.thebluestift.com` | l'école : `/school`, `/school/enter` |

**Un seul dépôt, un seul déploiement, trois domaines pointés dessus.** Le routage
se fait par `Host`, pas par build : les trois origines servent le même bundle, ce
qui évite trois pipelines à maintenir et trois versions qui divergent.

`/ops/billing` n'apparaît pas dans ce tableau : c'est une console founder-only,
non liée depuis aucune navigation, qui renvoie un 404 à toute autre personne
(`lib/ops.ts`). Elle reste servie par les trois origines sans que ça change rien.

Pas de `www.` sur un sous-domaine — `www.raya.thebluestift.com` est inhabituel et
double la surface certificat/redirection pour rien. Une seule décision à prendre
à la racine : apex ou `www`, l'autre redirige en 308.

### Pourquoi pas sept

`research`, `survey` et `docs` **partagent le chrome du site** (`Navbar`,
`Footer`, `SitePage` — voir `components/site/`). Les isoler sur leur propre
origine coûterait :

- l'autorité SEO, qui se répartirait sur sept domaines au lieu de se concentrer
  sur un ;
- un cookie de session lisible par **tous** les sous-domaines (voir plus bas) —
  acceptable pour deux produits first-party, mauvais le jour où `docs.` part chez
  un tiers ;
- sept fois le problème d'état décrit ci-dessous, pour des pages qui ne sont pas
  des applications.

Les sous-domaines sont réservés aux **produits installables**. C'est aussi ce qui
justifie leur existence : un produit a une identité PWA, un site n'en a pas.

---

## Ce que le découpage casse

C'est le cœur du sujet. Les cookies traversent, `localStorage` et `IndexedDB`
**jamais** — aucune option, aucun contournement propre. Inventaire de tout l'état
navigateur du projet :

| Clé | Support actuel | Traverse ? | À faire |
|---|---|---|---|
| cookies Supabase (session) | cookie host-only | **non** | poser `domain: ".thebluestift.com"` |
| `bluestift-dark` | `localStorage` | **non** | passer en cookie |
| `bluestift-locale` | `localStorage` | **non** | passer en cookie |
| `bluestift-locale-asked` | `localStorage` | **non** | passer en cookie |
| `bs_analytics_consent` | `localStorage` **+** cookie | à moitié | ajouter `domain`, faire lire le cookie |
| `bluestift-outbox` | `localStorage` | non | **laisser** — par produit, c'est correct |
| `bluestift-blobs` | `IndexedDB` | non | **laisser** — idem |

Sans ces correctifs, un aller-retour site → Raya → école réinitialise le thème et
la langue à chaque saut, et la barre de langue — rendue non bloquante justement
pour ne pas gêner — réapparaît à chaque origine.

Le cas du consentement mérite d'être lu de près, parce qu'il est déjà à moitié
bon et complètement inopérant : `setConsent()` écrit **et** le `localStorage`
**et** un cookie (`lib/analytics/consent.ts`), mais `getConsent()` ne lit que le
`localStorage`. Le bandeau réapparaîtrait donc sur chaque origine alors que la
décision de l'utilisateur est déjà là, dans le cookie, à côté. Deux lignes.

L'outbox et le blob-store restent volontairement par origine : ce sont des
données d'un produit en cours d'usage, pas des préférences. Une réponse mise en
file dans Raya n'a aucune raison d'être visible depuis l'école.

### La contrepartie du cookie partagé

`domain=.thebluestift.com` rend le cookie de session lisible par **toute**
origine sous ce domaine, présente et future. C'est le prix du parcours fluide, et
il est acceptable tant que chaque sous-domaine est à nous. La règle qui en
découle : **ne jamais pointer un sous-domaine de `thebluestift.com` vers un
service tiers** (hébergeur de docs, outil de statut, formulaire externe). Un tiers
placé là lirait la session de tous nos utilisateurs.

---

## Le code à toucher

| Fichier | Changement |
|---|---|
| `lib/supabase/server.ts` | `cookieOptions: { domain }` sur `createServerClient` |
| `lib/supabase/client.ts` | idem sur `createBrowserClient` |
| `components/site/useThemeMode.ts` | `bluestift-dark` : cookie au lieu de `localStorage` |
| `components/ui/theme.tsx` | idem (même clé, deux hooks — ils doivent bouger ensemble) |
| `lib/use-locale.ts` | `bluestift-locale` en cookie |
| `components/site/LanguagePrompt.tsx` | `bluestift-locale-asked` en cookie (seul lecteur de la clé) |
| `lib/analytics/consent.ts` | `domain` sur le cookie, et `getConsent()` lit le cookie |
| `lib/email.ts` | `siteUrl()` doit devenir **par surface** — voir ci-dessous |
| `next.config.ts` | redirections 308 `/chat` et `/school` de l'apex vers les sous-domaines (le CSP n'a pas à bouger — voir plus bas) |

Le domaine doit venir d'une variable (`NEXT_PUBLIC_COOKIE_DOMAIN`), pas d'une
constante : en local et en preview Vercel il n'y a pas de domaine parent commun,
et un `domain` posé sur `localhost` fait rejeter le cookie silencieusement. Non
défini ⇒ pas d'attribut ⇒ comportement actuel.

### `siteUrl()` est le piège non évident

`lib/email.ts` expose un `siteUrl()` qui lit **une seule** variable
`NEXT_PUBLIC_SITE_URL`, et il sert à construire :

- les liens des e-mails école (`/school`) — `app/api/school/{billing,join-team,requests}` ;
- les liens de partage `/s/<token>` — `app/api/share/route.ts` ;
- les URLs de retour de paiement — `app/api/billing/checkout/route.ts`.

Ces trois-là n'atterrissent plus sur la même origine après le découpage. Un
e-mail « Review requests » doit ouvrir `schools.`, un lien de partage doit ouvrir
l'apex. `siteUrl()` doit donc prendre une surface en paramètre, comme
`lib/theme-color.ts` a dû le faire pour les couleurs de chrome — même erreur,
même correctif : une valeur unique pour ce qui est en réalité par surface.

### Ce qui marche déjà et n'a rien à faire

- `app/auth/callback` et `app/auth/confirm` construisent leurs redirections
  depuis `new URL(request.url).origin` : elles suivent l'origine appelante toutes
  seules.
- `emailRedirectTo` côté client utilise `window.location.origin` — pareil.
- L'OAuth Google Classroom dérive son `redirect_uri` de l'origine de la requête
  (`app/api/school/lms/google/start`).

En revanche il faut **déclarer** les nouvelles origines côté fournisseurs :

- Supabase → Authentication → URL Configuration : `Site URL` + allowlist
  `https://*.thebluestift.com/**` (cf. `docs/auth-email-setup.md`) ;
- Google Cloud → Authorized redirect URIs :
  `https://schools.thebluestift.com/api/school/lms/google/callback`
  (cf. `docs/lms-google-setup.md`).

### CSP

`connect-src 'self'` suffit tant que les pages n'appellent que des chemins
relatifs — c'est le cas aujourd'hui et **c'est la règle à tenir** : chaque origine
sert l'application entière, donc un `fetch("/api/…")` reste same-origin. Le jour
où une page de `raya.` appellerait `schools.` en absolu, il faudrait ajouter
l'origine à `connect-src` **et** gérer le CORS. À éviter.

---

## Ce que ça simplifie

Le découpage **résout** un compromis déjà documenté plutôt que d'en créer un.

`lib/manifest.ts` explique que `scope` ne peut être qu'un préfixe d'URL et que
les produits n'en partagent aucun — `/chat`, `/school`, `/rooms`, `/tools` n'ont
que `"/"` en commun. Avec une origine par produit, chacun se scope
naturellement : `scope: "/"` sur `raya.` *veut dire* Raya.

Dans la foulée, `app/raya-manifest/route.ts` n'a plus de raison d'être. Il existe
uniquement parce que la convention de fichier `manifest.ts` de Next est
racine-only et qu'il fallait deux manifestes sur une seule origine. Deux origines,
deux racines, deux `manifest.ts`. Idem pour la surcharge de métadonnées de
`app/chat/layout.tsx`.

**Attention à l'identité d'une PWA.** Un navigateur identifie une application
installée par `(origine, id)`. Déplacer Raya de `thebluestift.com/chat` vers
`raya.thebluestift.com` crée une **nouvelle** application : une copie déjà
installée ne suivrait pas, elle resterait pointée sur l'ancienne origine. Le coût
est nul aujourd'hui — les manifestes ne sont pas encore déployés, donc il n'existe
aucune installation à casser. C'est précisément la fenêtre pour le faire.

---

## Ordre des opérations

Les étapes 1 et 2 ne sont visibles de personne. À partir de la 3, chaque étape
remplace quelque chose qui sert déjà du public — d'où l'ordre.

1. Rendre le code origine-agnostique (le tableau plus haut), **avec la variable
   de domaine non définie**. Aucun changement de comportement : tout reste
   déployable sur l'origine unique actuelle, et rien de ce qui suit n'est engagé.
2. Créer le projet Vercel sur ce dépôt, écrire les redirections `/chat` et
   `/school` de l'apex vers les sous-domaines dans `next.config.ts`, et vérifier
   une preview complète. Les redirections sont inertes tant que le projet ne sert
   aucun domaine.
3. Pointer `schools.` sur ce projet. C'est le sous-domaine le moins engageant :
   il n'existe pas encore, donc rien n'est remplacé. Définir
   `NEXT_PUBLIC_COOKIE_DOMAIN` et déclarer l'origine chez Supabase et Google.
4. Pointer `raya.` sur ce projet — cette étape **remplace** `angekana49-ui/raya-web`,
   qui le sert aujourd'hui. À partir de là les deux bases de code Raya ne
   coexistent plus ; c'est la décision à prendre consciemment, pas un effet de
   bord du DNS.
5. Basculer l'apex depuis l'ancien projet `bluestift-site` en dernier. C'est
   l'étape la plus visible et la plus difficile à annuler, et c'est elle qui rend
   actives les redirections écrites à l'étape 2. Les garder indéfiniment : elles
   rattrapent tous les liens `/chat` et `/school` déjà partagés.

`thebluestift.com` sert aujourd'hui la V1, que le projet ne montre ni ne vend
plus. Voir `docs/project-status.md` sur son statut.
