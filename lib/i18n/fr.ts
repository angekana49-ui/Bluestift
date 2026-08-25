import type { Messages } from "./index";

/** French. Partial by design — any key left out falls back to English. */
export const fr: Partial<Messages> = {
  "nav.chat": "Discussion",
  "nav.rooms": "Salles",
  "nav.tools": "Outils",
  "nav.homework": "Devoirs",
  "nav.kernel": "Mon Kernel",
  "nav.settings": "Réglages",

  "nav.overview": "Vue d’ensemble",
  "nav.classes": "Classes",
  "nav.classesCodes": "Classes et codes",
  "nav.focus": "Focus",
  "nav.prepare": "Préparer",
  "nav.insights": "Analyses",
  "nav.reports": "Rapports",
  "nav.team": "Équipe",
  "nav.billing": "Facturation",

  "menu.addEmail": "Ajouter votre e-mail",
  "menu.addEmail.sub": "Sécurisez votre progression",
  "menu.settings": "Réglages",
  "menu.kernel": "Mon Kernel",
  "menu.upgrade": "Changer de forfait",
  "menu.upgrade.sub": "Débloquer plus de fonctionnalités",
  "menu.signOut": "Se déconnecter",
  "menu.personalRaya": "Votre Raya personnel",
  "menu.personalRaya.sub": "Votre compte · usage personnel",

  "shell.openMenu": "Ouvrir le menu",
  "shell.openPanel": "Ouvrir le panneau",
  "shell.expandSidebar": "Déplier la barre latérale",
  "shell.collapseSidebar": "Replier la barre latérale",
  "shell.expand": "Déplier",
  "shell.collapse": "Replier",

  "settings.language.title": "Langue",
  "settings.language.desc": "Choisissez la langue de l’interface",

  "site.nav.product": "Produit",
  "site.nav.research": "Recherche",
  "site.nav.survey": "Enquête",
  "site.nav.pricing": "Tarifs",
  "site.nav.contact": "Contact",
  "site.nav.privacy": "Confidentialité",
  "site.nav.signIn": "Se connecter",
  "site.nav.freeTrial": "Essai gratuit",
  "site.nav.openApp": "Ouvrir l’app",

  "site.hero.eyebrow": "Tuteur IA · tout niveau, toute matière, partout",
  "site.hero.headline": "Tout le monde a une IA. Personne n’en partage.",
  "site.hero.sub":
    "L’élève apprend avec une IA, le professeur prépare avec une autre, et aucun des deux ne voit celle de l’autre. Raya est celle qu’ils partagent — pour que ce que l’élève comprend vraiment parvienne enfin à qui lui enseigne.",
  "site.hero.ctaPrimary": "Essayer gratuitement",
  "site.hero.ctaSecondary": "Voir comment ça marche",
  "site.hero.chip.free": "Gratuit pour commencer",
  "site.hero.chip.noCard": "Sans carte bancaire",
  "site.hero.chip.solo": "Seul, ou avec votre classe",

  "site.connection.title.a": "Une seule IA,",
  "site.connection.title.em": "des deux côtés",
  "site.connection.title.b": "de la classe.",
  "site.connection.sub":
    "L’un distribue, l’autre ingère, et entre les deux il y a un programme, une note — et désormais deux IA privées. Le devoir maison portait encore un peu de signal sur la façon dont un élève réfléchit. Ce n’est plus le cas. Raya remplace tout cela par un fil partagé.",
  "site.connection.step1.title": "Le professeur dit ce qui compte",
  "site.connection.step1.body":
    "Un axe pour la classe, en une phrase — le prérequis fragile, le chapitre qui ne passe pas. Il parvient à Raya, et chaque élève le voit, clairement identifié.",
  "site.connection.step2.title": "L’élève travaille avec Raya",
  "site.connection.step2.body":
    "Des questions avant les réponses, une étape à la fois, dans sa propre langue. Raya intègre l’axe du professeur quand c’est pertinent — elle guide, elle n’impose jamais.",
  "site.connection.step3.title": "Ce qui est compris remonte",
  "site.connection.step3.body":
    "Concept par concept, avec le prérequis qui bloque réellement — dès le lendemain matin, pas en fin de trimestre.",
  "site.connection.guard.strong": "Comprendre, pas surveiller.",
  "site.connection.guard.body":
    "Le professeur voit quels concepts sont acquis et lesquels restent fragiles — jamais les conversations. Le tuteur reste un endroit où l’on peut avouer qu’on est perdu.",

  "site.features.title.more": "Plus qu’",
  "site.features.title.em1": "un chatbot.",
  "site.features.title.em2": "un tableau de bord.",
  "site.features.sub": "Trois surfaces, un seul profil en dessous. Rien à configurer, rien à tenir à jour.",
  "site.features.kernel.title": "Cognitive Kernel",
  "site.features.kernel.desc":
    "La maîtrise mesurée concept par concept, et non par une note floue — y compris le prérequis qui bloque discrètement tout le reste. C’est ce qui remonte à qui vous enseigne.",
  "site.features.rooms.title": "Salles d’étude",
  "site.features.rooms.desc":
    "Réviser en groupe et en temps réel, avec Raya dans la salle et des documents que tout le monde peut exploiter. Apprendre est social — le tuteur ne devrait pas vous isoler dans un coin.",
  "site.features.challenges.title": "Défis et outils",
  "site.features.challenges.desc":
    "Résumés, cartes mémo et cartes mentales à partir de n’importe quel cours, plus des quiz, des tests et des défis de groupe avec classement en direct. Chaque tentative alimente le même profil.",

  "site.ladder.eyebrow": "Modèle pédagogique",
  "site.ladder.title.a": "Une échelle à gravir, pas un",
  "site.ladder.title.em": "distributeur de réponses.",
  "site.ladder.sub":
    "Raya monte un barreau à la fois et ne commence jamais par le haut. L’objectif n’est pas la bonne réponse dans les trente secondes — c’est un élève capable de refaire seul la semaine suivante.",
  "site.ladder.r1.name": "Amorce",
  "site.ladder.r1.title": "Faire remonter ce qui est déjà là",
  "site.ladder.r1.body":
    "Chaque échange s’ouvre en demandant à l’élève d’essayer ou de se souvenir. Rien n’est donné avant une vraie tentative — même ratée, elle ancre le concept plus fort.",
  "site.ladder.r2.name": "Indice",
  "site.ladder.r2.title": "Réduire l’espace de recherche",
  "site.ladder.r2.body":
    "Un indice partiel, et seulement après une tentative. Il désigne le pas suivant sans le franchir ; le raisonnement reste celui de l’élève.",
  "site.ladder.r3.name": "Assertion",
  "site.ladder.r3.title": "Énoncer la pièce manquante",
  "site.ladder.r3.body":
    "Le fait qui bloque réellement, dit clairement — mais uniquement quand les indices ont échoué. Jamais la solution finie.",
  "site.ladder.r4.name": "Synthèse",
  "site.ladder.r4.title": "Boucler la boucle",
  "site.ladder.r4.body":
    "Un récapitulatif pour clore la séance, ou pour débloquer un élève vraiment coincé. Ce que l’élève reformule est ce qui est évalué.",
  "site.ladder.note":
    "Ce n’est pas une option qu’un établissement active. Raya est construite pour ne pas pouvoir livrer une réponse finie — et son retour vise la méthode, jamais la personne, comme le montrent les travaux de Carol Dweck : « beaucoup butent ici », jamais « tu es doué ».",

  "site.kernel.eyebrow": "Noyau cognitif",
  "site.kernel.title.a": "Quatre dimensions,",
  "site.kernel.title.em": "sept alertes.",
  "site.kernel.sub":
    "Le noyau ne stocke pas une note. Chaque concept porte un vecteur à quatre composantes — et dès qu’un signal se dégrade, il nomme la défaillance, pour que Raya change de tactique dès le tour suivant.",
  "site.kernel.map.title": "Tout tourne autour d’une seule personne.",
  "site.kernel.map.body":
    "Raya, la version pour les classes, les devoirs notés — aucun ne garde sa propre copie de l’élève. Tous écrivent dans le même profil et le relisent avant de répondre, pendant que la conversation est encore en cours.",
  "site.kernel.k.name": "K · Connaissance",
  "site.kernel.k.title": "Ce qui tient sans aide",
  "site.kernel.k.body": "La maîtrise de ce concept précis, brute et ajustée, recalculée après chaque tentative.",
  "site.kernel.v.name": "V · Vitesse",
  "site.kernel.v.title": "À quelle vitesse ça bouge",
  "site.kernel.v.body": "Le rythme d’apprentissage observé : une montée lente ne se lit pas comme un blocage total.",
  "site.kernel.p.name": "P · Persistance",
  "site.kernel.p.title": "Ce qui survit à la semaine",
  "site.kernel.p.body": "La résistance à l’oubli : un concept acquis lundi qui s’effrite discrètement d’ici vendredi est repéré.",
  "site.kernel.m.name": "M · État d’esprit",
  "site.kernel.m.title": "Le rapport à l’erreur",
  "site.kernel.m.body": "L’effort est-il lu comme une information ou comme une preuve d’échec. Suivi par élève, pas par concept.",
  "site.kernel.graph.title": "L’échec était en physique. La cause était en maths.",
  "site.kernel.graph.body":
    "Les concepts sont rangés comme une structure, pas comme un programme. Quand quelque chose casse, le Kernel ne s’arrête donc pas à l’exercice raté : il remonte ce sur quoi ce concept repose, jusqu’à retomber sur du solide. Ce solide est souvent dans une matière où personne n’avait pensé à regarder.",
  "site.kernel.col.alert": "Alerte",
  "site.kernel.col.signal": "Signal détecté",
  "site.kernel.col.response": "Réponse de Raya",
  "site.kernel.a1.name": "Dépendance passive",
  "site.kernel.a1.signal": "Réponses courtes, aucune tentative — l’élève attend qu’on lui donne la solution.",
  "site.kernel.a1.response": "Raya refuse de monter d’un cran et exige une vraie tentative, sur une consigne plus ouverte.",
  "site.kernel.a2.name": "Fausse maîtrise",
  "site.kernel.a2.signal": "Bonnes réponses, mais raisonnement absent ou récité.",
  "site.kernel.a2.response": "Nouveau test immédiat dans un contexte plus difficile avant de valider la maîtrise.",
  "site.kernel.a3.name": "Erreur récurrente",
  "site.kernel.a3.signal": "Un concept déjà validé s’effondre à nouveau des semaines plus tard.",
  "site.kernel.a3.response": "Le concept est décomposé en étapes plus fines et reconstruit à partir du prérequis.",
  "site.kernel.a4.name": "Surcharge cognitive",
  "site.kernel.a4.signal": "Trop d’éléments à tenir en même temps ; la tâche dépasse la mémoire de travail.",
  "site.kernel.a4.response": "La complexité est réduite et un exemple résolu remplace l’exercice.",
  "site.kernel.a5.name": "État d’esprit fixe",
  "site.kernel.a5.signal": "« Je suis nul en maths » — abandonner avant la première tentative.",
  "site.kernel.a5.response": "Un recadrage centré sur la méthode d’abord, avant toute nouvelle tentative.",
  // Les deux dernières portent sur le noyau lui-même, pas sur l’élève.
  "site.kernel.a6.name": "Estimation instable",
  "site.kernel.a6.signal": "Le nombre bouge au lieu de se poser — juste, puis faux, puis juste, sur le même concept.",
  "site.kernel.a6.response": "Raya demande une tentative propre, sans indice, et rien ne se construit sur ce concept tant qu’il ne tient pas en place.",
  "site.kernel.a7.name": "Hors calibration",
  "site.kernel.a7.signal": "Cet élève ne se comporte pas comme la population sur laquelle les paramètres ont été ajustés.",
  "site.kernel.a7.response": "Raya s’appuie sur ce que montre le tour en cours plutôt que sur le nombre stocké, et refuse d’augmenter la difficulté sur cette base.",

  "site.pos.eyebrow": "Où ça se situe",
  "site.pos.title.a": "La couche entre",
  "site.pos.title.em": "les deux que vous payez déjà.",
  "site.pos.sub":
    "Votre LMS enregistre ce qui a été fait, les jours où un travail est dû. Un tuteur aide sur l’instant, puis l’instant est passé. Ni l’un ni l’autre ne garde ce qu’un élève a réellement compris — donc un mardi ordinaire, sans devoir à rendre et sans session en cours, il n’y a rien à lire.",
  "site.pos.note.model":
    "Tout dans cette catégorie tourne sur des modèles frontier achetés. Nous aussi, chez les mêmes fournisseurs. Le modèle est le socle — ce n’est pas entre eux qu’on choisit. C’est entre les enregistrements posés au-dessus.",
  "site.pos.note.privacy":
    "Et cet enregistrement est étroit, volontairement. Un professeur voit que les dérivées sont fragiles. Il ne voit pas ce qui a été dit — soit moins que ce que son carnet de notes actuel sait déjà du même élève.",

  "site.roadmap.eyebrow": "Feuille de route",
  "site.roadmap.title.a": "Où en est vraiment",
  "site.roadmap.title.em": "le produit.",
  "site.roadmap.sub":
    "Ce qui tourne, ce qui se construit, ce qui vient. Rien ci-dessus n’est la capture d’une fonctionnalité qui n’existe pas encore.",
  "site.roadmap.status.shipped": "Livré",
  "site.roadmap.status.progress": "En cours",
  "site.roadmap.status.coming": "À venir",
  "site.roadmap.i1.title": "Séances socratiques et noyau cognitif",
  "site.roadmap.i1.body":
    "L’échelle Amorce → Indice → Assertion → Synthèse, le vecteur par concept et les sept alertes, actifs à chaque séance.",
  "site.roadmap.i2.title": "Espace établissement",
  "site.roadmap.i2.body":
    "Inscription autonome, rôles admin et professeur, classes, codes d’invitation et rattachement d’équipe, analyses par classe et par matière.",
  "site.roadmap.i3.title": "Salles d’étude, défis et outils",
  "site.roadmap.i3.body":
    "Salles de groupe en direct avec documents partagés, défis collectifs avec classement, et quiz, résumés, cartes mémo et cartes mentales générés depuis un cours.",
  "site.roadmap.i4.title": "Paiements et quotas",
  "site.roadmap.i4.body":
    "Carte, mobile money et PayPal via un agrégateur unique, plus l’application des limites d’usage. Le parcours complet tourne en bac à sable ; l’encaissement réel n’est pas encore activé.",
  "site.roadmap.i5.title": "Courbe de trajectoire par concept",
  "site.roadmap.i5.body":
    "Une vraie projection calculée côté noyau, en remplacement de l’estimation guidée par le modèle affichée aujourd’hui sur le profil.",
  "site.roadmap.i6.title": "Synchronisation LMS",
  "site.roadmap.i6.body": "Importer classes et listes d’élèves depuis l’environnement déjà en place, au lieu de les ressaisir.",

  "site.faq.title.a": "Questions",
  "site.faq.title.em": "fréquentes.",
  "site.faq.model.q": "N’est-ce pas ChatGPT avec un prompt système ?",
  "site.faq.model.a":
    "Le modèle en dessous est un modèle de pointe acheté. Le leur aussi — c’est le plancher, pas la différence. Ce qui est posé dessus est un relevé : chaque tentative est évaluée concept par concept dans un profil unique, que le tuteur de l’élève et son professeur lisent tous les deux. Un prompt n’est pas un relevé, et il disparaît à la fermeture de l’onglet.",
  "site.faq.lms.q": "Nous payons déjà un LMS. Pourquoi un outil de plus ?",
  "site.faq.lms.a":
    "Ce n’en est pas un et ça ne cherche pas à l’être. Votre LMS enregistre ce qui a été donné et ce qui a été rendu ; ceci enregistre ce qui a été compris, une colonne qu’aucun carnet de notes n’a jamais eue. Les deux se connectent au lieu de se concurrencer — Google Classroom se relie, et vos classes et vos listes viennent d’où elles vivent déjà.",
  "site.faq.sees.q": "Que voit réellement un professeur ?",
  "site.faq.sees.a":
    "Quels concepts un élève a solidement acquis, lesquels restent fragiles, et le prérequis qui bloque le reste — jamais ses conversations avec Raya. Un élève qui se sent lu cesse d’avouer ce qu’il ne comprend pas.",
  "site.faq.training.q": "Le travail de nos élèves sert-il à entraîner des modèles ?",
  "site.faq.training.a":
    "Non, sauf si un adulte l’a activé pour son propre compte. L’âge est vérifié avant même que la case de consentement soit lue : le compte d’un mineur ne peut pas être enrôlé, même en la cochant. Et si cette vérification n’aboutit pas, la réponse est non.",
  "site.faq.curriculum.q": "Faut-il importer notre programme ?",
  "site.faq.curriculum.a":
    "Non. Les concepts sont extraits des documents que vous déposez et rattachés au graphe existant. Un seul cours suffit pour démarrer.",
  "site.faq.offline.q": "Est-ce que ça marche avec une connexion faible ?",
  "site.faq.offline.a":
    "Oui. L’interface est légère et elle est mise en cache sur l’appareil dès la première visite : elle s’ouvre sans attendre le réseau. Le profil reste côté serveur, donc rien de lourd n’est recalculé sur un téléphone d’entrée de gamme.",

  "site.finalCta.title.a": "Essayez Raya avec",
  "site.finalCta.title.em": "une classe.",
  "site.finalCta.sub": "Gratuit pour commencer, sans carte. L’élève démarre ; le noyau fait le reste.",
  "site.finalCta.ctaPrimary": "Commencer gratuitement",
  "site.finalCta.ctaSecondary": "Parler à l’équipe",
  "site.finalCta.note": "Seul, ou avec votre classe. Rien à installer.",

  "site.pricing.title.a": "Des tarifs qui",
  "site.pricing.title.em": "restent simples.",
  "site.pricing.sub": "Trois portes d’entrée — un élève seul, un établissement entier, ou un déploiement sur mesure. Choisissez la vôtre.",
  "site.pricing.solo.title": "Solo",
  "site.pricing.solo.l1": "Apprendre seul, Raya à vos côtés",
  "site.pricing.solo.l2": "La maîtrise suivie concept par concept",
  "site.pricing.solo.l3": "Salles d’étude et défis de groupe, en direct",
  "site.pricing.solo.l4": "Quiz, résumés, cartes mémo, cartes mentales",
  "site.pricing.solo.cta": "Voir les forfaits solo",
  "site.pricing.schools.l1": "Une classe, un niveau, ou tout l’établissement",
  "site.pricing.schools.l2": "Tableaux de bord profs + analyses par classe",
  "site.pricing.schools.l3": "Synchronisation LMS + Raya for Schools",
  "site.pricing.schools.l4": "Facturé par élève inscrit",
  "site.pricing.schools.region":
    "Les établissements des quatorze pays de la zone franc CFA sont facturés en monnaie locale, à un tarif local.",
  "site.pricing.schools.cta": "Voir les forfaits établissement",
  "site.pricing.custom.title": "Sur mesure",
  "site.pricing.custom.l1": "Tout le moteur, réglé pour votre établissement",
  "site.pricing.custom.l2": "Performance maximale",
  "site.pricing.custom.l3": "Fonctionnalités avancées",
  "site.pricing.custom.l4": "Vos données, vos règles, votre propre IA",
  "site.pricing.custom.meta": "Pour les institutions qui veulent tout",
  "site.pricing.custom.cta": "Découvrir le sur-mesure",
  "site.pricing.compare": "Comparer tous les forfaits →",

  "site.footer.tagline": "BlueStift construit Raya — le tuteur IA que professeurs et élèves partagent enfin.",
  "site.footer.col.product": "PRODUIT",
  "site.footer.col.project": "PROJET",
  "site.footer.col.resources": "RESSOURCES",
  "site.footer.col.legal": "MENTIONS LÉGALES",
  "site.footer.link.studyRooms": "Salles d’étude",
  "site.footer.link.toolsStudio": "Studio d’outils",
  "site.footer.link.contribute": "Contribuer",
  "site.footer.link.progress": "Avancement",
  "site.footer.link.terms": "Conditions",
  "site.footer.link.dpa": "DPA écoles",
  "site.footer.link.subprocessors": "Sous-traitants",
  "site.footer.link.feedback": "Retours",
  "site.footer.rights": "Tous droits réservés.",

  // ── Résilience réseau ─────────────────────────────────────────────
  "net.offline": "Vous êtes hors ligne. Raya se reconnectera automatiquement.",
  "net.degraded": "Connexion instable — certaines actions peuvent prendre un moment.",
  "net.reconnected": "De nouveau en ligne.",
  "net.retry": "Réessayer",
  "net.roomLiveDown": "Mises à jour en direct suspendues — reconnexion. L'envoi fonctionne toujours.",
  "chat.sendFailed": "Non envoyé — votre message est conservé.",
  "chat.retry": "Réessayer",
};
