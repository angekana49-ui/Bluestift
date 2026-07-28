/**
 * English — the CANONICAL message set. Every other locale is typed against this
 * object, so `en` defines both the key list and the fallback text.
 *
 * Conventions:
 *  - Keys are dotted namespaces: `nav.*`, `menu.*`, `shell.*`, `settings.*`.
 *  - **Brand names are never translated** and never live in a message value on
 *    their own: "Bluestift", "Raya" and "Schools" stay literal in every locale
 *    (see the brand-names rule). Where a sentence contains one, it stays spelled
 *    exactly that way in the translation too.
 *  - Values are plain strings. Anything needing markup (a wordmark, a link) is
 *    composed in JSX around a translated fragment, not stored here.
 */
export const en = {
  // ── Raya student nav ──────────────────────────────────────────────
  "nav.chat": "Chat",
  "nav.rooms": "Rooms",
  "nav.tools": "Tools",
  "nav.homework": "Homework",
  "nav.kernel": "My Kernel",
  "nav.settings": "Settings",

  // ── Schools (admin + teacher) nav ─────────────────────────────────
  "nav.overview": "Overview",
  "nav.classes": "Classes",
  "nav.classesCodes": "Classes & codes",
  "nav.focus": "Focus",
  "nav.prepare": "Prepare",
  "nav.insights": "Insights",
  "nav.reports": "Reports",
  "nav.team": "Team",
  "nav.billing": "Billing",

  // ── Profile chip menu ─────────────────────────────────────────────
  "menu.addEmail": "Add your email",
  "menu.addEmail.sub": "Secure your progress",
  "menu.settings": "Settings",
  "menu.kernel": "My Kernel",
  "menu.upgrade": "Upgrade plan",
  "menu.upgrade.sub": "Unlock more features",
  "menu.signOut": "Sign out",
  "menu.personalRaya": "Your personal Raya",
  "menu.personalRaya.sub": "Your own account · personal use",

  // ── Shell chrome (mostly accessible names on icon buttons) ────────
  "shell.openMenu": "Open menu",
  "shell.openPanel": "Open panel",
  "shell.expandSidebar": "Expand sidebar",
  "shell.collapseSidebar": "Collapse sidebar",
  "shell.expand": "Expand",
  "shell.collapse": "Collapse",

  // ── Settings cards ────────────────────────────────────────────────
  "settings.language.title": "Language",
  "settings.language.desc": "Choose the language of the app interface",

  // ── Public site: nav ──────────────────────────────────────────────
  // Headlines carry an italic-serif flourish on part of the line, so they're
  // split into fragments (`.a` / `.em` / `.b`) rather than storing markup.
  "site.nav.product": "Product",
  "site.nav.research": "Research",
  "site.nav.survey": "Survey",
  "site.nav.pricing": "Pricing",
  "site.nav.contact": "Contact",
  "site.nav.privacy": "Privacy",
  "site.nav.signIn": "Sign in",
  "site.nav.freeTrial": "Free trial",
  "site.nav.openApp": "Open app",
  "site.nav.tagline": "The AI tutor students and teachers share",

  // ── Public site: hero ─────────────────────────────────────────────
  "site.hero.eyebrow": "AI tutor · any level, any subject, anywhere",
  "site.hero.headline": "Everyone has an AI. Nobody shares one.",
  "site.hero.sub":
    "Students learn with one AI, teachers prepare with another, and neither side sees the other. Raya is the one they share — so what a student actually understands finally reaches the person teaching them.",
  "site.hero.ctaPrimary": "Try it free",
  "site.hero.ctaSecondary": "See how it works",
  "site.hero.chip.free": "Free to start",
  "site.hero.chip.noCard": "No card required",
  "site.hero.chip.solo": "Solo, or with your class",

  // ── Public site: the connection band (the thesis) ─────────────────
  "site.connection.title.a": "One AI,",
  "site.connection.title.em": "both sides",
  "site.connection.title.b": "of the classroom.",
  "site.connection.sub":
    "One distributes, the other ingests, and between them sits a syllabus, a grade — and now two private AIs. Homework used to carry a little signal about how a student thinks. It doesn’t anymore. Raya replaces all of that with one shared thread.",
  "site.connection.step1.title": "The teacher says what matters",
  "site.connection.step1.body":
    "A focus for the class, in one sentence — the shaky prerequisite, the chapter that isn’t landing. It reaches Raya, and every student sees it, labelled.",
  "site.connection.step2.title": "The student works with Raya",
  "site.connection.step2.body":
    "Questions before answers, one step at a time, in their own language. Raya weaves the teacher’s focus in when it fits — it guides, it never dictates.",
  "site.connection.step3.title": "What was understood travels back",
  "site.connection.step3.body":
    "Concept by concept, with the prerequisite that’s actually blocking things — the morning after, not at the end of term.",
  "site.connection.guard.strong": "Understanding, not surveillance.",
  "site.connection.guard.body":
    "A teacher sees which concepts a student has secured and which are still shaky — never their conversations. The tutor stays a place where it’s safe to admit you’re lost.",

  // ── Public site: features ─────────────────────────────────────────
  "site.features.title.more": "More than",
  "site.features.title.em1": "a chatbot.",
  "site.features.title.em2": "a dashboard.",
  "site.features.sub": "Three surfaces, one profile underneath. Nothing to configure, nothing to keep up to date.",
  "site.features.kernel.title": "Cognitive Kernel",
  "site.features.kernel.desc":
    "Mastery measured concept by concept, not as one blurry grade — including the prerequisite quietly blocking the rest. It’s what travels back to whoever is teaching you.",
  "site.features.rooms.title": "Study Rooms",
  "site.features.rooms.desc":
    "Revise as a group in real time, with Raya in the room and documents everyone can work from. Learning is social — the tutor shouldn’t put you alone in a corner.",
  "site.features.challenges.title": "Challenges & Tools",
  "site.features.challenges.desc":
    "Quizzes, tests and group challenges with live standings, plus summaries, flashcards and mind maps from any lesson. Every attempt feeds the same profile.",

  // ── Public site: differentiators ──────────────────────────────────
  "site.diff.title.a": "Why not the",
  "site.diff.title.em": "others?",
  "site.diff.sub": "The difference isn’t the AI. Everyone has that now. It’s what crosses between you.",
  "site.diff.general.label": "General assistants",
  "site.diff.general.verdict": "Brilliant with the student. Invisible to their teacher.",
  "site.diff.teacher.label": "Teacher AI toolkits",
  "site.diff.teacher.verdict": "Brilliant for the teacher. Invisible to their students.",
  "site.diff.fixed.label": "Fixed adaptive platforms",
  "site.diff.fixed.verdict": "One rigid path, on somebody else’s curriculum.",
  "site.diff.raya.verdict": "One AI both sides share. What’s understood travels.",

  // ── Public site: pricing gateway ──────────────────────────────────
  "site.pricing.title.a": "Pricing that",
  "site.pricing.title.em": "stays simple.",
  "site.pricing.sub": "Three ways in — a solo student, a whole school, or a bespoke deployment. Pick your lane.",
  "site.pricing.solo.title": "Solo",
  "site.pricing.solo.l1": "Solo learning, Raya in your corner",
  "site.pricing.solo.l2": "Mastery tracked concept by concept",
  "site.pricing.solo.l3": "Study Rooms and group challenges, live",
  "site.pricing.solo.l4": "Quizzes, summaries, flashcards, mind maps",
  "site.pricing.solo.cta": "See solo plans",
  "site.pricing.schools.badge": "RECOMMENDED",
  "site.pricing.schools.l1": "A class, a grade, or a whole school",
  "site.pricing.schools.l2": "Teacher dashboards + per-class insights",
  "site.pricing.schools.l3": "LMS sync + Raya for Schools",
  "site.pricing.schools.l4": "Billed per enrolled student",
  "site.pricing.schools.cta": "See school plans",
  "site.pricing.custom.title": "Custom",
  "site.pricing.custom.l1": "The full engine, tuned to your school",
  "site.pricing.custom.l2": "Highest performance",
  "site.pricing.custom.l3": "Advanced features",
  "site.pricing.custom.l4": "Your data, your rules, your own AI",
  "site.pricing.custom.meta": "For institutions that want it all",
  "site.pricing.custom.cta": "Explore Custom",
  "site.pricing.compare": "Compare all plans →",

  // ── Public site: footer ───────────────────────────────────────────
  "site.footer.tagline": "BlueStift builds Raya — the AI tutor students and teachers finally share.",
  "site.footer.col.product": "PRODUCT",
  "site.footer.col.project": "PROJECT",
  "site.footer.col.resources": "RESOURCES",
  "site.footer.link.studyRooms": "Study Rooms",
  "site.footer.link.toolsStudio": "Tools Studio",
  "site.footer.link.contribute": "Contribute",
  "site.footer.link.feedback": "Feedback",
  "site.footer.rights": "All rights reserved.",

  // ── Network resilience (degraded banner, retry affordances) ───────
  "net.offline": "You're offline. Raya will reconnect automatically.",
  "net.degraded": "Weak connection — things may take a moment.",
  "net.reconnected": "Back online.",
  "net.retry": "Retry",
  "chat.sendFailed": "Not sent — your message is saved.",
  "chat.retry": "Retry",
} as const;
