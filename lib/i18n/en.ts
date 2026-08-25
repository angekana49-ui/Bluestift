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

  // ── Public site: hero ─────────────────────────────────────────────
  "site.hero.eyebrow": "Students get why. Schools get the whole picture",
  "site.hero.headline": "The diagnosis comes first. The learning follows.",
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

  // ── Public site: the Socratic ladder (lib/raya/prompt.ts) ─────────
  // The four rungs are the tutor's real escalation policy. Don't soften them
  // into "adaptive help" — naming what each rung refuses to do is the point.
  "site.ladder.eyebrow": "Pedagogical model",
  "site.ladder.title.a": "A climbing ladder, not an",
  "site.ladder.title.em": "answer engine.",
  "site.ladder.sub":
    "Raya climbs one rung at a time and never starts at the top. The goal isn’t a correct answer in the next thirty seconds — it’s a student who can do it again next week, alone.",
  "site.ladder.r1.name": "Pump",
  "site.ladder.r1.title": "Surface what’s already there",
  "site.ladder.r1.body":
    "Every exchange opens by asking the student to attempt or recall. Nothing is handed over before a real try — even a failed attempt makes the concept stick harder.",
  "site.ladder.r2.name": "Hint",
  "site.ladder.r2.title": "Narrow the search space",
  "site.ladder.r2.body":
    "A partial clue, and only after an attempt. It points at the next move without making it; the reasoning stays the student’s.",
  "site.ladder.r3.name": "Assertion",
  "site.ladder.r3.title": "State the missing piece",
  "site.ladder.r3.body":
    "The one fact that’s actually blocking progress, said plainly — but only once hints have failed. Never the finished solution.",
  "site.ladder.r4.name": "Summary",
  "site.ladder.r4.title": "Close the loop",
  "site.ladder.r4.body":
    "A recap to end the session, or to unstick a student who is genuinely blocked. What the student restates back is what gets scored.",
  "site.ladder.note":
    "This isn’t a setting a school switches on. Raya is built so it cannot hand over a finished answer — and its feedback targets the method, never the person, per Carol Dweck’s work: “this one trips a lot of people up”, never “you’re gifted”.",

  // ── Public site: the Cognitive Kernel (lib/kernel/types.ts) ───────
  // K/V/P/M are real fields (k_raw, v_score, p_score, m_score) and the five
  // alerts are KernelAlertType verbatim. Keep this table in sync with them.
  "site.kernel.eyebrow": "Cognitive Kernel",
  "site.kernel.title.a": "Four dimensions,",
  "site.kernel.title.em": "five alerts.",
  "site.kernel.sub":
    "The Kernel doesn’t store a grade. Every concept carries a four-part vector — and when a signal degrades it names the failure, so Raya can change tactic on the very next turn.",
  "site.kernel.map.title": "Everything runs around one person.",
  "site.kernel.map.body":
    "Raya, the classroom version of Raya, the graded homework — not one of them keeps its own copy of a student. They all write into the same profile and read it back before they answer, while the conversation is still going.",
  "site.kernel.k.name": "K · Knowledge",
  "site.kernel.k.title": "What holds up without help",
  "site.kernel.k.body": "Mastery of that one concept, raw and adjusted, recomputed after each attempt.",
  "site.kernel.v.name": "V · Velocity",
  "site.kernel.v.title": "How fast it’s moving",
  "site.kernel.v.body": "The observed learning rate, so a slow climb reads differently from a full stall.",
  "site.kernel.p.name": "P · Persistence",
  "site.kernel.p.title": "Whether it survives the week",
  "site.kernel.p.body": "Resistance to forgetting: a concept secured on Monday that quietly slips by Friday gets caught.",
  "site.kernel.m.name": "M · Mindset",
  "site.kernel.m.title": "The relationship to error",
  "site.kernel.m.body": "Whether struggle reads as information or as proof of failure. Tracked per student, not per concept.",
  "site.kernel.graph.title": "The failure was in physics. The cause was in maths.",
  "site.kernel.graph.body":
    "Concepts are stored as a structure, not as a syllabus. So when something breaks, the Kernel doesn’t stop at the exercise that broke — it walks back along whatever that concept rests on, until it reaches ground that holds. That ground is often in a subject nobody thought to check.",
  "site.kernel.col.alert": "Alert",
  "site.kernel.col.signal": "Signal detected",
  "site.kernel.col.response": "Raya’s response",
  "site.kernel.a1.name": "Passive dependency",
  "site.kernel.a1.signal": "Short answers, no attempt — the student is waiting to be handed the solution.",
  "site.kernel.a1.response": "Raya refuses to escalate and asks for a genuine attempt, on a wider, goal-free prompt.",
  "site.kernel.a2.name": "False mastery",
  "site.kernel.a2.signal": "Right answers, with the reasoning missing or recited.",
  "site.kernel.a2.response": "Immediate retest in a harder, held-out context before the mastery is trusted.",
  "site.kernel.a3.name": "Recurring error",
  "site.kernel.a3.signal": "A concept already validated breaks down again weeks later.",
  "site.kernel.a3.response": "The concept is decomposed into smaller steps and rebuilt from the prerequisite up.",
  "site.kernel.a4.name": "Cognitive overload",
  "site.kernel.a4.signal": "Too many things to hold at once; the task is wider than working memory.",
  "site.kernel.a4.response": "Task complexity is cut and a worked example replaces the exercise.",
  "site.kernel.a5.name": "Fixed mindset",
  "site.kernel.a5.signal": "“I’m just bad at maths” — giving up before the first attempt.",
  "site.kernel.a5.response": "Process-focused reassurance first, before any new attempt is proposed.",

  // ── Public site: differentiators ──────────────────────────────────
  // This band states a POSITION; it does not run a comparison, and it should
  // not be turned back into one. A ✕/✓ table scoring four competitors defined
  // the product by negation, told a teacher who uses one of them daily that
  // their choice was bad, and — since this runs on bought frontier models —
  // invited "he is attacking the API he pays for". Claims of the form "they
  // cannot do X" also expire: that happened here once already, when frontier
  // models shipped long context and killed the old "the difference is the
  // memory" line. A layer is a product shape, and a shape does not expire.
  //
  // Nothing below names a competitor. The two notes are the only claims, both
  // checkable — the second one inside this repo, where lib/school-admin.ts
  // reads concept and mindset state, insights and follow-ups, and no message
  // table at all.
  "site.pos.eyebrow": "Where this sits",
  "site.pos.title.a": "The layer between",
  "site.pos.title.em": "the two you already buy.",
  "site.pos.sub":
    "Your LMS records what was done, on the days work is due. A tutor helps in the moment, and then the moment is over. Neither one keeps what a student actually understood — so on an ordinary Tuesday, with nothing due and no session running, there is nothing to read.",
  "site.pos.note.model":
    "Everything in this category runs on bought frontier models. So does this, from the same suppliers. The model is the floor — it is not what anyone is choosing between. The record above it is.",
  "site.pos.note.privacy":
    "And that record is narrow on purpose. A teacher sees that derivatives are fragile. A teacher does not see what was said — which is less than the gradebook they already have knows about the same student.",

  // ── Public site: roadmap ──────────────────────────────────────────
  // Must track docs/project-status.md. Payments stay "in progress" until live
  // acquiring is switched on (sandbox-only today); the trajectory curve stays
  // "in progress" until the simulation runs Kernel-side rather than as an LLM
  // estimate. Promoting either one early makes the whole page a liability.
  "site.roadmap.eyebrow": "Roadmap",
  "site.roadmap.title.a": "Where the product",
  "site.roadmap.title.em": "actually stands.",
  "site.roadmap.sub":
    "What’s live, what’s mid-build, what’s next. Nothing above is a screenshot of a feature that doesn’t exist yet.",
  "site.roadmap.status.shipped": "Shipped",
  "site.roadmap.status.progress": "In progress",
  "site.roadmap.status.coming": "Coming",
  "site.roadmap.i1.title": "Socratic sessions & Cognitive Kernel",
  "site.roadmap.i1.body":
    "The Pump → Hint → Assertion → Summary ladder, the per-concept vector and the five pedagogical alerts, running in every session.",
  "site.roadmap.i2.title": "Schools workspace",
  "site.roadmap.i2.body":
    "Self-serve onboarding, admin and teacher roles, classes, invite codes and team joins, and insights by class and subject.",
  "site.roadmap.i3.title": "Study Rooms, Challenges & Tools",
  "site.roadmap.i3.body":
    "Live group rooms with shared documents, group challenges with standings, and quizzes, summaries, flashcards and mind maps generated from a lesson.",
  "site.roadmap.i4.title": "Payments & quotas",
  "site.roadmap.i4.body":
    "Card, mobile money and PayPal through a single aggregator, plus usage-limit enforcement. The full flow runs in sandbox; live acquiring isn’t switched on yet.",
  "site.roadmap.i5.title": "Per-concept trajectory curve",
  "site.roadmap.i5.body":
    "A real Kernel-side projection, replacing the model-guided estimate the student profile shows today.",
  "site.roadmap.i6.title": "LMS sync",
  "site.roadmap.i6.body": "Importing classes and rosters from the environment a school already runs, instead of retyping them.",

  // ── Public site: FAQ ──────────────────────────────────────────────
  "site.faq.title.a": "Frequently asked",
  "site.faq.title.em": "questions.",
  "site.faq.q1": "Does Raya replace the teacher?",
  "site.faq.a1":
    "No. It absorbs the repetition and the diagnosis, and hands back the part a teacher does better than any model: deciding what to do about what it found.",
  "site.faq.q2": "What does a teacher actually see?",
  "site.faq.a2":
    "Which concepts a student has secured, which are still shaky, and the prerequisite blocking the rest — never their conversations with Raya. A student who feels read stops admitting what they don’t understand.",
  "site.faq.q3": "What if the student just asks for the answer?",
  "site.faq.a3":
    "Raya can’t give it — the guardrail is structural, not a setting. And a correct answer with no reasoning behind it doesn’t raise mastery either.",
  "site.faq.q4": "Do we have to import our curriculum?",
  "site.faq.a4":
    "No. Concepts are extracted from the documents you upload and attached to the existing graph. One lesson is enough to start.",
  "site.faq.q5": "Does it work on a weak connection?",
  "site.faq.a5":
    "Yes. The interface is light, the student works in their own language, and the profile lives server-side — the device stores and recomputes nothing.",

  // ── Public site: closing CTA ──────────────────────────────────────
  // Offer wording must match the hero chips. There is no fixed-length trial.
  "site.finalCta.title.a": "Try Raya with",
  "site.finalCta.title.em": "one class.",
  "site.finalCta.sub": "Free to start, no card. The student begins; the Kernel does the rest.",
  "site.finalCta.ctaPrimary": "Start free",
  "site.finalCta.ctaSecondary": "Talk to the team",
  "site.finalCta.note": "Solo, or with your class. Nothing to install.",

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
  "site.footer.col.legal": "LEGAL",
  "site.footer.link.studyRooms": "Study Rooms",
  "site.footer.link.toolsStudio": "Tools Studio",
  "site.footer.link.contribute": "Contribute",
  "site.footer.link.progress": "Progress",
  "site.footer.link.terms": "Terms",
  "site.footer.link.dpa": "Schools DPA",
  "site.footer.link.subprocessors": "Sub-processors",
  "site.footer.link.feedback": "Feedback",
  "site.footer.rights": "All rights reserved.",

  // ── Network resilience (degraded banner, retry affordances) ───────
  "net.offline": "You're offline. Raya will reconnect automatically.",
  "net.degraded": "Weak connection — things may take a moment.",
  "net.reconnected": "Back online.",
  "net.retry": "Retry",
  "net.roomLiveDown": "Live updates paused — reconnecting. Messages still send.",
  "chat.sendFailed": "Not sent — your message is saved.",
  "chat.retry": "Retry",
} as const;
