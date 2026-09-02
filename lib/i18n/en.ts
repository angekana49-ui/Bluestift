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
  "nav.assignments": "Assignments",
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
  // ── Settings sheet (the sidebar profile chip, both apps) ─────────────────
  "settings.title": "Settings",
  "settings.close": "Close settings",
  "settings.group.account": "Account",
  "settings.group.learning": "Learning",
  "settings.group.school": "School",
  "settings.group.app": "App",
  "settings.group.appearance": "Appearance",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.system": "System",
  "settings.theme.desc": "Light, dark, or whatever your device is set to",
  "settings.row.profile": "Profile",
  "settings.row.profile.sub": "Name, photo, sign-in and recovery",
  "settings.row.plan": "Plan",
  "settings.row.kernel": "My Kernel",
  "settings.row.kernel.sub": "What Raya has learned about you",
  "settings.row.shares": "Shared links",
  "settings.row.shares.sub": "Public links you have handed out",
  "settings.row.privacy": "Privacy & data",
  "settings.row.privacy.sub": "What we keep, and how to take it back",
  "settings.row.activeSchool": "Active school",
  "settings.row.billing": "Billing & seats",
  "settings.row.team": "Team & classes",
  "settings.anonymous": "Anonymous account",
  "settings.language.title": "Language",
  "settings.language.desc": "Choose the language of the app interface",

  // ── Public site: nav ──────────────────────────────────────────────
  // Headlines carry an italic-serif flourish on part of the line, so they're
  // split into fragments (`.a` / `.em` / `.b`) rather than storing markup.
  // The five top-nav labels below are deliberately identical in every locale
  // — the user's call: a little English in the header hurts no one.
  "site.nav.product": "Product",
  "site.nav.research": "Research",
  "site.nav.survey": "Survey",
  "site.nav.pricing": "Pricing",
  "site.nav.contact": "Contact",
  "site.nav.privacy": "Privacy",
  "site.nav.signIn": "Sign in",
  // NOT "Free trial". There is no trial: the free tier is permanent (see
  // RAYA_ENTITLEMENTS.free — a daily message cap, not a countdown), and every
  // other offer line on the site already says so, from the hero chips to
  // site.finalCta. A nav button promising a trial sets a clock running in the
  // reader's head that nothing else on the page, or in the product, honours.
  "site.nav.startFree": "Start free",
  "site.nav.openApp": "Open app",

  // ── Public site: hero ─────────────────────────────────────────────
  // The eyebrow says the category and nothing else. It used to carry a second
  // hook ("Students get why. Schools get the whole picture"), which left the
  // page with two hooks and no category — a cold visitor could read the whole
  // fold without learning what Bluestift IS. The headline is set in Caveat at
  // up to 6.4rem: that is a voice, and a category line written by hand reads as
  // a doodled slogan, so the two cannot swap places.
  "site.hero.eyebrow": "The collaborative AI for education",
  "site.hero.headline": "The diagnosis comes first. The learning follows.",
  /*
   * One belief, not a summary.
   *
   * Three drafts failed here and all three failed the same way: they tried to
   * be the page. One argued the dissociation thesis, which the connection band
   * argues in full a screen and a half below. One inventoried three products,
   * which the features band does one screen below in three scannable cards. One
   * compressed the Kernel's whole mechanism into a subordinate clause. Every
   * one of them was an abstract — accurate, dense, and no reason at all to keep
   * reading. A visitor does not scroll because a paragraph was informative.
   *
   * So this one carries no feature, no surface and no number. It says the thing
   * the product actually believes, and it is the one line on the page that is
   * about the student rather than the software: being stuck is a missing step,
   * not a deficiency. That is not decoration either — it is the pedagogy this
   * repo implements. lib/raya/prompt.ts aims every piece of feedback at the
   * method and never at the person (see site.ladder.note and Dweck), and the
   * Kernel band spends thirty seconds walking a failure back through four
   * prerequisites to the step that was actually missing. The claim and the
   * mechanism are the same claim.
   *
   * Nothing here is quantified, deliberately. "Rarely", "often", "most students"
   * would each be a statistic nothing in this repo can back.
   */
  "site.hero.sub":
    "Being lost isn’t a lack of ability. It’s a missing step — and Raya walks back until it finds it.",
  "site.hero.ctaPrimary": "Try it free",
  "site.hero.ctaSecondary": "See how it works",
  // "Free to start" was saying what the primary CTA above it already says.
  // What replaced it is the positioning decision itself — no level targeting,
  // no geography, no subject list (kernel `subject` is a free string and the
  // tutor's prompt treats medicine and law as ordinary school subjects).
  "site.hero.chip.scope": "Any subject, any level",
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
    // Opens on what the card DRAWS. The shot beside this is the Tools Studio,
    // and a description that led with live standings was promising a
    // leaderboard next to a picture of a quiz generator. Both are real — the
    // standings are in components/room-challenges.tsx — so the fix is the order,
    // not the claim. The title still says "Challenges & Tools", covering both.
    "Summaries, flashcards and mind maps from any lesson, plus quizzes, tests and group challenges with live standings. Every attempt feeds the same profile.",

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
  // K/V/P/M are real fields (k_raw, v_score, p_score, m_score) and the seven
  // alerts are KernelAlertType verbatim. Keep this table in sync with them.
  //
  // It said five for a while, and the table listed five, because the last two
  // are not about the student at all — they are the Kernel declining to trust
  // its own number. That is a reason to publish them, not to omit them: on a
  // page selling measurement, the alert that says "this measurement is
  // unreliable" is the one a sceptical teacher is looking for. Both are in
  // lib/raya/prompt.ts (priorities 6 and 7) and lib/kernel/risk.ts.
  "site.kernel.eyebrow": "Cognitive Kernel",
  "site.kernel.title.a": "Four dimensions,",
  "site.kernel.title.em": "seven alerts.",
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
  // The last two are the Kernel about itself, not about the student.
  "site.kernel.a6.name": "Unstable estimate",
  "site.kernel.a6.signal": "The number keeps moving instead of settling — right, then wrong, then right, on the same concept.",
  "site.kernel.a6.response": "Raya asks for one clean attempt with no hints, and nothing is built on that concept until it holds still.",
  "site.kernel.a7.name": "Outside the calibration",
  "site.kernel.a7.signal": "This student doesn’t behave like the population the parameters were fitted on.",
  "site.kernel.a7.response": "Raya goes by what this turn shows rather than the stored number, and won’t raise difficulty on the strength of it.",

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
    "The Pump → Hint → Assertion → Summary ladder, the per-concept vector and the seven alerts, running in every session.",
  "site.roadmap.i2.title": "Schools workspace",
  "site.roadmap.i2.body":
    "Self-serve onboarding, admin and teacher roles, classes, invite codes and team joins, and insights by class and subject.",
  "site.roadmap.i3.title": "Study Rooms, Challenges & Tools",
  "site.roadmap.i3.body":
    "Live group rooms with shared documents, group challenges with standings, and quizzes, summaries, flashcards and mind maps generated from a lesson.",
  "site.roadmap.i8.title": "Works on a weak connection",
  "site.roadmap.i8.body":
    "The interface is cached on the device after the first visit, so it opens without waiting for the network, and writes are queued and retried rather than lost.",
  // Two halves, two disclosures — and BOTH are now read off the deployment
  // rather than typed here, which is why this entry is three keys instead of
  // one. A hand-written "live acquiring isn't switched on" is true until the
  // afternoon somebody adds the provider keys, and then it is a lie on the one
  // page whose entire value is that it does not tell them. The clauses are
  // joined by RoadmapTimeline from `billingIsLive()` and ENTITLEMENTS_ENFORCE,
  // so the sentence and the code cannot disagree.
  "site.roadmap.i4.title": "Payments & quotas",
  "site.roadmap.i4.body":
    "Card, mobile money and PayPal through a single aggregator, plus the plan limits.",
  "site.roadmap.i4.pay.sandbox":
    "The full payment flow runs in sandbox — live acquiring isn’t switched on.",
  "site.roadmap.i4.pay.live": "Live acquiring is switched on.",
  "site.roadmap.i4.quota.counting":
    "The limits are counted and reported, and do not yet turn anyone away.",
  "site.roadmap.i4.quota.enforcing":
    "The limits published on the pricing page are enforced: past one, the action is refused rather than logged.",
  "site.roadmap.i5.title": "Per-concept trajectory curve",
  "site.roadmap.i5.body":
    "A real Kernel-side projection, replacing the model-guided estimate the student profile shows today.",
  "site.roadmap.i6.title": "LMS sync",
  "site.roadmap.i6.body":
    "Google Classroom sign-in, then classes and rosters imported read-only from the environment a school already runs, instead of retyping them. Built end to end; it turns on per deployment once the Google credentials are registered.",
  "site.roadmap.i7.title": "Audio summaries & infographics",
  "site.roadmap.i7.body":
    "A lesson turned into something you can listen to on the way to school, or read as one picture. Designed, not built — and deliberately not on any pricing card until it is.",

  // ── Public site: FAQ ──────────────────────────────────────────────
  // Keys are named for their question, not numbered. The set changes when the
  // page's argument changes, and a `q3` that no longer sits third is worse than
  // a rename — the numbers stopped meaning anything the first time one moved.
  //
  // Two questions were dropped rather than answered twice. "Does Raya replace
  // the teacher?" is what the hero and the whole connection band are about, and
  // "what if the student just asks for the answer?" is what the ladder band
  // demonstrates on four rungs with a live transcript. A FAQ that restates the
  // page is where a sceptical reader stops believing the page.
  //
  // What replaced them is what a sceptic actually arrives with, hardest first:
  // the model is bought, this competes with an LMS we already pay for, and you
  // are training on our children. All three are answerable from this repo.
  "site.faq.title.a": "Frequently asked",
  "site.faq.title.em": "questions.",
  "site.faq.model.q": "Isn’t this ChatGPT with a system prompt?",
  "site.faq.model.a":
    "The model underneath is a bought frontier model. So is theirs — that part is the floor, not the difference. What sits on top is a record: every attempt is scored concept by concept into one profile that the student’s tutor and their teacher both read. A prompt is not a record, and it is gone when the tab closes.",
  "site.faq.lms.q": "We already pay for an LMS. Why another tool?",
  "site.faq.lms.a":
    "This isn’t one and doesn’t want to be. Your LMS records what was set and what was handed in; this records what was understood, which is a column no gradebook has ever had. They connect rather than compete — Google Classroom signs in and your classes and rosters come from where they already live.",
  "site.faq.sees.q": "What does a teacher actually see?",
  "site.faq.sees.a":
    "Which concepts a student has secured, which are still shaky, and the prerequisite blocking the rest — never their conversations with Raya. A student who feels read stops admitting what they don’t understand.",
  "site.faq.training.q": "Is our students’ work used to train models?",
  "site.faq.training.a":
    "No, unless an adult has switched it on for their own account. The age is checked before the consent box is even read, so a minor’s account cannot be enrolled at all — not even by ticking it. If that check can’t be completed, the answer is no.",
  "site.faq.curriculum.q": "Do we have to import our curriculum?",
  "site.faq.curriculum.a":
    "No. Concepts are extracted from the documents you upload and attached to the existing graph. One lesson is enough to start.",
  "site.faq.offline.q": "Does it work on a weak connection?",
  "site.faq.offline.a":
    "Yes. The interface is light and it is cached on the device after the first visit, so it opens without waiting for the network. The profile stays server-side, so nothing heavy is recomputed on a cheap phone.",

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
  // Schools only. Individual plans are one price worldwide — deliberately — so
  // this line must not creep onto the Solo card.
  //
  // It used to name the fourteen CFA-franc countries and the local currency.
  // All of that is true (plan_region_prices carries explicit XAF/XOF amounts
  // for both school tiers; lib/billing/regions.ts lists the countries) and none
  // of it belongs on a card. A visitor outside the zone reads two lines that do
  // not concern them, and one inside it does not need to be told which country
  // they are in — they need to know the figure above can move, and then to
  // click through. /pricing is where the amounts are.
  "site.pricing.schools.region": "School pricing varies by region.",
  "site.pricing.schools.cta": "See school plans",
  "site.pricing.custom.title": "Custom",
  // Three of these four lines said nothing checkable, on a page whose whole
  // argument is that it doesn't do that. "Highest performance" and "Advanced
  // features" were filler. "Your data, your rules, your own AI" was worse than
  // filler: nothing in this repo self-hosts a model or takes a customer's own,
  // so the last third of that line sold something that does not exist — on the
  // one card whose CTA opens a negotiation, which is exactly where an invented
  // capability turns into a commitment somebody has to honour.
  //
  // All four now read off SCHOOL_ENTITLEMENTS.custom: sso, multiSchool, lms,
  // every quota null, archiveYears null (the retention window is negotiated
  // rather than fixed), and insightsExport / simulationExport / exportsPerMonth
  // null. The DPA is a real document at /dpa. The cadence of the old line is
  // kept because it was the good part — only the claim under it changed.
  "site.pricing.custom.l1": "The full engine, tuned to your school",
  "site.pricing.custom.l2": "Single sign-on, several schools under one roof",
  "site.pricing.custom.l3": "LMS sync, and no quota on anything",
  "site.pricing.custom.l4": "Your retention window, your exports, your DPA",
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

  // ── File picker (components/ui/file-picker.tsx) ──
  "file.choose": "Choose a file",
  "file.chooseMulti": "Choose files",
  "file.none": "No file chosen",

  // ── Conversation history (components/chat/chat-history-list.tsx) ──
  // Every destructive or irreversible row action states its consequence BEFORE
  // it runs, in the dialog. These strings are the promise the app then has to
  // keep, so they say what actually happens — including the awkward part
  // (deleting a thread does not unlearn what the Kernel took from it).
  "hist.new": "+ New session",
  "hist.empty": "No conversations yet.",
  "hist.untitled": "New conversation",
  "hist.actions": "Conversation options",
  "hist.memorized": "Memorized",
  "hist.archivedSection": "Archived",
  "hist.cancel": "Cancel",
  "hist.working": "Working…",

  "hist.memorize": "Memorize",
  "hist.memorize.menuSub": "Fold it into your Kernel",
  "hist.memorize.title": "Memorize this conversation?",
  "hist.memorize.body":
    "Raya will read the whole thread and fold what it shows into your Kernel: your concept states and learning profile get updated, and this conversation is anchored as something Raya can draw on later. Nothing is deleted, and nothing leaves your account. This can take a few seconds.",
  "hist.memorize.confirm": "Memorize it",
  "hist.memorize.done": "Memorized — your learning profile has been updated.",
  "hist.memorize.doneGap": "Root gap picked up:",

  "hist.archive": "Archive",
  "hist.archive.menuSub": "File it out of the way",
  "hist.archive.title": "Archive this conversation?",
  "hist.archive.body":
    "It leaves your history list and Raya stops offering it as context. Every message and attachment is kept — you'll find it under Archived, and you can restore it at any time. If it's the conversation you have open, it closes and you get a fresh session.",
  "hist.archive.confirm": "Archive it",

  "hist.unarchive": "Restore",
  "hist.unarchive.menuSub": "Put it back in the list",
  "hist.unarchive.title": "Restore this conversation?",
  "hist.unarchive.body":
    "It goes back into your history list, and Raya can use it as context again. Nothing else changes.",
  "hist.unarchive.confirm": "Restore it",

  "hist.delete": "Delete",
  "hist.delete.menuSub": "Erase it permanently",
  "hist.delete.title": "Delete this conversation?",
  "hist.delete.body":
    "The conversation, its messages and its attachments are permanently erased. It does not go to a trash and it will not come back in your history — there is no undo.",
  "hist.delete.caveat":
    "What the Kernel already learned from it stays in your learning profile — deleting the thread does not unlearn it. To remove that too, use Settings › Your data.",
  "hist.delete.confirm": "Delete permanently",

  // ── Onboarding (post-signup account setup, components/onboarding-form.tsx) ─
  // No interpolation helper exists in this catalogue, so anywhere the English
  // sentence needs a dynamic value (a step count, a percentage, a name, a status
  // code) the sentence is split into fragments and rejoined in JSX/JS, the same
  // "a/em/b" pattern the public-site headlines already use. Word order for
  // "Step N of Total" and "N% <word>" and "Welcome to X, Name" happens to match
  // across en/fr/es/de, so this stays plain concatenation rather than a template
  // engine.
  "onb.stepLabel": "Step",
  "onb.of": "of",
  "onb.setUp": "set up",

  "onb.path.heading": "How will you use BlueStift?",
  "onb.path.sub": "One account, two ways in — you can do both later.",
  "onb.path.raya.title": "Learn with",
  "onb.path.raya.desc": "Study solo or in rooms with your AI tutor.",
  "onb.path.schools.title": "Teach or run a school",
  "onb.path.schools.desc": "Join a team with a code, or set up your own school.",

  "onb.age.heading": "What year were you born?",
  "onb.age.sub":
    "We ask everyone. It decides what we're allowed to switch on for your account — nothing more.",
  "onb.age.label": "Year of birth",
  "onb.age.placeholder": "e.g. 2009",
  "onb.age.note": "We store the year only — never a full date of birth.",

  "onb.name.heading": "What should we call you?",
  "onb.name.sub": "Your username is unique; your display name is what others see.",
  "onb.name.usernameLabel": "Username (unique)",
  "onb.name.usernamePlaceholder": "e.g. alex_m",
  "onb.name.displayLabel": "Display name",
  "onb.name.displayPlaceholder": "e.g. Alex",

  "onb.level.heading": "Where are you in school?",
  "onb.level.sub.a": "This helps",
  "onb.level.sub.b": "pitch explanations at the right level.",
  "onb.level.middle": "Middle school",
  "onb.level.high": "High school",
  "onb.level.university": "University",
  "onb.other": "Other",

  "onb.subjects.heading": "What do you want to work on?",
  "onb.subjects.sub": "Pick a few — you can change these any time. (Optional)",
  "onb.subject.maths": "Maths",
  "onb.subject.physics": "Physics",
  "onb.subject.chemistry": "Chemistry",
  "onb.subject.biology": "Biology",
  "onb.subject.historyGeo": "History & Geography",
  "onb.subject.languages": "Languages",
  "onb.subject.economics": "Economics",
  "onb.subject.cs": "Computer science",
  "onb.subject.philosophy": "Philosophy",

  "onb.goal.heading": "What's your goal?",
  "onb.goal.sub.a": "A sentence is enough —",
  "onb.goal.sub.b": "keeps it in mind.",
  "onb.goal.default": "Understand my lessons more deeply and feel ready for exams.",

  "onb.srole.heading.a": "How will you use",
  "onb.srole.sub": "Pick one — you can also do both from one account.",
  "onb.srole.teacher.title": "I teach at a school",
  "onb.srole.teacher.desc": "Join the team with the invite code your admin gave you.",
  "onb.srole.school.title": "I run a school",
  "onb.srole.school.desc": "Set up your school, classes and access codes.",

  "onb.focus.heading.school": "What's your school about?",
  "onb.focus.heading.teacher": "What do you teach?",
  "onb.focus.sub": "A short note helps us tailor your dashboard. (Optional)",
  "onb.focus.placeholder.school": "e.g. science academy, 600 students",
  "onb.focus.placeholder.teacher": "e.g. Maths & Physics, final year",

  "onb.ready.heading": "You're all set.",
  "onb.ready.sub": "Here's what happens next.",
  "onb.ready.note.school":
    "Next: name your school and add classes, access codes and teachers. You'll be its administrator — pricing is shown up front.",
  "onb.ready.note.teacher":
    "Next: enter your school's invite code to join the teaching team. No code yet? Your admin can send you one.",

  "onb.back": "Back",
  "onb.continue": "Continue",
  "onb.continueArrow": "Continue →",
  "onb.finishArrow": "Finish →",

  "onb.terms.agree": "By continuing you agree to our",
  "onb.terms.termsLink": "Terms",
  "onb.terms.and": "and",
  "onb.terms.privacyLink": "Privacy Policy",

  "onb.welcome.greeting": "Welcome to",
  "onb.welcome.sub.schools": "Your account is ready. Let's get your school set up.",
  "onb.welcome.sub.raya.a": "Your account is ready.",
  "onb.welcome.sub.raya.b": "will adapt to how you learn from your very first session.",
  "onb.welcome.cta.schools": "Open",
  "onb.welcome.cta.raya": "Start learning →",

  "onb.switchMethod": "← Use a different sign-in method",

  "onb.err.age": "Enter the year you were born.",
  "onb.err.nameRequired": "Choose a username and a display name.",
  "onb.err.level": "Pick your level.",
  "onb.err.srole": "Tell us how you'll use Schools.",
  "onb.err.saveFailed": "Couldn't save that",
  "onb.err.network": "Couldn't reach the server.",
  "onb.err.usernameTaken": "That username is already taken.",

  "onb.email.heading": "Secure your account",
  "onb.email.sub":
    "You're signed in anonymously. Add an email so you never lose access — or keep just your recovery key.",
  "onb.email.label": "Email (recommended)",
  "onb.email.placeholder": "you@example.com",
  "onb.email.linkBtn": "Link",
  "onb.email.sentBtn": "Sent ✓",
  "onb.email.checkInbox": "Check your inbox to confirm — you can finish setting up now.",
  "onb.email.recoveryTitle": "Your recovery key",
  "onb.email.alreadyShown": "already shown",
  "onb.email.hide": "Hide",
  "onb.email.reveal": "Reveal",
  "onb.email.copied": "Copied ✓",
  "onb.email.copy": "Copy",
  "onb.email.saved": "Saved ✓",
  "onb.email.download": "Download",
  "onb.email.bullet1": "This key is how you get back in if you sign out or change device.",
  "onb.email.bullet2.a": "We keep no copy of it. If you lose it,",
  "onb.email.bullet2.strong": "nobody can bring it back",
  "onb.email.bullet2.b": "— not even us.",
  "onb.email.bullet3": "Anyone who has it can open your account, so keep it to yourself.",
  "onb.email.tailLabel": "Type the last four characters to check you have it",
  "onb.email.tailAria": "Last four characters of your recovery key",
  "onb.email.gotIt": "Got it ✓",
  "onb.email.tailWrong": "Not quite — check the last group.",
  "onb.email.tailHint": "The four after the last dash.",
  "onb.email.noKey.a":
    "Your key was already shown once — we keep only a fingerprint of it, so it can't be shown again. If you didn't save it, add an email above, then generate a replacement in",
  "onb.email.noKey.strong": "Settings",

  "onb.blocked.heading.a": "You need your school's permission to use",
  "onb.blocked.sub":
    "Under 13, we can only open an account when a school sets it up. If your teacher gave you a class code, enter it here and you're in.",
  "onb.blocked.codeLabel": "Class code",
  "onb.blocked.codePlaceholder": "From your teacher",
  "onb.blocked.nameLabel": "Your name (shared only with your school)",
  "onb.blocked.firstNamePlaceholder": "First name",
  "onb.blocked.lastNamePlaceholder": "Last name",
  "onb.blocked.linking": "Linking…",
  "onb.blocked.submit": "Use my class code →",
  "onb.blocked.err.linkFailed": "Couldn't link that code",
  "onb.blocked.note.strong": "No class code?",
  "onb.blocked.note.a": "Ask your teacher for one. A parent or guardian can also write to",
  "onb.blocked.note.b": "and we'll sort it out with them.",
  "onb.blocked.closed":
    "Until then this account stays closed. We've kept nothing but the year you gave us, and it will be deleted along with the account if it goes unused.",

  // ── Auth panel (components/auth-panel.tsx — /login AND /account) ──
  "auth.err.captcha": "Complete the CAPTCHA first.",
  "auth.err.network": "Couldn't reach the server.",
  "auth.err.startFailed": "Couldn't start. Try again.",
  "auth.msg.linkSent.a": "Link sent to",
  "auth.msg.linkSent.b": "Check your inbox.",
  "auth.err.keyLength": "A recovery key is 16 characters. Check for a missing one.",
  "auth.err.recoveryFailed": "Recovery failed.",
  "auth.msg.recovered": "Good to see you again — signing in…",
  "auth.msg.keySent": "If that key is valid, a sign-in link was sent to the account. Check your inbox.",
  "auth.err.keyInvalid": "That recovery key isn't valid.",
  "auth.err.chooseImage": "Choose an image.",
  "auth.msg.avatarUpdated": "Profile picture updated.",
  "auth.err.uploadFailed": "Couldn't upload the picture.",

  "auth.login.title": "Sign in or get started",
  "auth.login.emailLabel": "Already have an account? Sign in by email",
  "auth.login.emailPlaceholder": "you@email.com",
  "auth.login.sendLink": "Send the link",
  "auth.login.recoveryLabel": "Lost access? Use your recovery key",
  "auth.login.recoveryPlaceholder": "XXXX-XXXX-XXXX-XXXX",
  "auth.login.recoverBtn": "Recover",
  "auth.login.newHere": "New here?",
  "auth.login.startAnon": "Start anonymously",

  // The decorative brand pane shared by the onboarding split and the login
  // screen (components/ui/auth-chrome.tsx) — not part of the onboarding
  // flow's own steps, hence its own small namespace rather than onb.*.
  "auth.hero.a": "One account.",
  "auth.hero.b": "Everything",
  "auth.hero.sub.a": "Learn with",
  "auth.hero.sub.b": ", teach, or run a whole school — set it up once, in a few taps.",
  "auth.hero.tagline": "AI tutor · any level, any subject, anywhere",

  "auth.account.changePhoto": "Change photo",
  "auth.account.emailLabel": "Email",
  "auth.account.anonymous": "(anonymous)",
  "auth.account.typeLabel": "Account type",
  "auth.account.unsafe.title": "Your progress isn't safe yet",
  "auth.account.unsafe.a":
    "This account lives only on this device. If you clear your browser or lose your recovery key, your",
  "auth.account.unsafe.strong": "conversations, self-tests and Kernel profile disappear for good",
  "auth.account.unsafe.b": ". Link an email now to keep them.",
  "auth.account.keepProgress": "Keep my progress",

  "auth.recovery.title": "Recovery key",
  "auth.recovery.new.a": "Here is your new key.",
  "auth.recovery.new.strong": "This is the only time it will be shown",
  "auth.recovery.new.b": "— save it now. Any older key has stopped working.",
  "auth.recovery.existing.a": "Your key is the",
  "auth.recovery.onlyWayBack": "only way back into this account",
  "auth.recovery.existing.b":
    "if you lose access. We store only a fingerprint of it, so we genuinely can't show it to you again — if you've lost it, generate a new one and the old one stops working.",
  "auth.recovery.none.a": "You don't have a recovery key yet. It is the",
  "auth.recovery.none.b": "if you lose access to this device.",
  "auth.recovery.generating": "Generating…",
  "auth.recovery.confirmReplace": "Yes, replace my key",
  "auth.recovery.regenerate": "Generate a new key",
  "auth.recovery.generateFirst": "Generate my key",
  "auth.recovery.confirmWarning": "Your current key will stop working.",
  "auth.recovery.cancel": "Cancel",
  "auth.recovery.issued": "Issued",
  "auth.recovery.err.generateFailed": "Could not generate a key. Try again.",
  "auth.recovery.err.generateNetwork": "Could not generate a key. Check your connection.",

  // ── Sign-in screen (components/login-view.tsx, /login full-screen split) ──
  // Shares the underlying flows (and several messages) with auth-panel.tsx —
  // reuses those "auth.*" keys where the copy is word-for-word identical, and
  // gets its own "login.*" key where this screen phrases it differently.
  "login.err.invalidLink": "That sign-in link is invalid or has expired. Please try again.",
  "login.msg.signedOut": "Signed out. Pick how you'd like to continue.",
  "login.backToSite": "← Back to bluestift.com",
  "login.heading": "Sign in to",
  "login.sub": "Continue with email, a recovery key, or start anonymously — one account for everything.",
  "login.pending.note":
    "You have an unfinished setup on this device. Pick up where you left off, or sign out and choose a different way in.",
  "login.pending.continue": "Continue setup",
  "login.pending.switchMethod": "Use a different method",
  "login.emailLabel": "Have an account? Sign in by email",
  "login.sendLink": "Send link",
  "login.recoveryPlaceholder": "Recovery key",
  "login.newHereDivider": "New here",
  "login.startAnonymous": "Start anonymously — no email needed",

  // ── Checkout (app/checkout, components/checkout — not the sandbox stand-in) ─
  "checkout.method.card": "Card / Virtual card",
  "checkout.method.mobileMoney": "Mobile Money",
  "checkout.method.paypal": "PayPal",
  "checkout.method.card.sub": "Visa · Mastercard",
  "checkout.method.mobileMoney.sub": "MTN · Orange · Moov · Wave",
  "checkout.method.paypal.sub": "Pay with your PayPal balance",
  "checkout.redirecting": "Redirecting…",
  "checkout.payArrow": "Pay →",
  "checkout.err.startFailed": "Could not start checkout.",
  "checkout.err.network": "Network error — please try again.",

  "checkout.backToPlans": "← Plans",
  "checkout.title": "Checkout",
  "checkout.row.plan": "Plan",
  "checkout.row.seats": "Seats",
  "checkout.row.term": "Term",
  "checkout.row.discount": "Annual discount",
  "checkout.row.total": "Total",
  "checkout.month.singular": "month",
  "checkout.month.plural": "months",
  "checkout.term.annual": "annual",
  "checkout.paymentsOff.title": "Online payment isn't open yet.",
  "checkout.paymentsOff.body":
    "The price above is the real one. We're finishing the payment channel — until it's live, schools are activated by hand and it takes a day.",
  "checkout.paymentsOff.cta": "Talk to us",
  "checkout.signIn.prompt": "Sign in to complete your purchase.",
  "checkout.noSeats":
    "No seat count set. Start this checkout from your school's Billing tab so the number of students is included.",
  "checkout.choosePayment": "Choose how to pay",
  "checkout.footerNote": "Payments are processed by our provider. You'll be redirected to a secure checkout.",

  "checkout.return.paid.title": "You're all set",
  "checkout.return.paid.body": "Your payment went through and your plan is now active.",
  "checkout.return.paid.ctaSchool": "Go to your school",
  "checkout.return.paid.ctaRaya": "Open Raya",
  "checkout.return.pending.title": "Payment processing",
  "checkout.return.pending.body":
    "We're confirming your payment. This page will reflect the final status shortly — you can safely refresh.",
  "checkout.return.pending.cta": "Back to plans",
  "checkout.return.failed.title": "Payment didn't complete",
  "checkout.return.failed.body": "No charge was made. You can try again with another method.",
  "checkout.return.failed.cta": "Try again",
  "checkout.return.notfound.title": "Payment not found",
  "checkout.return.notfound.body": "We couldn't find this checkout. If you were charged, contact support.",
  "checkout.return.notfound.cta": "Contact us",

  // ── Legal pages shell (components/site/pages/legal-chrome.tsx) ────
  "legal.lastUpdated": "Last updated",

  // ── Contact page (components/site/pages/ContactView.tsx) ──────────
  "contact.title.a": "Talk to",
  "contact.title.em": "the team.",
  "contact.sub": "Interested school, researcher, press, or just curious — write to us, we reply fast.",
  "contact.subject.school": "School",
  "contact.subject.research": "Research / collaboration",
  "contact.subject.press": "Press",
  "contact.done.title": "Message sent.",
  "contact.done.body.a": "We'll reply to",
  "contact.done.body.b": "as soon as we can.",
  "contact.form.namePlaceholder": "Your name",
  "contact.form.emailPlaceholder": "you@email.com *",
  "contact.form.subjectPlaceholder": "Subject…",
  "contact.form.messagePlaceholder": "Your message *",
  "contact.form.error": "Couldn't send — try again.",
  "contact.form.sending": "Sending…",
  "contact.form.send": "Send message",

  // ── Research post (components/site/pages/ResearchPostView.tsx) ────
  // post.title / post.content / author names are CMS content, not UI copy —
  // out of scope. Only the chrome around them is keyed here.
  "research.post.back": "← Back to publications",
  "research.post.type.paper": "Paper",
  "research.post.type.experiment": "Experiment",
  "research.post.type.article": "Article",
  "research.post.type.update": "Update",
  "research.post.summary": "Summary",

  // ── Sub-processors page (components/site/pages/SubprocessorsView.tsx) ─
  // Provider names (Supabase, Vercel, Gemini, …) are proper nouns — never
  // translated, same rule as Bluestift/Raya/Schools.
  "subprocessors.title.a": "Sub-",
  "subprocessors.title.em": "processors.",
  "subprocessors.intro":
    "These are the companies that process personal data on our behalf so Bluestift can work. Each one is here for a single named purpose and has no right to use the data for anything else.",
  "subprocessors.today.strong": "Where we are today.",
  "subprocessors.today.body":
    "Bluestift has just launched. We are working through each provider's data processing agreement, including the standard contractual clauses that cover transfers out of the EEA and the UK. Until this page says a given agreement is in place, assume it is still in progress — and if that matters to your decision, ask us and we'll tell you exactly where it stands. We would rather be checkable than sound finished.",
  "subprocessors.current.h2": "Current sub-processors",
  "subprocessors.table.provider": "Provider",
  "subprocessors.table.what": "What it does",
  "subprocessors.table.data": "Data it sees",
  "subprocessors.table.where": "Where",
  "subprocessors.loc.eu": "EU",
  "subprocessors.loc.euUs": "EU / US",
  "subprocessors.loc.us": "US",
  "subprocessors.loc.global": "Global",
  "subprocessors.loc.africaEu": "Africa / EU",
  "subprocessors.row.supabase.purpose": "Database, authentication and file storage — the system of record",
  "subprocessors.row.supabase.data": "Everything stored: accounts, conversations, uploads, learning signals",
  "subprocessors.row.vercel.purpose": "Application hosting and scheduled jobs",
  "subprocessors.row.vercel.data": "Requests in transit, server logs",
  "subprocessors.row.gemini.purpose": "Generates Raya's replies",
  "subprocessors.row.gemini.data": "The text of a tutoring turn and the context sent with it",
  "subprocessors.row.groq.purpose": "Fallback model for replies, and speech-to-text for voice",
  "subprocessors.row.groq.data": "The text of a tutoring turn; recorded audio when voice is used",
  "subprocessors.row.posthog.purpose": "Product analytics — only for accounts that opted in, never under-18s",
  "subprocessors.row.posthog.data": "Page views, a few product events, an account identifier",
  "subprocessors.row.cloudflare.purpose": "Turnstile bot protection on public forms and sign-up",
  "subprocessors.row.cloudflare.data": "A challenge token and network metadata",
  "subprocessors.row.resend.purpose": "Transactional email — invitations, decisions, receipts",
  "subprocessors.row.resend.data": "Email address and the message content",
  "subprocessors.row.cinetpay.purpose": "Card and mobile-money payments",
  "subprocessors.row.cinetpay.data": "Payment details and the amount. We never store full card numbers",
  "subprocessors.row.classroom.purpose": "Optional LMS import, only for schools that connect it",
  "subprocessors.row.classroom.data": "Course and roster data the school chooses to share",
  "subprocessors.require.h2": "What we require of them",
  "subprocessors.require.li1": "They process data only on our documented instructions, for the purpose named above.",
  "subprocessors.require.li2":
    "We use model providers on their API terms, which do not feed content into training of their public models.",
  "subprocessors.require.li3":
    "Transfers outside the EEA or the UK must be covered by Standard Contractual Clauses or an adequacy decision — see the note above on where we are with that.",
  "subprocessors.require.li4": "They are bound to confidentiality and to appropriate security.",
  "subprocessors.changes.h2": "Changes",
  "subprocessors.changes.a":
    "We update this page before a new sub-processor starts handling school data, and notify school administrators by email. A school may object on reasonable data protection grounds — see the",
  "subprocessors.changes.dpaLink": "data processing addendum",
  "subprocessors.worksWithout.a": "works without several of these. A school that has not connected",
  "subprocessors.worksWithout.b": "Google Classroom is never touched by that row; an account that declined analytics is never touched by PostHog.",
  "subprocessors.questions": "Questions:",

  // ── Feedback page (components/site/pages/FeedbackView.tsx) ────────
  "feedback.type.suggestion": "Suggestion",
  "feedback.type.bug": "Bug",
  "feedback.type.feature": "Feature",
  "feedback.type.praise": "Praise",
  "feedback.title.a": "Your",
  "feedback.title.em": "feedback.",
  "feedback.sub": "A bug, an idea, something you loved or that annoyed you — we want it all, and we read it all.",
  "feedback.done.title": "Thank you!",
  "feedback.done.body": "Your feedback has been sent to the team.",
  "feedback.rating.label": "Rating:",
  "feedback.rating.star.singular": "star",
  "feedback.rating.star.plural": "stars",
  "feedback.form.messagePlaceholder": "Tell us everything…",
  "feedback.form.emailPlaceholder": "Your email if you'd like a reply (optional)",
  "feedback.form.error": "Couldn't send — try again.",
  "feedback.form.sending": "Sending…",
  "feedback.form.send": "Send feedback",

  // ── Survey (components/site/pages/SurveyView.tsx) ──────────────────
  // Option VALUES stored in `answer_choice` stay the stable English strings
  // already collected (see the "value" fields below) so responses stay
  // comparable across languages; only the displayed label is translated.
  "survey.level.primary": "Primary",
  "survey.level.secondaryEarly": "Secondary — early years",
  "survey.level.secondaryExam": "Secondary — exam years",
  "survey.level.higher": "Higher education",
  "survey.other": "Something else",

  "survey.t1.q": "What level do you teach?",
  "survey.t2.q": "How many students do you have per class on average?",
  "survey.t2.o1": "Fewer than 20",
  "survey.t2.o2": "20–35",
  "survey.t2.o3": "35–50",
  "survey.t2.o4": "More than 50",
  "survey.t4.q":
    "Right now, without looking anything up — could you name the three students who are most lost, and on what?",
  "survey.t4.o1": "Yes — names and topics",
  "survey.t4.o2": "The names, not the topics",
  "survey.t4.o3": "I'd have to check my records",
  "survey.t4.o4": "Honestly, no",
  "survey.t7.q": "How do you usually find out a student didn't understand?",
  "survey.t7.o1": "The test, afterwards",
  "survey.t7.o2": "They ask me",
  "survey.t7.o3": "A parent, or the next teacher",
  "survey.t7.o4": "Often I don't",
  "survey.t5.q":
    "Since your students started using AI, does the work they hand in tell you more or less about how they actually think?",
  "survey.t5.o1": "Much less",
  "survey.t5.o2": "A little less",
  "survey.t5.o3": "No change",
  "survey.t5.o4": "More",
  "survey.t8.q": "Last one. What part of your job has no tool ever helped with?",
  "survey.t8.placeholder": "One sentence is plenty.",

  "survey.s1.q": "Where are you in school?",
  "survey.s2.q": "When you're stuck on a problem, what do you do?",
  "survey.s2.o1": "Ask a friend",
  "survey.s2.o2": "Search YouTube / Google",
  "survey.s2.o3": "Ask an AI (ChatGPT, Gemini, Copilot…)",
  "survey.s2.o4": "Give up",
  "survey.s4.q": "Do you already use AI tools for your homework?",
  "survey.s4.o1": "Yes, often",
  "survey.s4.o2": "Yes, sometimes",
  "survey.s4.o3": "I tried but stopped",
  "survey.s4.o4": "Never",
  "survey.s7.q": "Has a teacher ever thought you understood something you didn't?",
  "survey.s7.o1": "Often",
  "survey.s7.o2": "Once or twice",
  "survey.s7.o3": "Never",
  "survey.s7.o4": "Yes — and I made sure they thought so",
  "survey.s5.q": "When you don't understand something, who do you tell?",
  "survey.s5.o1": "My teacher",
  "survey.s5.o2": "A friend",
  "survey.s5.o3": "An AI",
  "survey.s5.o4": "Nobody",
  "survey.s6.q": "Last one. What's one thing you wish your teacher knew about how you're actually doing?",
  "survey.s6.placeholder": "One sentence is plenty — nobody will know it was you.",

  "survey.badge.teacher": "Teacher",
  "survey.badge.student": "Student",
  "survey.other.inputPlaceholder": "Tell us what — a few words is enough.",
  "survey.finish": "Finish",
  "survey.submitError": "Couldn't submit — try again.",
  "survey.skip": "Skip this question →",

  "survey.done.title": "Thank you.",
  "survey.done.body.a": "Your answers feed straight into",
  "survey.done.body.b": "Leave your email if you want early access when the beta is ready.",
  "survey.done.earlyAccess": "Early access",
  "survey.done.saved": "Noted — see you soon!",
  "survey.done.shareFreely": "Share freely",
  "survey.done.backHome": "Back home",

  "survey.wall.profile.anonymous": "Anonymous",
  "survey.wall.title": "Tell us what you think.",
  "survey.wall.sub": "No questions, no form. Just a space to express yourself freely. What you write here feeds straight into the product.",
  "survey.wall.placeholder": "What I really miss in today's education tools is…",
  "survey.wall.postError": "Couldn't post — try again.",
  "survey.wall.posting": "Posting…",
  "survey.wall.post": "Post",
  "survey.wall.resonates": "Resonates",
  "survey.wall.important": "Important",

  "survey.tab.freeWall": "Free wall",
  "survey.badge.rd": "R&D · 5 minutes · Anonymous",
  "survey.hero.title": "Do you teach or do you learn?",
  "survey.hero.em": "Tell us what's really getting in the way.",
  "survey.hero.sub.p1": "questions,",
  "survey.hero.sub.p2": "of them a single tap.",
  "survey.hero.sub.p3": "No account needed. Your answers feed directly into",
  "survey.cta.teacher": "I'm a teacher",
  "survey.cta.student": "I'm a student",
  "survey.cta.shareFreely": "Or share freely →",
  "survey.stats.responses": "responses collected",
  "survey.stats.stories": "stories shared",

  // ── Full pricing page (components/site/pages/PricingView.tsx) ─────
  // Plan names/descriptions/features and the compare-table rows are seeded
  // server-side data (lib/billing, lib/entitlements), not UI copy — out of
  // scope here, same as CMS content elsewhere. Only the chrome around them
  // is keyed.
  "pricing.lead": "Solo starts free and stays free. Schools pay per enrolled student — their size, not per active user.",
  "pricing.audience.schools": "Schools",
  "pricing.cta.startPilot": "Start free pilot",
  "pricing.cta.createAccount": "Create an account",
  "pricing.cta.get": "Get",
  // Signed-in variants: the visitor already has an account, so the CTA takes
  // them straight to where the plan actually lives instead of back through
  // /login (which only re-resolves to the same place, one hop later).
  "pricing.cta.manageBilling": "Manage billing",
  "pricing.cta.continue": "Continue to Raya",
  "pricing.recommended": "RECOMMENDED",
  "pricing.term.monthly": "Monthly",
  "pricing.term.annual": "Annual",
  "pricing.term.ariaLabel": "Billing term",
  "pricing.save": "save",
  "pricing.free": "Free",
  "pricing.orAnnual.a": "or",
  "pricing.orAnnual.perStudent": "/ student",
  "pricing.orAnnual.b": "/ mo billed annually",
  "pricing.annualBilled.perSeat": "billed annually, per enrolled student",
  "pricing.annualBilled.once": "billed once a year",
  "pricing.compare.title": "Every plan, line by line",
  "pricing.compare.sub": "Exactly what each plan unlocks, and up to what limit.",
  "pricing.schoolsNote.a": "Billed",
  "pricing.schoolsNote.strong": "annually, per enrolled student",
  "pricing.schoolsNote.b": "(your declared size) — a school of 800 pays for 800, whether 250 or all of them use",
  "pricing.schoolsNote.c":
    "that month. Quarterly and monthly terms available. Every school starts with a free pilot; talk to us for a quote.",
  "pricing.questionsFooter": "Questions about a plan?",
  "pricing.unit.perYear": "/ yr",
  "pricing.unit.perStudentPerMonth": "/ student / mo",
  "pricing.unit.perMonth": "/ mo",

  // ── Terms of Service (components/site/pages/TermsView.tsx) ────────
  // Legal text — translated for reach, same as the rest of the site, but this
  // is the one place on the site where an AI translation carries real risk if
  // relied on in a dispute. Flagged to the maintainer; not a reason to skip it.
  "terms.title.a": "Terms of",
  "terms.title.em": "service.",
  "terms.intro.a": "These terms cover your use of Bluestift and",
  "terms.intro.b":
    ". Using the product means you accept them. If you are using Bluestift through your school, your school's agreement with us also applies and takes precedence where the two differ.",
  "terms.s1.h2": "1. Who can use Bluestift",
  "terms.s1.li1.strong": "13 and over",
  "terms.s1.li1.body": "— you can open an account yourself. If you are under 18 you should have your parent or guardian's permission.",
  "terms.s1.li2.strong": "Under 13",
  "terms.s1.li2.a":
    "— only through a school that has enrolled you. We do not open accounts for under-13s who sign up on their own; see the",
  "terms.s1.li2.link": "privacy policy",
  "terms.s1.li2.b": "for why.",
  "terms.s1.li3": "We ask everyone their year of birth and act on the answer. Giving a false one to get past that is a breach of these terms.",
  "terms.s2.h2": "2. Your account",
  "terms.s2.a": "You are responsible for what happens under your account. If you use an anonymous account, the",
  "terms.s2.strong": "recovery key is the only way back in",
  "terms.s2.b":
    "— we cannot restore it for you, and anyone holding it has full access. Keep it private, and add an email if you would rather not carry that risk.",
  "terms.s3.h2": "3. What Raya is, and is not",
  "terms.s3.p1.a": "is an AI tutor. It teaches by asking rather than answering, and",
  "terms.s3.p1.strong": "it can be wrong",
  "terms.s3.p1.b":
    "Check anything that matters — a grade, an exam answer, a fact you are about to rely on. It is not a substitute for a teacher, and it is not professional advice of any kind: not medical, not legal, not financial, not psychological.",
  "terms.s3.p2.a": "If a conversation ever suggests a student is at risk of harm, please involve a responsible adult.",
  "terms.s3.p2.b": "is a study tool, not a crisis service.",
  "terms.s4.h2": "4. Acceptable use",
  "terms.s4.intro": "Do not use Bluestift to:",
  "terms.s4.li1": "break the law, or help anyone else do so;",
  "terms.s4.li2":
    "cheat where your school forbids it — a tutor that does your homework for you is not what this is, and your school sets that rule, not us;",
  "terms.s4.li3": "harass anyone, or upload content that is abusive, hateful or sexual, especially involving minors;",
  "terms.s4.li4": "upload material you have no right to share, or someone else's personal data without a reason to;",
  "terms.s4.li5": "attack, scrape or overload the service, evade rate limits, or attempt to reach another user's data.",
  "terms.s5.h2": "5. Your content",
  "terms.s5.p1.a":
    "What you write and upload stays yours. You give us the permission we need to store it, process it and show it back to you — and to send it to a model provider so that",
  "terms.s5.p1.b": "can reply. Nothing more.",
  "terms.s5.p2":
    "We do not use your content to improve our models unless you switch that on in your settings, and the option is not offered on accounts belonging to under-18s.",
  "terms.s6.h2": "6. School accounts",
  "terms.s6.a": "If you join through a class code, your school sees your name, your class and your results. It does not see your conversations with",
  "terms.s6.b": ". Your school administers your access and can remove it. The terms we operate under are in the",
  "terms.s6.link": "data processing addendum",
  "terms.s7.h2": "7. Paid plans",
  "terms.s7.p1.a": "Prices and what each plan includes are on the",
  "terms.s7.p1.link": "pricing page",
  "terms.s7.p1.b":
    ". Subscriptions renew for the term you chose until cancelled, and cancelling stops the next renewal rather than refunding the current one. Where consumer law gives you a right of withdrawal, that right applies and overrides this paragraph. School plans are billed per seat under the school's own agreement.",
  "terms.s7.p2": "We may change prices. Existing subscribers keep their price until the end of the term they have paid for.",
  "terms.s8.h2": "8. Availability",
  "terms.s8.body":
    "We work to keep Bluestift running but do not promise it will never be down. We may change or discontinue features. If we discontinue something a school is paying for, we will refund the unused balance.",
  "terms.s9.h2": "9. Ending it",
  "terms.s9.a": "You can delete your account at any time from",
  "terms.s9.link": "your settings",
  "terms.s9.b":
    ". It is immediate and cannot be undone. We may suspend or close an account that breaches these terms, or that puts other users or the service at risk — and where we can, we will say why first.",
  "terms.s10.h2": "10. Liability",
  "terms.s10.a":
    "Bluestift is provided as it is. To the extent the law allows, we are not liable for indirect or consequential loss, or for decisions taken on the strength of something",
  "terms.s10.b":
    "said — see §3. Nothing here limits liability that cannot legally be limited, including for death or personal injury caused by negligence, or for fraud. Where our liability is capped, it is capped at what you paid us in the twelve months before the claim.",
  "terms.s11.h2": "11. Changes",
  "terms.s11.body":
    "We will update these terms as the product changes and revise the date above. For material changes we will give notice in the product or by email before they take effect.",
  "terms.s12.h2": "12. Governing law",
  "terms.s12.body":
    "Bluestift is established in the United States, and these terms are governed by the law of the US state in which it is established, whose courts have jurisdiction — except that consumers keep the protection of the mandatory laws of the country where they live, and may bring proceedings there. We will name that state here as soon as the company is formally incorporated.",
  "terms.contact.a": "Questions about any of this:",
  "terms.contact.b": ". For data protection specifically:",

  // ── Privacy policy (components/site/pages/PrivacyView.tsx) ─────────
  "privacy.title.a": "Privacy",
  "privacy.title.em": "policy.",
  "privacy.intro.a": "Bluestift builds",
  "privacy.intro.b":
    ", an AI tutor for students, and a companion dashboard for schools. This page explains what we hold, why we are allowed to hold it, how long we keep it, and what you can do about it. It is written to be read, not to be survived.",

  "privacy.short.h2": "The short version",
  "privacy.short.li1.a": "You can start anonymously — no email required to try",
  "privacy.short.li2.a": "Analytics is",
  "privacy.short.li2.strong": "opt-in",
  "privacy.short.li2.b": ", and switched off entirely for anyone under 18. Declining changes nothing about how the product works.",
  "privacy.short.li3.a": "On an adult account, your work",
  "privacy.short.li3.strong": "is",
  "privacy.short.li3.b":
    "used to improve our models unless you switch that off — one toggle in your settings, effective immediately. For under-18s it is never used, and the option isn't offered at all.",
  "privacy.short.li4.a": "If your account is",
  "privacy.short.li4.strong": "linked to a school",
  "privacy.short.li4.b": ", your progress is visible to your teachers. If it is linked to nobody, nothing about your learning leaves your account.",
  "privacy.short.li5": "No ads. No selling data. No cross-site tracking.",
  "privacy.short.li6.a": "You can download everything we hold, or delete your account outright, from",
  "privacy.short.li6.link": "your settings",
  "privacy.short.li6.b": "— no request form, no waiting.",

  "privacy.age.h2": "Children and age",
  "privacy.age.p1":
    "We ask everyone the year they were born. We store the year, never a full date of birth, and we ask it neutrally rather than as “are you over 13?” — a question phrased that way just tells a child which answer opens the door.",
  "privacy.age.under13.strong": "Under 13.",
  "privacy.age.under13.body":
    "We do not knowingly open accounts for children under 13 on their own. We operate no verifiable parental consent mechanism of our own, so the only route in is a school: a school that adopts Bluestift consents on the parent's behalf for school use, which is the exception COPPA provides at 16 CFR § 312.5(c)(6). A child who signs up alone is stopped at the age question, and we hold nothing but the year they gave us until the account is deleted.",
  "privacy.age.under18.strong": "Under 18.",
  "privacy.age.under18.body":
    "Optional processing is off and cannot be switched on: no product analytics, and no use of their content to improve models. That is stricter than the law strictly requires in some countries — GDPR art. 8 sets the age of digital consent between 13 and 16 depending on the member state — and we would rather be too careful with a 17-year-old than not careful enough with a 13-year-old.",
  "privacy.age.parents.strong": "Parents.",
  "privacy.age.parents.a":
    "You can ask to see, correct or delete your child's data. If they use Bluestift through a school, the fastest route is the school, which can produce their record directly. Either way, write to",
  "privacy.age.parents.b": "and we will help.",

  "privacy.collect.h2": "What we collect, why, and on what basis",
  "privacy.collect.intro.a": "“Legal basis” is the GDPR term for what entitles us to hold something at all. Where it says",
  "privacy.collect.intro.contract": "contract",
  "privacy.collect.intro.b": ", the product cannot work without it. Where it says",
  "privacy.collect.intro.consent": "consent",
  "privacy.collect.intro.c": ", you chose it and can un-choose it.",
  "privacy.collect.table.what": "What",
  "privacy.collect.table.why": "Why",
  "privacy.collect.table.basis": "Legal basis",
  "privacy.collect.r1.what": "Account — a random identifier, a username, a display name, and an email if you add one",
  "privacy.collect.r1.why": "To have an account at all, and to get you back into it",
  "privacy.collect.r1.basis": "Contract",
  "privacy.collect.r2.what": "Year of birth",
  "privacy.collect.r2.why": "To apply the age rules above",
  "privacy.collect.r2.basis": "Legal obligation",
  "privacy.collect.r3.what": "Your conversations, uploads and generated study material",
  "privacy.collect.r3.why": "To tutor you, and to let you come back to your work",
  "privacy.collect.r3.basis": "Contract",
  "privacy.collect.r4.what": "Learning signals — what you've worked on and where you struggle",
  "privacy.collect.r4.why": "To adapt the tutoring, and to show your teachers class-level progress",
  "privacy.collect.r4.basis": "Contract",
  "privacy.collect.r5.what": "School enrolment — your real name, class and year, held for your school",
  "privacy.collect.r5.why": "So your school can identify you in its own dashboard",
  "privacy.collect.r5.basis": "Contract (with your school)",
  "privacy.collect.r6.what": "Product analytics",
  "privacy.collect.r6.why": "To see which features actually help",
  "privacy.collect.r6.basis": "Consent — off until you accept, never for under-18s",
  "privacy.collect.r7.what": "Using your content to improve our models",
  "privacy.collect.r7.why": "To make the tutor better",
  "privacy.collect.r7.basis": "Consent — on by default on adult accounts, switchable off at any time; never for under-18s",
  "privacy.collect.r8.what": "Sending your progress to your school",
  "privacy.collect.r8.why": "So your teachers can see who is stuck and on what",
  "privacy.collect.r8.basis": "Contract (with your school) — only while your account is linked to one",
  "privacy.collect.r9.what": "Server logs and a coarse network signal",
  "privacy.collect.r9.why": "To stop spam, abuse and runaway automated sign-ups",
  "privacy.collect.r9.basis": "Legitimate interests",
  "privacy.collect.r10.what": "Payment records",
  "privacy.collect.r10.why": "To take payment and keep the books",
  "privacy.collect.r10.basis": "Contract / legal obligation",
  "privacy.collect.footer": "We do not use your content to advertise to you, and we do not sell or share personal information in the sense US state privacy laws give those words.",

  "privacy.kernel.h3": "What Raya keeps about how you learn",
  "privacy.kernel.a": "To tutor properly,",
  "privacy.kernel.b":
    "maintains a model of your understanding — which concepts you have grasped, how confidently, and how you tend to approach difficulty. You do not see this model in the interface, which is exactly why it is included in full in the data export below. It is yours to look at.",

  "privacy.analytics.h2": "Analytics & cookies",
  "privacy.analytics.p1.a": "Product analytics is provided by",
  "privacy.analytics.p1.strong": "PostHog",
  "privacy.analytics.p1.b":
    "and is strictly opt-in. Until you accept the banner, the analytics library is never even downloaded — no events, on your device or on our servers. If you accept, we record page views and a few product actions tied to your account identifier, so we can measure real usage. You can decline and use everything.",
  "privacy.analytics.p2.a": "You can withdraw that consent whenever you like from",
  "privacy.analytics.p2.link": "your settings",
  "privacy.analytics.p2.b": ", with one switch. It is as easy to withdraw as it was to give, which is what art. 7(3) asks for.",
  "privacy.analytics.p3":
    "Cookies are minimal: one to keep you signed in, one to remember your analytics choice so we stop asking, and one to remember which school you are looking at if you belong to several. There are no advertising or cross-site tracking cookies.",

  "privacy.who.h2": "Who processes data for us",
  "privacy.who.p1.a": "A short list, each one only for what it is named for. The current sub-processors, with what they hold and where, are on the",
  "privacy.who.p1.link": "sub-processors page",
  "privacy.who.p1.b": ", which we keep up to date as they change.",
  "privacy.who.p2.a": "Text you send to",
  "privacy.who.p2.b": "is processed by large-language-model providers to generate a reply. We use them on their API terms, which do not feed that content into training of their public models.",
  "privacy.who.p3.a":
    "Some of these providers operate outside the EEA and the UK. Those transfers need to be covered by the European Commission's Standard Contractual Clauses or an adequacy decision, and we are working through that provider by provider as a newly launched company. The",
  "privacy.who.p3.link": "sub-processors page",
  "privacy.who.p3.b": "says where we are rather than claiming it is finished.",

  "privacy.retention.h2": "How long we keep it",
  "privacy.retention.table.what": "What",
  "privacy.retention.table.howLong": "How long",
  "privacy.retention.r1.what": "Your account and its content",
  "privacy.retention.r1.how": "While the account is active",
  "privacy.retention.r2.what": "Anonymous accounts that are never used",
  "privacy.retention.r2.how": "Deactivated after 60 days of inactivity, deleted after 180",
  "privacy.retention.r3.what": "School records",
  "privacy.retention.r3.how": "For the school's contracted term, then returned or destroyed at its instruction",
  "privacy.retention.r4.what": "Payment records",
  "privacy.retention.r4.how": "As long as accounting and tax rules require",
  "privacy.retention.r5.what": "The log that a data request happened",
  "privacy.retention.r5.how": "Kept after the data itself is deleted — it is the proof we deleted it",
  "privacy.retention.footer":
    "When you delete your account, we delete the account, your conversations, your uploads, your results and the cognitive profile — including the parts of it held in systems that no automatic cascade would have reached. Payment records survive, because art. 17(3)(b) requires them to.",

  "privacy.rights.h2": "Your rights",
  "privacy.rights.p1":
    "If you are in the EU, the UK or a US state with a privacy law, you have rights of access, correction, deletion, portability, and objection to certain processing, and you may withdraw consent at any time. Two of those are wired straight into the product:",
  "privacy.rights.li1.strong": "Access & portability.",
  "privacy.rights.li1.a": "Download everything we hold as a JSON file from",
  "privacy.rights.li1.link": "your settings",
  "privacy.rights.li2.strong": "Erasure.",
  "privacy.rights.li2.body": "Delete your account from the same page. It is immediate and cannot be undone.",
  "privacy.rights.contact.a":
    "For anything else — a correction, an objection, a question about the year of birth on file — write to",
  "privacy.rights.contact.b":
    ". We do not charge for any of this, and we do not treat you differently for asking. If you are in the EEA or the UK you can also complain to your national data protection authority.",

  "privacy.schools.h2": "Schools, students and staff",
  "privacy.schools.p1.a": "When a school adopts Bluestift, the",
  "privacy.schools.p1.strong1": "school",
  "privacy.schools.p1.b":
    "decides what is collected about its students and we act on its instructions — it is the controller, we are the processor. In US terms we act as a",
  "privacy.schools.p1.strong2": "school official",
  "privacy.schools.p1.c":
    "with a legitimate educational interest under FERPA (34 CFR § 99.31(a)(1)): we use student data only to provide the service, we do not re-disclose it, and we return or destroy it when the contract ends. The terms are set out in the",
  "privacy.schools.p1.link": "data processing addendum",
  "privacy.schools.p2":
    "Staff see their own classes, not the school at large. A parent exercising the FERPA right to inspect and review their child's record asks the school, which can produce it from its dashboard.",
  "privacy.schools.p3.a": "One thing that record deliberately leaves out: a student's own conversations with",
  "privacy.schools.p3.b":
    "A tutor you believe is being read over your shoulder is a tutor you stop asking real questions of, and the tutoring stops working. Those conversations are available in full through the student's own export.",

  "privacy.disclaimer": "This page describes what our systems do. It is not legal advice, and it is not a substitute for the contract your school signs with us.",

  "privacy.changes.h2": "Changes & contact",
  "privacy.changes.a": "We will update this page when our practices change and revise the date above. Questions, requests, or concerns:",

  // ── Schools DPA (components/site/pages/DpaView.tsx) ────────────────
  "dpa.title.a": "Data processing",
  "dpa.title.em": "addendum.",
  "dpa.intro":
    "This addendum applies whenever a school, district or other education institution uses Bluestift with its students. It forms part of the agreement between us and sets out what we do with student data, and what we will never do with it.",
  "dpa.shortVersion":
    "Short version: the school owns the data, we only process it to run the service, we do not sell it, we do not use it to build a profile for any purpose other than tutoring that student, and we give it back or destroy it when the school says so.",

  "dpa.s1.h2": "1. Who is who",
  "dpa.s1.p1.a": "The",
  "dpa.s1.p1.strong1": "school is the controller",
  "dpa.s1.p1.b": "of its students' personal data and decides what is collected and why.",
  "dpa.s1.p1.strong2": "We are the processor",
  "dpa.s1.p1.c": "and act only on the school's documented instructions — using the service as configured counts as those instructions.",
  "dpa.s1.p2.a": "For students who sign up on their own, outside any school, we are the controller and our",
  "dpa.s1.p2.link": "privacy policy",
  "dpa.s1.p2.b": "governs instead.",

  "dpa.s2.h2": "2. What we process",
  "dpa.s2.li1.strong": "Subject matter:",
  "dpa.s2.li1.body": "providing an AI tutor and a staff dashboard.",
  "dpa.s2.li2.strong": "Duration:",
  "dpa.s2.li2.body": "the term of the school's subscription, plus the deletion window in §9.",
  "dpa.s2.li3.strong": "Data subjects:",
  "dpa.s2.li3.body": "the school's students and its staff.",
  "dpa.s2.li4.strong": "Categories:",
  "dpa.s2.li4.body":
    "identity (name, class, year), account data, work submitted to the tutor, assessment results, and the learning signals derived from them.",

  "dpa.s3.h2": "3. FERPA — we act as a school official",
  "dpa.s3.p1.a": "The school designates us a",
  "dpa.s3.p1.strong": "school official with a legitimate educational interest",
  "dpa.s3.p1.b": "in student education records under 34 CFR § 99.31(a)(1). On that basis we commit that:",
  "dpa.s3.li1": "We perform a function the school would otherwise perform with its own staff.",
  "dpa.s3.li2.a": "We are under the school's",
  "dpa.s3.li2.strong": "direct control",
  "dpa.s3.li2.b": "with respect to the use and maintenance of education records.",
  "dpa.s3.li3.a": "We use education records",
  "dpa.s3.li3.strong1": "only",
  "dpa.s3.li3.b": "for the purpose the school engaged us for, and",
  "dpa.s3.li3.strong2": "do not re-disclose",
  "dpa.s3.li3.c": "them to anyone else except as §5 permits.",
  "dpa.s3.li4": "We maintain a record of disclosures of a student's record, which the school can request.",
  "dpa.s3.p2.strong": "Inspect and review.",
  "dpa.s3.p2.a":
    "A parent or eligible student exercises that right with the school. Staff can produce a student's record from the dashboard at any time. That record covers identity, enrolment, results, inferred understanding and staff notes — but not the student's own conversations with",
  "dpa.s3.p2.b": ", for the reason set out in §7.",

  "dpa.s4.h2": "4. COPPA — consent for under-13s",
  "dpa.s4.p1.a":
    "We do not open accounts for children under 13 who arrive on their own; they are stopped at the age question. Under-13s reach",
  "dpa.s4.p1.b": "only through a school.",
  "dpa.s4.p2.a": "By enrolling students under 13,",
  "dpa.s4.p2.strong": "the school confirms that it consents on behalf of their parents",
  "dpa.s4.p2.b":
    "for the school's educational use, as the COPPA school-consent exception permits (16 CFR § 312.5(c)(6)), and that it has given parents notice of what we collect. We collect from children only what the service needs, never condition participation on more, and never use a child's data for advertising or profiling outside tutoring. On a parent's request, relayed by the school, we delete a child's data.",

  "dpa.s5.h2": "5. Sub-processors",
  "dpa.s5.p1.a": "We use the providers listed on our",
  "dpa.s5.p1.link": "sub-processors page",
  "dpa.s5.p1.b":
    ", which also states, honestly, which of those agreements are already signed and which are still being put in place — we have only just launched. Whatever their status, we remain responsible to you for what those providers do.",
  "dpa.s5.p2":
    "We update that page and notify school administrators before a new sub-processor starts handling school data. A school may object on reasonable data protection grounds within 30 days; if we cannot offer an alternative, the school may terminate the affected part of the service and be refunded the unused balance.",

  "dpa.s6.h2": "6. Security",
  "dpa.s6.li1": "Data is encrypted in transit and at rest by our infrastructure provider.",
  "dpa.s6.li2":
    "Access is enforced in the database itself with row-level security, so a teacher reaches their own classes and no others — not merely because the interface hides the rest.",
  "dpa.s6.li3": "Staff access is scoped by role, and privileged operations run server-side only.",
  "dpa.s6.li4": "Everyone with access is bound to confidentiality.",
  "dpa.s6.p1.strong": "Breach notification.",
  "dpa.s6.p1.body":
    "If we suffer a personal data breach affecting a school's data, we notify that school without undue delay and in any event within 72 hours of becoming aware, with what we know and what we are doing about it.",

  "dpa.s7.h2": "7. What we will not do",
  "dpa.s7.li1": "We do not sell student data. There is no circumstance in which we would.",
  "dpa.s7.li2": "We do not serve advertising, and we do not build advertising profiles.",
  "dpa.s7.li3":
    "We do not use student content to train models unless the account holder explicitly opted in — and that option is not available to under-18s, which is every student in a school setting below sixth form.",
  "dpa.s7.li4":
    "We do not give staff a student's private tutoring conversations. A student who believes their tutor is being read stops asking the questions that make tutoring work, so the staff record covers what the student produced and what the system inferred, not the transcript. The student, or a parent through the student, can export the transcript in full.",

  "dpa.s8.h2": "8. Helping the school meet its obligations",
  "dpa.s8.p1.a":
    "We assist the school with data subject requests (access, correction, deletion, portability), with data protection impact assessments, and with regulator enquiries. Most requests are answerable directly from the dashboard; where they are not, write to",
  "dpa.s8.p1.b": ". If a data subject comes to us directly, we refer them to the school rather than acting on our own.",
  "dpa.s8.p2":
    "We make available the information needed to demonstrate compliance with these obligations and allow for audits, on reasonable notice and without disrupting the service for other schools.",

  "dpa.s9.h2": "9. Return and deletion",
  "dpa.s9.p1.a": "At any time during the term the school can export its students' records. When the contract ends, we delete school data within",
  "dpa.s9.p1.strong": "90 days",
  "dpa.s9.p1.b":
    "at the school's choice of deletion or return, except where a law requires us to keep something — payment records being the usual case.",
  "dpa.s9.p2":
    "Deletion is real. It reaches the learning content, the uploads, the assessment results and the inferred learning model, including the parts held in systems that no automatic cascade would have reached.",

  "dpa.s10.h2": "10. International transfers",
  "dpa.s10.a":
    "Where a sub-processor operates outside the EEA or the UK, transfers must be covered by the European Commission's Standard Contractual Clauses or an adequacy decision. The location of each provider, and the current status of that cover, is on the",
  "dpa.s10.link": "sub-processors page",

  "dpa.footer.a":
    "This page states the commitments we make to every school on the same terms. It is not legal advice. A school that needs a countersigned document, or its own paperwork on top of this, should write to",
  "dpa.footer.b": "and we will arrange it.",

  // ── Theme toggle (components/site/ThemeToggle.tsx — shared with the app shell) ─
  "theme.day": "Day",
  "theme.night": "Night",
  "theme.switchAria": "Switch theme",

  // ── Persistent language switcher (components/site/LanguageSwitcher.tsx) ─
  "site.langSwitcher.ariaLabel": "Choose language",

  // ── Product shot illustrations (components/site/ProductShots.tsx) ──────
  // These are DOM-drawn mock screenshots on the landing page, not the real
  // product (which stays out of i18n scope) — but they render as English
  // prose regardless, so they need the same translation as everything else
  // on the page. Character names (Amira S., Léa D., Maya R., Emma M. …) are
  // left as-is, same as any other proper name; so is "Le passé composé vs
  // imparfait", which names a specific French tense rather than describing
  // anything, and the quoted French example sentence in shot.rung.p2_1.
  "shot.common.you": "You",
  "shot.common.live": "Live",
  "shot.common.enable": "Enable",
  "shot.common.disable": "Disable",
  "shot.common.analyze": "Analyze",
  "shot.common.viewKernelProfile": "View kernel profile",
  "shot.common.thinking": "Thinking…",
  "shot.common.inSession": "in session",
  "shot.common.generate": "Generate",
  "shot.common.study": "Study",
  "shot.common.add": "Add",
  "shot.common.ask": "Ask",
  "shot.common.active": "active",
  "shot.common.online": "online",
  "shot.common.left": "left",
  "shot.common.quiz": "Quiz",
  "shot.common.flashcards": "Flashcards",
  "shot.common.mindMap": "Mind map",
  "shot.common.practiceSet": "Practice set",

  "shot.status.mastered": "Mastered",
  "shot.status.inProgress": "In progress",
  "shot.status.toWork": "To work on",
  "shot.status.falseMastery": "False mastery",
  "shot.status.recurringError": "Recurring error",
  "shot.status.cognitiveOverload": "Cognitive overload",
  "shot.status.passiveDependency": "Passive dependency",

  "shot.axis.knowledge": "Knowledge (K)",
  "shot.axis.retention": "Retention (V)",
  "shot.axis.application": "Application (P)",

  "shot.topic.unitCircle": "The unit circle",
  "shot.topic.photosynthesis": "Photosynthesis",
  "shot.topic.dividingFractions": "Dividing fractions",
  "shot.topic.reciprocals": "Reciprocals & unit fractions",
  "shot.topic.balancingEquations": "Balancing equations",
  "shot.topic.limitsRational": "Limits of a rational function",
  "shot.topic.dividingWhyInvert": "Dividing fractions — why invert?",
  "shot.topic.frenchTenses": "Le passé composé vs imparfait",
  "shot.topic.newtonsLaws": "Newton's laws",
  "shot.topic.cellRespiration": "Cell respiration",
  "shot.topic.photosynthesisLesson4": "Photosynthesis — lesson 4",
  "shot.topic.factoringDiffSquares": "Factoring a difference of squares",
  "shot.topic.trigonometry": "Trigonometry",

  "shot.time.twoDaysAgo": "2 days ago",
  "shot.time.yesterday": "yesterday",
  "shot.time.today": "today",

  "shot.subject.mathematics": "Mathematics",
  "shot.subject.french": "French",

  "shot.year.8": "Year 8",
  "shot.year.9": "Year 9",
  "shot.year.10": "Year 10",
  "shot.year.11": "Year 11",

  "shot.kernel.yourProfile": "Your profile",
  "shot.kernel.meta": "14 concepts · 4 subjects",
  "shot.kernel.overallMastery": "Overall mastery",
  "shot.kernel.allConcepts": "all concepts",
  "shot.kernel.mindset": "Mindset (M)",
  "shot.kernel.growth": "Growth",
  "shot.kernel.growthDesc": "Keeps going after a wrong answer.",
  "shot.kernel.lastUnitCircle": "practised 2 days ago",
  "shot.kernel.lastPhotosynthesis": "practised yesterday",
  "shot.kernel.lastDividingFractions": "practised today",

  "shot.room.tabGroupChat": "Group chat",
  "shot.room.tabPrivate": "(private)",
  "shot.room.tabChallenges": "Challenges",
  "shot.room.tabFiles": "Files",
  "shot.room.tabReport": "Report",
  "shot.room.turn1": "I get sin(150°) = 0.5 but I can't say why it's positive.",
  "shot.room.turn2": "Second quadrant, right?",
  "shot.room.turn3": "It is — so you have the hard part. What's the sign of y there, and which ratio uses y?",
  "shot.room.turn4": "y is above the axis, so sine stays positive.",
  "shot.room.membersLine": "Mathematics · 5 members",
  "shot.room.docTitle": "Chapter 6 — The unit circle.pdf",
  "shot.room.sharedPrefix": "shared a document:",
  "shot.room.composerPlaceholder": "Message the room…",
  "shot.room.composerDraft": "so cos(150°) is negative for the same reason",

  "shot.tools.quizMcq": "Quiz (MCQ)",
  "shot.tools.title": "Tools Studio",
  "shot.tools.subtitle": "Generate quizzes, summaries and flashcards from any lesson.",
  "shot.tools.dropzone": "Drop one or more files (PDF, notes, Word, Excel, audio) — they combine into one packet",
  "shot.tools.dropzoneMeta": "Up to 40 MB total · 6.2 MB used",
  "shot.tools.readingSources": "Reading 3 sources…",
  "shot.tools.generatedLabel": "Generated",
  "shot.tools.fileLesson4": "Photosynthesis — lesson 4.pdf",
  "shot.tools.fileCellResp": "Cell respiration.docx",
  "shot.tools.fileLabNotes": "Lab notes 12 Mar.m4a",
  "shot.tools.libQuizNewton": "Quiz — Newton's laws",
  "shot.tools.libFlashUnitCircle": "Flashcards — The unit circle",
  "shot.tools.libMindMapFrench": "Mind map — Le passé composé",
  "shot.tools.libSummaryPhoto": "Summary — Photosynthesis, lesson 4",
  "shot.tools.metaNewton": "12 questions · 88%",
  "shot.tools.metaUnitCircle": "24 cards · 4 Mar",
  "shot.tools.metaFrench": "9 branches · 2 Mar",
  "shot.tools.metaGenerating": "generating",

  "shot.focus.instructionsTo": "Instructions to",
  "shot.focus.subtitle": "Guidance only — it never gives answers away.",
  "shot.focus.instr1": "Revise the unit circle before Friday",
  "shot.focus.instr2": "Push them on essay structure, not spelling",
  "shot.focus.instr3": "Ask for the reasoning before the formula",
  "shot.focus.instr4": "Go slower on molar mass",
  "shot.focus.subj1": "Mathematics · Year 10",
  "shot.focus.subj2": "French · Year 8",
  "shot.focus.subj3": "Physics · Year 11",
  "shot.focus.subj4": "Chemistry · Year 11",
  "shot.focus.composerDraft": "Focus Maya on dividing fractions",
  "shot.focus.subjectSelect": "Maths ▾",
  "shot.focus.reachesA": "Reaches",
  "shot.focus.reachesB": "before the student's next session.",

  "shot.guided.headerSubject": "Maya · Year 9 · Mathematics",
  "shot.guided.mat1Meta": "6 questions · from your lesson",
  "shot.guided.mat2Meta": "12 cards · spaced review",
  "shot.guided.recommendedNext": "Recommended next",
  "shot.guided.turn1": "Before we start — when you divide by a fraction, does the answer get bigger or smaller?",
  "shot.guided.turn2": "Smaller… I think?",
  "shot.guided.turn3": "Let's test it. 6 ÷ ½ — how many halves fit inside 6?",
  "shot.guided.turn4": "Twelve. Oh — it got bigger.",

  "shot.return.title": "Students to focus on",
  "shot.return.openFocus": "Open Focus →",
  "shot.return.tracked": "Tracked",
  "shot.return.needAttention": "Need attention",
  "shot.return.avgMastery": "Avg. mastery",
  "shot.return.prereqTitle": "Shared blocking prerequisite",
  "shot.return.prereqBody": "Dividing fractions gates 3 later concepts, for 2 of them.",
  "shot.return.footer": "Mastery only. Never the conversation.",

  "shot.socratic.newSession": "+ New session",
  "shot.socratic.rayaPlus": "Raya Plus",
  "shot.socratic.forYou": "For you",
  "shot.socratic.kernelAnalysis": "Kernel analysis",
  "shot.socratic.rootGap": "Root gap:",
  "shot.socratic.summaryLabel": "Summary:",
  "shot.socratic.summaryBody":
    "Reads the 0/0 right, but doesn't reach for factoring unprompted. The limit isn't the gap — the algebra under it is.",
  "shot.socratic.confidence": "Confidence:",
  "shot.socratic.kcs": "KCs:",
  "shot.socratic.model": "Model:",
  "shot.socratic.writeReplyTo": "Write your reply to",
  "shot.socratic.turn1": "Before I say anything — what happens to (x² − 9)/(x − 3) when you put x = 3 in?",
  "shot.socratic.turn2": "It gives 0/0. I already tried that.",
  "shot.socratic.turn3": "Good — so the work is done. What does a 0/0 tell you about a factor the top and the bottom might share?",
  "shot.socratic.turn4": "…that (x − 3) is in both?",
  "shot.socratic.turn5": "That's the piece that was missing. Cancel it first, then substitute. Try it and tell me what you land on.",
  "shot.socratic.turn6": "6. And I can see why now.",
  "shot.socratic.forYou1": "Exam fortnight: short sessions, no marathons.",
  "shot.socratic.forYou1Source": "Your school",
  "shot.socratic.forYou2": "Ask for the algebra before the limit.",
  "shot.socratic.forYou3": "Two attempts before a worked example.",
  "shot.socratic.forYou3Source": "Your teacher",

  "shot.rung.p1_1": "Just give me the answer to question 4 — why do plants need light?",
  "shot.rung.p1_2": "Not yet. You've met this one already. What do you think the light is being used for inside the leaf?",
  "shot.rung.p1_3": "To make food? Sugar, I think.",
  "shot.rung.p1_4": "That's the word I wanted. Made out of what, though — a leaf can't make sugar out of nothing.",
  "shot.rung.p2_1": "«Je mangeais quand il est arrivé» — I had both in the imparfait first and it felt wrong.",
  "shot.rung.p2_2": "Your ear was right. One of those two verbs is the background and the other interrupts it. Which is which?",
  "shot.rung.p2_3": "Eating is the background?",
  "shot.rung.p2_4": "Say why, and it'll stick.",
  "shot.rung.p3_1": "Two tries and H2 + O2 → H2O still won't balance. I'm stuck.",
  "shot.rung.p3_2":
    "Then here's the piece you're missing: you may change the number in front of a formula, never the small ones inside it. H₂O has to stay H₂O.",
  "shot.rung.p3_3": "Oh. So 2H2 + O2 → 2H2O.",
  "shot.rung.p4_1": "Before we stop — in your own words, why does dividing by a fraction make the answer bigger?",
  "shot.rung.p4_2": "Because you're asking how many halves fit inside it, and a lot of halves fit.",
  "shot.rung.p4_3": "That's the one. That sentence is what I keep — not the six exercises.",

  // ── Kernel diagrams (components/site/KernelDiagrams.tsx) — the orbit and
  // molecule drawings in the Cognitive Kernel band. The graph's own node
  // labels stay English snake_case in every locale by design (see the file's
  // VOCAB comment): the Kernel pivots through English regardless of the
  // session's language, so that is what a concept is called in the graph.
  // "Raya for Schools" stays as-is too, like "Raya" — a product name.
  "kd.orbit.raya.sub": "the tutor they talk to",
  "kd.orbit.rayaSchools.sub": "same tutor, in class",
  "kd.orbit.homework.name": "Homework & challenges",
  "kd.orbit.homework.sub": "graded work, same student",
  "kd.word.knowledge": "Knowledge",
  "kd.word.velocity": "Velocity",
  "kd.word.persistence": "Persistence",
  "kd.word.mindset": "Mindset",
  "kd.orbit.teacher.name": "Their teacher",
  "kd.orbit.teacher.sub": "reads what came back",
  "kd.orbit.school.name": "The school's programme",
  "kd.orbit.school.sub": "sets the order, not the diagnosis",
  "kd.orbit.chip": "COGNITIVE KERNEL",
  "kd.orbit.learner.name": "The learner",
  "kd.orbit.learner.sub": "one profile, everywhere",
  "kd.orbit.footer": "Updated mid-conversation, read back before the next answer.",

  "kd.subject.history": "History",

  "kd.case.mechanics.chip": "Physics · mechanics",
  "kd.case.thermo.chip": "Chemistry · thermochemistry",
  "kd.case.respiration.chip": "Biology · respiration",

  "kd.note.sessionBroke": "where the session broke",
  "kd.note.actuallyBroke": "where it actually broke",

  "kd.kicker.failed": "Failed",
  "kd.kicker.sitsOn": "Sits on",
  "kd.kicker.whichSitsOn": "Which sits on",
  "kd.kicker.andThatOn": "And that on",
  "kd.kicker.rootCause": "Root cause",
  "kd.kicker.alreadySolid": "Already solid",

  "kd.body.mechanics1": "Missed twice on the same exercise, four days apart.",
  "kd.body.mechanics2": "Checked first, and fine. The forces were drawn correctly.",
  "kd.body.mechanics3": "Also solid on its own. Still not the thing that broke.",
  "kd.body.mechanics4": "Shaky — but it fails the same way every time, so it is a symptom.",
  "kd.body.mechanics5": "Another subject. The derivative under the acceleration never held.",
  "kd.body.mechanics6": "Open the session here. Reteaching them would spend the hour on something known.",

  "kd.body.thermo1": "Right answer, wrong sign, three times running.",
  "kd.body.thermo2": "Fluent. Rates were never the difficulty here.",
  "kd.body.thermo3": "Held up under questioning, including the awkward case.",
  "kd.body.thermo4": "Reliable. Which rules out the obvious explanation.",
  "kd.body.thermo5": "Not chemistry. Energy in and energy out was never a closed book.",
  "kd.body.thermo6": "The way in. Both were solid last week and are solid now.",

  "kd.body.respiration1": "Can recite the stages. Cannot say why any of them happen.",
  "kd.body.respiration2": "Named correctly every time. Recall was never the problem.",
  "kd.body.respiration3": "Fine, and asked about unprompted — a good sign.",
  "kd.body.respiration4": "Solid. The transport story is not where this comes apart.",
  "kd.body.respiration5": "Another subject. Respiration is a redox chain, and redox never landed.",
  "kd.body.respiration6": "Start from these. They are the half of the chain that already works.",

  "kd.legend.crosses": "crosses a subject",
  "kd.stats.concepts": "concepts",
  "kd.stats.prerequisites": "prerequisites",
  "kd.stats.acrossBoundary": "across a boundary",

  "kd.lede.title": "What the Kernel just did with this",
  "kd.lede.sub": "Point at any concept — the tour waits. Hollow means not secure yet.",

  "kd.footer.alertRaised": "Alert raised:",
  "kd.footer.confidence": "confidence",
  "kd.footer.walked": "walked",
  "kd.footer.conceptsAcross": "concepts across",
  "kd.footer.tail": "subjects, and back before the next answer was written.",

  "kd.status.gap": "gap",
  "kd.status.developing": "developing",
  "kd.status.secure": "secure",

  "kd.card.ofThemOther": "of them in another subject",
  "kd.card.pinned": "Pinned — click again to release.",
  "kd.card.clickToPin": "Click to pin it.",

  "kd.card.noteA": "is what is left of",
  "kd.card.noteB": "after",
  "kd.card.day": "day",
  "kd.card.days": "days",
  "kd.card.untouched": "untouched. That drop is the forgetting — it is why a concept can slip while nothing at all happens.",

  // ── Schools dashboard mockup (components/site/DashboardMockup.tsx) ─────
  // Sidebar nav labels, class names (Year N · Subject) and "Overview" reuse
  // the nav.*/shot.year.*/shot.subject.*/onb.subject.* keys already added for
  // the app chrome and ProductShots — see those namespaces. "Northgate
  // Academy" and "Amina Diallo" are the mockup's fictional school and admin,
  // left as-is like any other proper name.
  "dm.students": "Students",
  "dm.activeWeek": "Active (7d)",
  "dm.struggling": "Struggling",
  "dm.avgMastery": "Average mastery",
  "dm.byClass": "by class",
  "dm.studentsWord": "students",
  "dm.activeWord": "active",
  "dm.alertsWord": "alerts",
  "dm.kernelMasteryTitle": "Kernel — overall mastery",
  "dm.studentsTracked": "students tracked",
  "dm.alertsTitle": "Alerts",
  "dm.studentsStruggling": "students struggling",
  "dm.activeOver7Days": "active over 7 days",
  "dm.needsAttention": "Needs attention",
  "dm.schoolPlan": "School plan",

  // ── Position diagram (components/site/PositionShot.tsx) — status words
  // reuse kd.status.developing/secure for the two shared bands; "fragile" is
  // this plate's own, lower, third band.
  "ps.rail.lms.name": "Your LMS",
  "ps.rail.lms.sub": "what was done",
  "ps.rail.raya.sub": "what was understood",
  "ps.rail.tutor.name": "A tutor",
  "ps.rail.tutor.sub": "the moment",
  "ps.oneTerm": "one term",
  "ps.gaugeCaption": "derivatives · right now",
  "ps.status.fragile": "fragile",
  "ps.tuesdayWeek7": "a Tuesday in week 7",
  "ps.lastMarkPrefix": "last mark:",
  "ps.weeksAgo": "weeks ago",
  "ps.noSessionRunning": "no session running — nothing kept",
  "ps.tenDaysLate": "ten days late",
  "ps.ifThatTuesdayRead": "if that Tuesday is read",
  "ps.thatTuesday": "that Tuesday",
  "ps.daysOn": "days on",
  "ps.leftAsItWentA": "Left as it went, the same day reads",
  "ps.leftAsItWentB": "— and the",
  "ps.leftAsItWentC": "is the first anyone hears of it.",
  "ps.footer": "Two of these three layers are already paid for, and neither can answer a question asked on a day with nothing due.",

  // ── Research hub (components/site/pages/ResearchView.tsx) — the Progress
  // tab's own strings live under site.roadmap.*; these are the other three
  // tabs plus the newsletter box and propose-a-contribution form. Reuses
  // research.post.type.* for the four post-type labels and onb.other for
  // the propose form's "Other" category.
  "research.hub.pillVolume": "Volume 1 · Open research",
  "research.hub.h1.a": "What we're learning by",
  "research.hub.h1.em": "building Raya.",
  "research.hub.lead": "Papers, field experiments, and release notes — published as we go, open to everyone.",
  "research.hub.tab.articles": "Articles",
  "research.hub.tab.progress": "Progress",
  "research.hub.tab.newsletter": "Newsletter",
  "research.hub.tab.collaborations": "Collaborations",
  "research.hub.submit": "+ Submit",
  "research.hub.volume1": "Volume 1",
  "research.hub.publications": "publications",
  "research.hub.filterAll": "All",
  "research.hub.featured": "📌 Featured",
  "research.hub.recentPublications": "Recent publications",
  "research.hub.noPublications": "No publications yet.",
  "research.hub.checkedOn": "Checked against the code on",
  "research.hub.archive": "Archive",
  "research.hub.noIssues": "No issues yet.",
  "research.hub.readMore": "Read →",
  "research.hub.collab.title": "Academic collaborations",
  "research.hub.collab.body":
    "BlueStift wants to collaborate with education researchers to validate the Cognitive Kernel. This effort is opening up — if it interests you, write to us.",
  "research.hub.collab.calloutTitle": "Are you an education researcher?",
  "research.hub.collab.calloutBody": "We share our anonymized data and source code with researchers interested in the Cognitive Kernel.",
  "research.hub.contactUs": "Contact us",
  "research.hub.newsletterEyebrow": "Newsletter · Monthly",
  "research.hub.newsletterTitle": "BlueStift Research Digest",
  "research.hub.newsletterTagline": "Kernel advances, field results, recommended reads. Once a month, no spam.",
  "research.hub.subscribeError": "Couldn't subscribe — try again.",
  "research.hub.subscribe": "Subscribe",
  "research.hub.subscribed": "Subscribed! Check your inbox.",
  "research.hub.propose.received": "Proposal received.",
  "research.hub.propose.receivedBody": "We'll review it and reply by email. Thanks for contributing to BlueStift research.",
  "research.hub.propose.backToArticles": "Back to articles",
  "research.hub.propose.back": "← Back",
  "research.hub.propose.title": "Propose a contribution",
  "research.hub.propose.lead": "Paper, field experiment, article or dataset — describe your proposal and the research team will get back to you.",
  "research.hub.propose.namePlaceholder": "Your name",
  "research.hub.propose.categoryPaper": "Academic paper",
  "research.hub.propose.categoryExperiment": "Field experiment",
  "research.hub.propose.titlePlaceholder": "Proposal title",
  "research.hub.propose.descPlaceholder": "Describe your contribution: topic, method, available data…",
  "research.hub.propose.attachment": "Attachment (optional, max 15 MB)",
  "research.hub.propose.sendError": "Couldn't send — try again (file must be under 15 MB).",
  "research.hub.propose.sending": "Sending…",
  "research.hub.propose.send": "Send proposal",

  // ── Entitlements-derived pricing copy (lib/entitlements.ts) — the /pricing
  // page's feature bullets, taglines and comparison table. These are the only
  // consumer of these functions (grep confirms), so unlike the entitlements
  // DATA itself (which also gates the real product) this prose is public-site
  // copy like any other, translated the same way — via a `tr` passed in from
  // the server component, since this is a plain server-only module and can't
  // call the client useTranslate() hook.
  "ent.unlimited": "Unlimited",
  "ent.included": "Included",
  "ent.kept": "Kept",
  "ent.asLongAsYouLike": "As long as you like",
  "ent.privateOrPublic": "Private or public",
  "ent.privateAlways": "Private, always",
  "ent.asAgreed": "As agreed",
  "ent.perDay": "/ day",
  "ent.perMonth": "/ month",
  "ent.perWeek": "/ week",
  "ent.perTeacherPerMonth": "/ teacher / month",
  "ent.perTeacherPerWeek": "/ teacher / week",
  "ent.perRoom": "per room",
  "ent.mb": "MB",
  "ent.minutes": "minutes",
  "ent.years": "years",
  "ent.days": "days",

  "ent.noun.studyGenerations": "study generations",
  "ent.noun.uploads": "uploads",
  "ent.noun.generations": "generations",
  "ent.noun.preps": "preps",
  "ent.noun.aiGradings": "AI gradings",

  "ent.chat.unlimited": "Unlimited AI tutor chat",
  "ent.chat.messagesPerDay": "AI tutor messages / day",

  "ent.raya.free.b1Suffix": "— the core learning loop",
  "ent.raya.free.b3a": "study rooms / month · up to",
  "ent.raya.free.b3b": "peers · always private",
  "ent.raya.free.b4": "days of conversation history",
  "ent.raya.free.b5": "Kernel deep-dive per week",

  "ent.raya.plus.b2": "Voice input & every AI tutor mode",
  "ent.raya.plus.b4": "Mind maps, PDF export, no watermark",
  "ent.raya.plus.b5a": "Unlimited rooms · up to",
  "ent.raya.plus.b5b": "peers · public if you want",
  "ent.raya.plus.b6": "private sessions with Raya in a room / month",
  "ent.raya.plus.b7": "Unlimited chat history & Kernel analysis",

  "ent.raya.max.b1": "Unlimited AI tutor chat, history & Kernel analysis",
  "ent.raya.max.b3": "Unlimited generations & uploads — nothing counted at all",
  "ent.raya.max.b4": "Unlimited private sessions with Raya inside a room",
  "ent.raya.max.b6a": "Room enough for a whole class — up to",
  "ent.raya.max.b6b": "people",
  "ent.raya.max.b7": "attachments & study packets",

  "ent.common.aiFeedbackSelfTests": "AI feedback on self-tests",
  "ent.common.archiveYear": "year of data archive",
  "ent.common.archiveYears": "years of data archive",

  "ent.school.std.b1a": "lesson preps &",
  "ent.school.std.b1b": "AI gradings / teacher / month",
  "ent.school.std.b2": "student simulations / teacher / week",
  "ent.school.std.b3": "report / teacher / week",
  "ent.school.std.b4": "document exports / month",
  "ent.school.std.b5": "Teacher dashboards & per-class insights",

  "ent.school.plus.b2": "Unlimited student simulations, reports & document exports",
  "ent.school.plus.b3": "Teacher dashboards with advanced per-class insights",
  "ent.school.plus.b4": "Automatic daily reports",
  "ent.school.plus.b5": "Follow-ups shared across the teaching team",
  "ent.school.plus.b6": "Your school logo on every document",

  "ent.school.custom.b1": "Unlimited preps, gradings, simulations & exports",
  "ent.school.custom.b2": "Advanced insights, exportable — plus automatic daily reports",
  "ent.school.custom.b3": "Consolidated monitoring across classes and schools",
  "ent.school.custom.b4": "LMS sync, SSO & multi-school administration",
  "ent.school.custom.b6": "Data archive kept for as long as you need it",
  "ent.school.custom.b7": "Bespoke deployment, tuned to your school",

  "ent.tagline.rayaFree": "The whole tutor, capped by the day. Free for good — no trial, no card.",
  "ent.tagline.rayaPlus": "For a student working most days: the tutor unmetered, every tool unlocked.",
  "ent.tagline.rayaMax": "For the heaviest use: nothing counted at all, and room for a whole class.",
  "ent.tagline.schoolStandard": "The core platform for a whole school, priced per enrolled student.",
  "ent.tagline.schoolPlus": "Adds the intelligence layer: advanced insights, daily reports, your own logo.",
  "ent.tagline.schoolCustom": "For a district or a group of schools: nothing capped, LMS sync and SSO.",

  "ent.group.learningWithRaya": "Learning with Raya",
  "ent.group.studyTools": "Study tools",
  "ent.group.studyRooms": "Study rooms",
  "ent.group.teaching": "Teaching",
  "ent.group.insightsReports": "Insights and reports",
  "ent.group.adminData": "Administration and data",

  "ent.row.aiTutorMessages.label": "AI tutor messages",
  "ent.row.aiTutorMessages.hint": "Every exchange with Raya, on any subject.",
  "ent.row.voiceInput.label": "Voice input and tutor modes",
  "ent.row.voiceInput.hint": "Speak instead of typing, and choose how Raya talks to you.",
  "ent.row.convHistory.label": "Conversation history",
  "ent.row.kernelDeepDive.label": "Kernel deep-dive",
  "ent.row.kernelDeepDive.hint": "A full re-read of your concept profile, on demand.",
  "ent.row.aiFeedbackSelfTests.label": "AI feedback on self-tests",
  "ent.row.studyGenerations.label": "Study generations",
  "ent.row.studyGenerations.hint": "One summary, flashcard deck, quiz or mind map made from a lesson.",
  "ent.row.documentUploads.label": "Document uploads",
  "ent.row.mindMaps.label": "Mind maps",
  "ent.row.pdfExport.label": "PDF export, no watermark",
  "ent.row.attachmentSize.label": "Attachment size",
  "ent.row.roomsOpen.label": "Rooms you can open",
  "ent.row.peopleInRoom.label": "People in a room",
  "ent.row.sessionLength.label": "How long a session runs",
  "ent.row.sessionLength.hintA": "A room can carry a",
  "ent.row.sessionLength.hintB": "minute countdown; when it runs out the room turns read-only and the report is still there.",
  "ent.row.roomVisibility.label": "Who can see the room",
  "ent.row.roomVisibility.hint": "Every room starts private. Opening one to everybody is a choice a paid account makes; on Free it is not offered at all.",
  "ent.row.privateSession.label": "Private session with Raya",
  "ent.row.privateSession.hint": "A one-to-one with Raya inside the room, which the other members do not see.",
  "ent.row.groupChallenges.label": "Group challenges per room",
  "ent.row.roomReports.label": "Room reports",

  "ent.row.lessonPreps.label": "Lesson preparations",
  "ent.row.lessonPreps.hint": "A lesson or exercise set prepared for one class, from your own material.",
  "ent.row.aiGrading.label": "AI grading",
  "ent.row.aiGrading.hint": "A batch of student work marked, with the reasoning shown to the teacher.",
  "ent.row.studentSimulations.label": "Student simulations",
  "ent.row.studentSimulations.hint": "A what-if projection of where one student is heading if nothing changes.",
  "ent.row.advancedFollowups.label": "Advanced follow-ups",
  "ent.row.advancedFollowups.hint": "Shared across the teaching team rather than kept by one teacher.",
  "ent.row.reports.label": "Reports",
  "ent.row.autoDailyReports.label": "Automatic daily reports",
  "ent.row.advancedInsights.label": "Advanced insights",
  "ent.row.exportInsights.label": "Export insights",
  "ent.row.exportInsights.hint": "The underlying figures out of the dashboard, not just the view.",
  "ent.row.documentExports.label": "Document exports",
  "ent.row.logoOnDocs.label": "Your logo on every document",
  "ent.row.dataArchive.label": "Data archive",
  "ent.row.dataArchive.hint": "How far back the school's own records stay available to it.",
  "ent.row.lmsSync.label": "LMS sync",
  "ent.row.lmsSync.hint": "Classes and rosters come from the system you already run.",
  "ent.row.sso.label": "Single sign-on",
  "ent.row.multiSchool.label": "Several schools, one account",
  "ent.row.consolidatedMonitoring.label": "Consolidated monitoring",
  "ent.row.consolidatedMonitoring.hint": "Every class of every school on one screen, rather than one at a time.",

  // ── Concept-graph node labels (components/site/KernelDiagrams.tsx) ─────
  // The graph's underlying ids (VOCAB) stay English snake_case forever — the
  // Kernel pivots through English regardless of session language, and the
  // ids double as the story cases' lookup keys. These are the DISPLAY labels
  // shown on canvas and in the reading strip, one per id, translated like
  // anything else a visitor reads. Key names mirror the ids verbatim.
  "voc.counting": "Counting",
  "voc.place_value": "Place value",
  "voc.fractions": "Fractions",
  "voc.decimals": "Decimals",
  "voc.ratio_and_proportion": "Ratio and proportion",
  "voc.percentages": "Percentages",
  "voc.negative_numbers": "Negative numbers",
  "voc.order_of_operations": "Order of operations",
  "voc.algebraic_expressions": "Algebraic expressions",
  "voc.linear_equations": "Linear equations",
  "voc.inequalities": "Inequalities",
  "voc.systems_of_equations": "Systems of equations",
  "voc.quadratic_equations": "Quadratic equations",
  "voc.factoring": "Factoring",
  "voc.polynomials": "Polynomials",
  "voc.exponents": "Exponents",
  "voc.radicals": "Radicals",
  "voc.logarithms": "Logarithms",
  "voc.cartesian_plane": "Cartesian plane",
  "voc.graphing_functions": "Graphing functions",
  "voc.function_notation": "Function notation",
  "voc.domain_and_range": "Domain and range",
  "voc.function_variation": "Function variation",
  "voc.limits": "Limits",
  "voc.derivative_functions": "Derivatives",
  "voc.chain_rule": "Chain rule",
  "voc.optimisation": "Optimisation",
  "voc.integrals": "Integrals",
  "voc.sequences": "Sequences",
  "voc.probability_basics": "Probability basics",
  "voc.standard_deviation": "Standard deviation",

  "voc.units_and_measurement": "Units and measurement",
  "voc.vectors": "Vectors",
  "voc.position_and_displacement": "Position and displacement",
  "voc.velocity": "Velocity",
  "voc.acceleration": "Acceleration",
  "voc.kinematic_equations": "Kinematic equations",
  "voc.projectile_motion": "Projectile motion",
  "voc.newtons_laws": "Newton's laws",
  "voc.free_body_diagrams": "Free body diagrams",
  "voc.friction": "Friction",
  "voc.circular_motion": "Circular motion",
  "voc.momentum": "Momentum",
  "voc.impulse": "Impulse",
  "voc.work_and_energy": "Work and energy",
  "voc.conservation_of_energy": "Conservation of energy",
  "voc.power": "Power",
  "voc.gravitation": "Gravitation",
  "voc.pressure": "Pressure",
  "voc.fluid_statics": "Fluid statics",
  "voc.thermal_expansion": "Thermal expansion",
  "voc.heat_transfer": "Heat transfer",
  "voc.wave_motion": "Wave motion",
  "voc.sound_waves": "Sound waves",
  "voc.reflection_and_refraction": "Reflection and refraction",
  "voc.electric_circuits": "Electric circuits",
  "voc.magnetic_fields": "Magnetic fields",

  "voc.atomic_structure": "Atomic structure",
  "voc.electron_configuration": "Electron configuration",
  "voc.periodic_trends": "Periodic trends",
  "voc.ionic_bonding": "Ionic bonding",
  "voc.covalent_bonding": "Covalent bonding",
  "voc.molecular_geometry": "Molecular geometry",
  "voc.polarity": "Polarity",
  "voc.intermolecular_forces": "Intermolecular forces",
  "voc.the_mole": "The mole",
  "voc.molar_mass": "Molar mass",
  "voc.stoichiometry": "Stoichiometry",
  "voc.limiting_reagent": "Limiting reagent",
  "voc.percent_yield": "Percent yield",
  "voc.molarity": "Molarity",
  "voc.acids_and_bases": "Acids and bases",
  "voc.ph_scale": "pH scale",
  "voc.titration": "Titration",
  "voc.redox_reactions": "Redox reactions",
  "voc.oxidation_numbers": "Oxidation numbers",
  "voc.reaction_rates": "Reaction rates",
  "voc.chemical_equilibrium": "Chemical equilibrium",
  "voc.thermochemistry": "Thermochemistry",

  "voc.cell_theory": "Cell theory",
  "voc.cell_membrane": "Cell membrane",
  "voc.osmosis": "Osmosis",
  "voc.enzymes": "Enzymes",
  "voc.photosynthesis": "Photosynthesis",
  "voc.cellular_respiration": "Cellular respiration",
  "voc.atp": "ATP",
  "voc.mitosis": "Mitosis",
  "voc.meiosis": "Meiosis",
  "voc.dna_structure": "DNA structure",
  "voc.dna_replication": "DNA replication",
  "voc.transcription": "Transcription",
  "voc.translation": "Translation",
  "voc.mendelian_genetics": "Mendelian genetics",
  "voc.punnett_squares": "Punnett squares",
  "voc.mutations": "Mutations",
  "voc.natural_selection": "Natural selection",
  "voc.speciation": "Speciation",
  "voc.taxonomy": "Taxonomy",
  "voc.ecosystems": "Ecosystems",
  "voc.food_webs": "Food webs",
  "voc.homeostasis": "Homeostasis",

  "voc.primary_sources": "Primary sources",
  "voc.chronology": "Chronology",
  "voc.cause_and_consequence": "Cause and consequence",
  "voc.ancient_civilisations": "Ancient civilisations",
  "voc.roman_republic": "Roman Republic",
  "voc.feudalism": "Feudalism",
  "voc.the_renaissance": "The Renaissance",
  "voc.the_reformation": "The Reformation",
  "voc.age_of_exploration": "Age of exploration",
  "voc.the_enlightenment": "The Enlightenment",
  "voc.industrial_revolution": "Industrial Revolution",
  "voc.colonial_empires": "Colonial empires",
  "voc.world_war_one": "World War One",
  "voc.decolonisation": "Decolonisation",
  "voc.cold_war": "Cold War",
} as const;
