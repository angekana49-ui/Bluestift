# Handoff: RAYA (student app) + Schools (admin/teacher app) + Onboarding

## Overview
Two internal product apps for **BlueStift / RAYA** (AI tutor K-12), plus a shared onboarding
screen:

- **RAYA** — the student-facing app: 1:1 chat with the RAYA tutor, group Study Rooms, a Tools
  Studio (quiz/flashcards/summary generation), a personal Kernel (mastery) view, and Settings
  (profile, theme, billing).
- **Schools** — the school-side app for admins and teachers: an Overview dashboard (school-wide
  KPIs for admins, "my classes" for teachers), a Classes roster, a Kernel simulation console,
  school-wide RAYA activity/configuration, and Settings (school profile, billing).
- **Onboarding** — the "join a school via code" screen, shared in principle by students and
  teachers (both are basic users until they redeem a school's join code).

## About the Design Files
The files in `reference-*.html` are **design references**, not production code. They were built
in an internal prototyping tool (custom template syntax — `{{ }}` bindings, a `DCLogic` class,
`<sc-if>` conditionals) that does **not** run in a normal browser/React app. **Open them via a
static file server to see the live, interactive reference** (click through the sidebar nav,
toggle Day/Night, expand/collapse the sidebar, switch Admin/Prof in Schools). Your job is to
**recreate this design pixel-for-pixel in Next.js + TypeScript + React**, using real components —
not to port the template syntax. Do not copy `support.js` or the `{{ }}`/`<sc-if>` markup into
the app; it only exists so these reference files render for you to inspect.

## Fidelity
**High-fidelity.** All colors, gradients, shadows, spacing, typography, border-radii, and
component layouts below are final values — implement them exactly, don't reinterpret. Copy in
French should be kept verbatim (this is a French/English bilingual product; all screens here are
in French, code identifiers should stay in English).

---

## Shared visual system (all three apps)

### Sky/cloud background
All three apps sit on top of the same **BlueStift sky system** used on the marketing site
(see the `hero-clouds-wide.png` / `clouds-wide.png` asset — same file, just re-exported): a
`position: fixed; inset: 0; z-index: 0` layer with:
```
background-image: url('clouds-wide.png');
background-size: cover;
background-position: center 65%;
opacity: <cloudOpacity>;      /* 0.85 light / 0.8 dark */
filter: <cloudFilter>;         /* none light / brightness(0.55) saturate(1.3) contrast(1.1) dark */
```
plus a flat color haze overlay on top (`hazeOverlay` token below) to keep foreground content
legible. The whole app shell (`position:relative; z-index:1`) floats above these two layers.

### Layout shell (RAYA + Schools)
Both apps share one shell: a `display:flex; height:100vh; padding:20px; gap:18px` row containing
2–3 **separate floating cards** (not one fused panel) — this separation matters, it was an
explicit design decision:
1. **Sidebar** — fixed width (216px RAYA / 216px Schools), collapses to 68px (icon rail) via a
   click anywhere on its empty background (not on a nav item — those stop propagation).
   `border-radius: 22px`, own `background`/`border`/`box-shadow` (card tokens below),
   `box-sizing: border-box`.
2. **Main card** — `flex:1`, `min-width: 340-380px` so it never compresses illegibly, same
   card styling, contains the header row + the active view's content, own scroll (`overflow:auto`
   on an inner wrapper, not the card itself).
3. **Right panel** (optional, toggleable) — fixed width (250–300px), same card styling, sits as a
   **separate sibling card** with its own gap — used for contextual info: mastery gauge,
   participants, notifications, uploaded files. Toggled via a small icon button in the main
   card's header (`rect+vertical-line` "sidebar" icon, 28-34px circle/rounded-square button).

All three cards use `box-sizing: border-box` and explicit `min-width` — this was the fix for a
recurring bug where fixed-width flex children with padding overflowed the viewport with no
working horizontal scroll. Keep `min-width` on every fixed-width flex child.

### Sidebar collapse behavior
- Click the sidebar's empty background → toggles `collapsed` (not on nav items, which
  `stopPropagation`).
- When collapsed: sidebar width → 68px, all text labels `display:none` (icons stay, centered via
  `justify-content:center` on each row), any per-item chevron (see below) also hides — a
  `display:none` computed purely from `collapsed` (do not blend a "hide" and "flex" declaration in
  the same inline style — last `display` wins and it silently un-hides on collapse; use one
  single computed style string per state).
- Sidebar nav items with expandable history (Chat, Rooms in RAYA) show a small chevron
  (up/down, 11px, rotates 90° when collapsed-state closed) at their trailing edge, independent of
  the sidebar's own collapse — clicking the chevron toggles just that section's inline history
  list (indented sub-rows under the nav item, "+ New session"/"+ Create room" pinned at the top of
  that list, above the history items).
- The user-profile row pinned at the bottom of the sidebar (avatar + name) is clickable → routes
  to Settings (profile + billing live there).

### Design tokens — Light theme
```
pageBase:        #eef3f9
cloudOpacity:     0.85        cloudFilter: none
hazeOverlay:      rgba(238,243,249,0.68)
sidebarBg:        rgba(255,255,255,0.82)   sidebarBorder: rgba(15,23,42,0.08)
sidebarText:      #0b1220     sidebarMuted: #64748b    sidebarActiveBg: rgba(15,23,42,0.07)
sidebarDivider:   rgba(15,23,42,0.08)
cardBg:           rgba(255,255,255,0.82)   cardBg2 (inner cards): #f3f6fa
cardBorder:       rgba(15,23,42,0.08)      cardShadow: 0 30px 80px rgba(15,23,42,0.18)
text: #0b1220     muted: #64748b     mutedLight: #8a97a8
ctaBg: #0b1220    ctaText: #ffffff
inputBg: #f3f6fa  inputBorder: #dde5ee
bubbleBg (RAYA chat): #f3f6fa   bubbleAccentBg: #fef3c7
rowActiveBg: #eef2f8    pillTrackBg: rgba(0,0,0,0.05)
gaugeTrack: #e2e8f0
switchTrackBg: linear-gradient(180deg,#d7e9f7,#f3f9fd)  switchBorder: rgba(255,255,255,0.7)  switchKnobBg: #ffffff
```

### Design tokens — Dark theme
```
pageBase:        #0a0f1e
cloudOpacity:     0.8         cloudFilter: brightness(0.55) saturate(1.3) contrast(1.1)
hazeOverlay:      rgba(8,12,24,0.42)
sidebarBg:        #05070d     sidebarBorder: rgba(255,255,255,0.06)
sidebarText:      #ffffff     sidebarMuted: #94a3b8    sidebarActiveBg: rgba(255,255,255,0.1)
sidebarDivider:   rgba(255,255,255,0.08)
cardBg:           rgba(17,26,46,0.82)   cardBg2: #16203a
cardBorder:       rgba(255,255,255,0.08)   cardShadow: 0 30px 80px rgba(0,0,0,0.5)
text: #eef2f8     muted: #9aa7bd    mutedLight: #7c8aa3
ctaBg: #2f7fe0    ctaText: #ffffff
inputBg: #16203a  inputBorder: rgba(255,255,255,0.14)
bubbleBg: #16203a  bubbleAccentBg: #3a3010
rowActiveBg: #16203a   pillTrackBg: rgba(255,255,255,0.06)
gaugeTrack: rgba(255,255,255,0.12)
switchTrackBg: linear-gradient(180deg,#111b2a,#0b1220)  switchBorder: rgba(255,255,255,0.15)  switchKnobBg: #0b1220
```
Both apps derive **every** color from a single `getTheme(isDark)` function (see the `<script>`
block in each reference file for the literal object) — one source of truth per app, persisted to
`localStorage` under the key **`bluestift-dark`** (shared across RAYA and Schools, `'1'`/`'0'`),
read on mount, not during SSR (avoid hydration mismatch — same caution as the marketing site
handoff).

### Type scale
- Headings / nav / brand wordmark: **Inter Tight**, weight 700–900, `letter-spacing:-0.01em to
  -0.02em`.
- Body / UI copy: **Inter**, weights 400–700.
- Onboarding/new-session handwritten greeting only: **Caveat**, weight 700 (see RAYA "new
  session" screen below) — the one deliberate departure from Inter, matching the marketing site's
  hero.

### Shape scale
- Buttons/pills/badges: `border-radius: 99px`.
- Cards (sidebar, main card, right panel, inner cards): `16–22px`.
- Small icon buttons/avatars: `50%` (circle) or `8–12px` (rounded square).

### Shared components
- **Theme toggle** (Day/Night pill switch): lives inside Settings (not the sidebar) in both apps
  — `60×28px` track, `20×20px` knob sliding `left:3px ↔ left:37px`,
  `transition: left 0.4s cubic-bezier(0.34,1.56,0.64,1)` (springy), sun/moon SVG swapped by
  conditional render (not CSS filter).
- **KPI tile** (`.kpi` class): `border-radius:16px`, label (11px, muted) / value (22px bold) /
  delta (10px, green `#10b981` positive or muted neutral). Grid uses
  `grid-template-columns:repeat(auto-fit,minmax(130px,1fr))` — never a fixed `repeat(4,1fr)`,
  which illegibly compresses tiles at narrower viewport widths.
- **Grouped bar chart** ("Sessions vs. mastery/maîtrise"): 6 months × 3 series (indigo
  `#4f46e5`/`#9aa1ef` = Sessions, orange `#f97316`/`#fbab5c` = Quiz, green `#22c55e`/`#7fe0a3` =
  Mastery). Past months render as muted pastel gradient bars; the current month renders in the
  vivid/saturated version of each color with a bold axis label, plus a small pill caption below
  ("Juin 2026 — Maîtrise en hausse").
- **Semi-circular mastery gauge**: SVG arc `M 20 84 A 60 60 0 0 1 140 84`, track color =
  `gaugeTrack`, progress stroke = a 4-stop `linearGradient`
  (`#f97316 → #fbbf24 → #84cc16 → #22c55e`), value + caption centered inside the arc.
- **`.shine` sweep**: a diagonal white gradient animation (`@keyframes shine`, 6s linear infinite,
  `background-position:-120% 0 → 120% 0`) applied to a `::after` pseudo-element on a handful of
  cards/tiles for ambient motion — not everywhere, used sparingly (roughly 2 of 4 KPI tiles, the
  generated-exercise card in chat, the new-session quick-start chips).
- **Online-status dot**: `.online-dot` (green, `@keyframes pulseDot` opacity pulse 1.6s) /
  `.offline-dot` (flat gray) — 8px circles next to participant avatars in RAYA Rooms.

---

## App 1 — RAYA (student app)

### Sidebar nav
Chat · Rooms · Tools · Mon Kernel · Réglages (icons: chat bubble, two-person, wrench, dual-gear
"kernel", settings gear). Chat and Rooms each have a trailing chevron that expands an inline
history list (see "Sidebar collapse behavior" above).

### Screen: Chat
- **Two states**: *new session* (empty/welcome) and *active thread*, toggled by
  `state.newSession`. Clicking "+ Nouvelle session" in the sidebar's expanded Chat history sets
  this flag; it does not create a new nav view, just swaps the center content.
- **New-session welcome state**: centered, animated, matches the marketing Home hero's
  entrance choreography exactly:
  - Handwritten greeting "Salut Emma, prête à apprendre ?" — `Caveat` 700, `clamp(2.2rem,5vw,3.4rem)`,
    revealed via `@keyframes writeReveal` (`clip-path: inset(0 101% 0 0) → inset(0 -1% 0 0)`,
    2.2s, `cubic-bezier(0.65,0,0.35,1)`, `both` fill mode).
  - Two small bird-silhouette SVGs (`birdFly`/`birdFly2`, 2.2s/2.5s staggered) flying
    left-to-right across the greeting with a bobbing path, `wingFlap` (0.19-0.22s infinite
    `scaleY`) layered on the wrapping span. First bird fill = `#6366f1` (indigo, matches the "AI"
    avatar color), second = `mutedLight` token.
  - Subhead (13px, muted) + 3 floating "quick start" suggestion chips (`floatSm` idle bob,
    `.shine` sweep, staggered `animation-delay`): "Reprendre les fractions" / "Réviser la
    grammaire" / "Quiz surprise".
- **Active-thread state**: header row = AI avatar (indigo circle, "AI" initials) + conversation
  title + live-session dot (`● en session`, green) + "Voir le profil kernel" pill (links to Mon
  Kernel; `max-width:150px` + ellipsis so it truncates instead of clipping mid-word) + a **files**
  icon button (opens a small absolute-positioned dropdown card listing session documents, name +
  uploader + relative time) + the **right-panel toggle** icon button.
  Message thread: chat bubbles (student = dark `ctaBg` bubble, right-aligned; RAYA = `bubbleBg`
  card, left-aligned), one bubble contains a nested "generated exercise" mini-card with `.shine`.
  Composer row: mic icon button (left, circle) → input pill (flex, min-width so it never wraps to
  multiple lines, `white-space:nowrap;overflow:hidden;text-overflow:ellipsis`) → file-upload icon
  button → AI-mode icon button (title "Mode IA — Encourageant") → send button (dark circle, "↑").
  **Keep the composer's icon buttons icon-only (no text pill) at this width** — adding a labeled
  pill previously starved the input field's flex-basis and caused it to wrap illegibly.
- **Right panel** (toggleable card): Notifications section (2 sample items) + mastery gauge for
  the active concept + an actionable "still stuck?" card whose Flashcards/Quiz express rows are
  clickable buttons routing into Tools (not static tags).

### Screen: Rooms
- Header: room title, group/private segmented control (`Chat groupe` / `Chat privé avec RAYA`,
  dark-pill active state), live dot, right-panel toggle.
- Group tab: RAYA-moderated group thread (RAYA bubble = `bubbleBg`, one student's message
  highlighted in `bubbleAccentBg` amber).
- Private tab: same bubble system, prefixed with a small lock-icon disclaimer ("Cette
  conversation n'est visible que par toi et RAYA").
- **Right panel**: Notifications → **Fichiers partagés** (uploaded-file list: icon + filename +
  "par <name> · <relative time>") → **Participants** list, each row with an online/offline status
  dot (see shared components), one participant tagged with a small red "bloqué" pill badge when
  stuck.

### Screen: Tools (Tools Studio)
3-card grid (Quiz express / Flashcards / Résumé), each: 38px rounded icon tile (`ctaBg`
background, line-icon), title, one-line description. Below: a dashed-border drop-zone ("Dépose un
PDF, une photo de cours ou un lien pour générer un outil").

### Screen: Mon Kernel (personal)
2-column grid: mastery gauge (global) + a "Par concept" card listing 3 concepts with thin
progress bars (color = amber if <70%, green if ≥70%).

### Screen: Réglages (Settings)
Three stacked cards, `max-width:560px`:
1. **Thème** — the shared Day/Night switch.
2. **Profile** — avatar + name/class, editable-looking Nom/Email fields, two toggle rows
   (Notifications de session / Rappels de révision), "Se déconnecter" link.
3. **Facturation (Billing)** — current plan row ("Plan Étudiant — Gratuit" + "Passer à Classroom"
   pill), payment method row, invoice history (empty state copy for the free tier).

---

## App 2 — Schools (admin/teacher app)

### Role switch
A segmented **Admin / Prof** control sits in the sidebar footer, above the profile row — plain
text pills (no icons; an icon+text version was tried and looked cluttered/overflowed at 216px, so
the final version is text-only, `flex:1` each, `padding:8px 4px`, active tab gets `background:#fff`
+ `color:#0b1220` + a subtle `box-shadow` regardless of theme, inactive tab is transparent with
`sidebarMuted` text). When collapsed (68px rail) the two-word pills are replaced by a single
round icon button that toggles role on click (shows "A" or "P").
Switching to **Prof** hides the Classes and Kernel nav items (school-wide admin tools) and
switches Overview to the teacher-scoped dashboard; switching back to **Admin** restores them.
This is a client-side role simulate toggle for the prototype — in production this should be
driven by the authenticated user's actual role/membership, with Prof users never seeing the
Admin-only nav items or being able to toggle into Admin.

### Sidebar nav
Overview · Classes\* · Kernel\* · RAYA · Réglages (\*hidden in Prof role).

### Screen: Overview — Admin role
KPI row (Sessions today, Students struggling, Average mastery, Active students) + the grouped
Sessions-vs-mastery bar chart (see shared components). Right panel: school-wide mastery gauge +
"Insights RAYA" (2 flagged-item cards).

### Screen: Overview — Prof role
Single-column, teacher-scoped: one intro line ("Tes classes et comment tes élèves progressent."),
3 KPI tiles scoped to the teacher's own classes (Sessions this week / Students struggling in a
named class / Average mastery across their classes), and a "Mes classes" table (class · student
count · mastery bar) limited to the classes this teacher actually teaches — **this table's rows
are currently static sample data (6e-A, 5e-C) and need to be wired to the real per-teacher class
roster.**

### Screen: Classes (Admin only)
Full roster table: Classe / Professeur / Élèves / Maîtrise (progress bar + %), "+ Ajouter une
classe" CTA.

### Screen: Kernel (Admin only)
Single-column: an "Ajustements du kernel" card with 3 labeled sliders (rythme d'introduction,
répétitions avant renforcement, sensibilité aux blocages — rendered as static filled tracks +
draggable-looking knobs, not yet wired to real slider input) + "Lancer une simulation" CTA +
estimated-impact caption. Right panel: global mastery gauge.

### Screen: RAYA (school-wide activity & config)
Table of per-class RAYA usage (sessions/7 days, configured tone). Right panel: "Personnalité de
RAYA" config card (dark `ctaBg` card, "Configurer" CTA) + "Contenus signalés" moderation card.

### Screen: Réglages (Settings)
Four stacked cards, `max-width:560px`:
1. **Thème** — shared Day/Night switch.
2. **École** — establishment name, active school year, student join code (monospace-letterspaced
   display), weekly teacher-notification toggle, "Gérer les accès administrateurs" link.
3. **Facturation (Billing)** — current plan row ("Plan Classroom — 29€/mois" + next charge date +
   "Passer à School" upsell pill), seats-used / payment-method 2-col row, invoice history (2
   sample rows).

---

## App 3 — Onboarding (join-school-via-code)

Single centered card (`max-width:440px`) reused for **both** roles via a top segmented control
(Élève / Professeur) — the join-by-code principle is identical for both; a teacher is just a
"basic user" until their code is redeemed, same as a student.

- **Pending state**: role-aware headline + subline ("Rejoins ta classe" / "Rejoins ton
  établissement"), a 6-cell code-entry row (`44×56px` boxes, currently pre-filled with sample
  characters as a static mock — wire to real per-character input focus/paste-splitting
  behavior), a hint line naming who issues the code, a dark "Rejoindre l'établissement" CTA, and a
  "Continuer sans école" escape-hatch link.
- **Success state**: green check badge, "Bienvenue chez Lycée Voltaire" confirmation, a role-aware
  summary line, and a CTA that should route into RAYA (student) or Schools (teacher).

This screen currently has no visual connection to the sky/cloud background system or the
sidebar-shell chrome — it's intentionally a standalone, centered auth-style card (no sidebar),
matching typical join/auth-screen conventions rather than the in-app shell.

---

## State management (per app)
Each reference file's `<script>` block is a single `Component extends DCLogic` class — treat its
`state` object and setter methods as the literal spec for what React state you need:

**RAYA**: `view` (chat/rooms/tools/kernel/settings), `roomTab` (group/private), `collapsed`
(sidebar), `chatRightOpen`/`roomsRightOpen`, `chatHistOpen`/`roomsHistOpen`, `chatFilesOpen`,
`newSession`, `dark` (persisted).

**Schools**: `view` (overview/classes/kernel/raya/settings), `collapsed`, `rightOpen`, `role`
(admin/prof), `dark` (persisted).

**Onboarding**: `role` (student/teacher), `status` (pending/success).

`dark` is read from `localStorage['bluestift-dark']` on mount only (client-side effect, never
during SSR render) in both RAYA and Schools, and both apps should stay in sync if a user has both
open (shared key).

## Assets
- `clouds-wide.png` — sky/cloud background, identical asset used across the whole BlueStift
  product surface (marketing site + these two apps), themed via CSS `opacity`/`filter`, never
  swapped for a different image between light/dark.
- `raya-logo.jpeg` — RAYA's mark (a blue/indigo gradient radial-flower glyph), used in the RAYA
  sidebar header, the Schools sidebar's RAYA nav item, and the Schools RAYA screen header.
- `bluestift-mark.jpeg` — the BlueStift circular brand mark, used in the Schools sidebar header
  and on the Onboarding card.
- No icon font/library anywhere — every icon is a minimal inline SVG (stroke-based line icons,
  `stroke-width` 1.7–2.2, `stroke-linecap/linejoin: round`), consistent with the marketing site's
  "no icon set" rule.

## Files
- `reference-RAYA.html` — RAYA app.
- `reference-Schools.html` — Schools app.
- `reference-Onboarding.html` — join-via-code screen.
- `support.js` — runtime required only to render these reference files in a browser. **Do not
  port this file or its template syntax** — it exists purely so you can open the references and
  click through the interactions described above.
