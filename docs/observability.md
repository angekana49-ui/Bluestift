# Surveillance des erreurs

La CI dit qu'une modification compile, passe les types, le lint et les tests.
Elle ne dit rien de ce qui casse une fois en production. Ce document décrit
l'autre moitié : **où va une erreur serveur, et comment on l'apprend.**

Tout passe par un seul module, `lib/observability/report.ts`.

## Deux sorties, dans cet ordre

**1. Toujours** — une ligne JSON sur `stderr`, préfixée `[bluestift.error]`.
Une seule ligne par échec, donc une seule entrée de log, donc une seule chose
sur laquelle un drain de logs peut matcher. Cette sortie n'a **aucune
configuration et aucune dépendance** : c'est celle qui fonctionne encore quand
la base de données est tombée — ou quand c'est le webhook lui-même qui est
tombé.

**2. Optionnelle** — un `POST` d'une **copie allégée** de l'enregistrement vers
`ERROR_WEBHOOK_URL` (Slack, Discord, un tunnel Sentry, ce que tu veux).
Variable non définie = pas d'appel sortant, et rien d'autre ne change. La
surveillance ne doit pas dépendre d'une installation qui n'a pas encore eu lieu.

Allégée, parce que ce point de terminaison est un tiers : les `tags` sont
retirés et tout UUID (id utilisateur, id de paiement) devient `<id>` dans le
message et la pile (`webhookCopy`). Aucun identifiant ne sort, donc le
destinataire ne traite pas de donnée personnelle et n'a pas à figurer sur
`/subprocessors`. La ligne de log, elle, garde tout — Vercel y est déjà.
Pour retrouver l'enregistrement complet depuis une alerte : `fingerprint` + `ts`.

## L'enregistrement

| Champ | Ce que c'est |
|---|---|
| `ts`, `severity` | horodatage ; `error` (ça réveille quelqu'un) ou `warning` (normal à l'unité, jamais normal en masse) |
| `scope` | la zone, en pointillé : `request`, `billing.webhook`, `billing.activation`, `billing.receipt` |
| `name`, `message` | l'erreur, nettoyée (voir plus bas) |
| `fingerprint` | **clé de regroupement** : le message dont on a normalisé les ids, les hex et les nombres. Deux occurrences du même échec ont la même empreinte, même avec des ids différents |
| `env`, `runtime`, `release` | `VERCEL_ENV`, `node`/`edge`, les 7 premiers caractères du commit |
| `digest`, `stack` | le digest React quand ça vient d'un rendu ; la pile tronquée |
| `request` | `method`, `type` (`render`/`route`/`action`/`proxy`) et le **motif** de route |
| `tags` | les faits non secrets qui rendent l'enregistrement actionnable (`paymentId`, `provider`…) |
| `suppressed` | le nombre d'occurrences que cet envoi représente (voir *anti-inondation*) |

## Ce qui est capté

**Automatiquement.** `instrumentation.ts` exporte `onRequestError` : Next.js y
fait passer **toute** erreur serveur qu'il attrape — rendu de Server Component,
Route Handler, Server Action, proxy. Aucune route n'a à y penser.

**Explicitement.** Une erreur qu'on attrape nous-mêmes n'atteint jamais ce hook
— c'est justement le but de l'attraper. Les endroits où un échec était
silencieux et ne l'est plus :

| Endroit | Ce qui se passait sans ça |
|---|---|
| `payments-data.ts` → activation | le client a payé, l'abonnement n'a pas été activé, la réclamation est repassée en `pending`. Si le PSP arrête de réessayer, il n'en restait **aucune trace** |
| `payments-data.ts` → reçu | payé, activé, aucun e-mail de confirmation — et personne ne le savait |
| `webhook/[provider]` → parse rejeté | un secret HMAC tourné fait atterrir **tous** les vrais paiements ici, et le symptôme est le silence |
| `webhook/[provider]` → réconciliation | un statut terminal qu'on n'a pas su rattacher à un paiement en attente |

Les trois derniers portent le `providerRef` : c'est ce qui rend le cas
réparable à la main.

## Ce qui est protégé

- **Rédaction.** Un message d'erreur est écrit par qui l'a levé, donc il peut
  contenir tout ce qui traînait dans la portée. Adresses e-mail, JWT, `Bearer
  …`, `secret=…` et chaînes opaques longues sont masqués avant de sortir du
  processus. Les **UUID sont gardés volontairement** : un id de paiement est ce
  qui rend un enregistrement exploitable, et seul il n'identifie personne en
  dehors de notre base.
- **Chemins.** On rapporte le **motif** de route (`/s/[token]`), jamais le
  chemin demandé : `/s/9tK…` est une capacité vivante. La query string est
  supprimée pour la même raison (`?code=` sur le callback auth est un
  identifiant à usage unique).
- **Anti-inondation.** Un échec dans un chemin chaud se déclenche à chaque
  requête. Le log reste complet ; le webhook est plafonné à 5 envois par
  empreinte et par minute, et l'envoi suivant dit combien il représente
  (`suppressed`). Le compteur est par instance — le but est de borner une
  boucle folle, pas de compter juste.
- **Ça ne lève jamais.** Un rapporteur qui casse la requête qu'il rapporte est
  pire que pas de rapporteur. Le webhook est borné à 2,5 s.

## Pour être réellement prévenu

Le code émet ; il ne réveille personne tout seul. Il reste **une** chose à
faire, et elle est en dehors du dépôt :

1. **Le minimum, sans rien installer** — dans Vercel, *Project → Logs*, une
   requête sauvegardée sur `[bluestift.error]`, et une alerte sur les
   `severity:"error"` de scope `billing.*`.
2. **Mieux** — définir `ERROR_WEBHOOK_URL` sur un webhook entrant Slack ou
   Discord. Chaque enregistrement arrive en JSON, sans tags ni ids (voir plus
   haut) ; le détail est dans les logs Vercel, à la même empreinte.
3. **Si un jour ça grossit** — le même `ERROR_WEBHOOK_URL` peut pointer sur un
   tunnel Sentry. La couture est déjà là : rien d'autre dans le code ne bouge.

## Lire un symptôme

Ce qui précède dit où l'erreur arrive. Ceci dit comment ne pas la lire de
travers. Les cas ci-dessous ont réellement coûté du temps ; ils partagent une
forme — **le message accuse la couche où il s'affiche, pas celle qui a fauté.**

### `captcha_failed` puis `timeout-or-duplicate` (2026-09-11)

Deux messages, deux causes distinctes, découvertes dans cet ordre. La deuxième
n'était atteignable qu'une fois la première corrigée, ce qui donne l'illusion
d'une régression alors que c'est un progrès.

| Message | Qui l'écrit | Ce que ça veut dire |
|---|---|---|
| `captcha_failed` | **nous** (`/api/auth/anon`, `/api/auth/recover`) | notre `verifyTurnstile` a renvoyé faux : secret absent, ou secret faux |
| `invalid-input-secret` | Cloudflare | le secret ne correspond pas au widget |
| `timeout-or-duplicate` | Cloudflare | **le token a déjà été échangé**, ou il a expiré — jamais un problème de clé |

Ce qui s'est passé : une clé en double dans `.env.local` (même nom, deux
valeurs — dotenv garde la **dernière**, pas celle qu'on lit en haut du fichier)
a fait recopier la mauvaise valeur jusque dans Vercel et Supabase → premier
message. Une fois le secret juste, `verifyTurnstile` a cessé d'échouer tôt et
s'est mis à **consommer** le token avant de le passer à Supabase, qui le
consommait à son tour → second message. Voir `docs/auth-email-setup.md` §4 pour
la règle du redeemer unique.

Les deux leçons, réutilisables :

- **Un secret manquant et un secret faux ne se lisent pas pareil.** Absent,
  `verifyTurnstile` sort avant d'appeler Cloudflare : le token survit et seule
  notre vérification échoue. Faux, l'appel part. Un bug situé *après* la
  vérification reste donc invisible tant que la configuration est cassée — et
  apparaît le jour où on la répare. Réparer une configuration peut révéler un
  bug ; ce n'est pas la réparation qui l'a créé.
- **Un fichier d'environnement peut mentir sans se contredire.** Les doublons
  ne lèvent aucune erreur, et le fichier reste plausible à la lecture. Ni
  `.env.local` ni `.env.example` n'étant versionnés, rien en CI ne peut le
  voir : c'est une vérification à faire à la main quand une clé « pourtant
  bonne » ne passe pas.

## Ce que ça ne couvre pas

- **Les erreurs client.** Un composant qui plante dans le navigateur n'atteint
  pas le serveur. Il faudrait une frontière `global-error.tsx` qui poste vers
  une route dédiée — pas fait.
- **La disponibilité.** Un serveur mort n'émet rien. C'est le travail d'un
  moniteur externe (uptime check), pas du dépôt.
- **Les échecs métier encore silencieux.** Les `console.warn` de sous-comptage
  d'usage (`prepare`, `reports`, `simulations`, `extract`) sont volontairement
  restés des warnings de log : ils faussent un compteur, ils ne cassent pas un
  paiement. À reprendre si les quotas deviennent facturés.
