import "server-only";

/**
 * What Raya can tell a student or a teacher about the app itself — which nav
 * button does what, where a setting lives, how billing works — condensed
 * from `lib/raya/app-guide.md`'s "For everyday users" section into something
 * short enough to spend on every turn.
 *
 * Deliberately a hand-condensed copy rather than that file read at request
 * time: these routes run in the Node runtime, but a bare `fs.readFileSync`
 * on a file outside `public/` isn't something Next's serverless file tracing
 * is guaranteed to pick up for a Vercel deployment — this app has no
 * `outputFileTracingIncludes` entry for it, and finding that out in
 * production (every chat request throwing, or silently losing this section)
 * is a bad way to learn it's missing. `app-guide.md` stays the fuller,
 * human-readable reference; if the app's navigation or settings change,
 * update BOTH.
 */
const STUDENT_APP_GUIDE = `# What you can explain about the app

A student may ask what a button does, where something lives, or what a plan
costs. This is accurate as of the last time it was updated — if it ever
conflicts with what the product actually does, trust the product and say so
rather than insist on this.

Bluestift is two products on one account: Raya (this tutor) for the
student, and Bluestift Schools, the staff dashboard their teacher may use.
The nav: **Chat** (this conversation), **Rooms** (study with Raya alongside
other students — public and open, or private via invite link, optionally
timed), **Tools** (turn an uploaded file into a summary, MCQ quiz,
flashcards, a mind map, an audio summary, or an infographic), **Assignments**
(exams/exercises a teacher assigned — nothing shows until one does, and each
is a single attempt), **My Kernel** (their own mastery, concept by concept —
status per concept plus Knowledge/Retention/Application, never a single
grade), **Settings** (Profile, Plan, My Kernel, Shared links, Privacy &
data, Legal — plus Active school, Billing & seats and Team & classes if
their account is linked to a school).

Plans: an individual Raya account starts free. A school pays per enrolled
student, not per active user — exact figures are at /pricing, not restated
here because they change.`;

const STAFF_APP_GUIDE = `# What you can explain about the app

A teacher or admin may ask what a tab does or how billing works. This is
accurate as of the last time it was updated — if it ever conflicts with
what the product actually does, trust the product and say so rather than
insist on this.

The Bluestift Schools nav: **Overview** (student count, 7-day activity,
who's struggling, average mastery, classes to watch), **Classes** /
**Classes & codes** (roster and the join codes students use to enrol),
**Focus** (pick a class then a student for their full cognitive detail and
your own follow-up notes on them), **Prepare** (generate an exercise set or
worksheet grounded in the class's actual gaps, from the Kernel — not
generic), **Insights** (patterns across a class or subject over time),
**Reports** (a shareable report, e.g. for a parent meeting), **Team**
(subjects, teachers, who's assigned where, and invite-teacher links),
**Billing** (plans and history — billed per enrolled student, so a quiet
week doesn't change the cost; where self-serve online checkout isn't live
yet for a school, a payment made out-of-band, transfer or invoice, is
recorded here to activate the plan instead), **Archive** (everything the
school produced, by school year).

One boundary worth stating plainly if it comes up: this dashboard shows
patterns — mastery, struggle, activity — never the content of a student's
actual conversation with Raya.`;

/** Solo Raya and study rooms — a student on the other end. */
export function appGuideLayer(): string {
  return STUDENT_APP_GUIDE;
}

/** Raya for Schools — a teacher or administrator on the other end. */
export function appGuideLayerForStaff(): string {
  return STAFF_APP_GUIDE;
}
