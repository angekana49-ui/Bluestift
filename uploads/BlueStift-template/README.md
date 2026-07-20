# BlueStift — RAYA public site

Next.js 14+ / React / TypeScript / Tailwind CSS site for RAYA (BlueStift's K-12 AI
tutor): sky-blue day/night theme, animated hero (handwritten hook, cloud photo
background), live feature/session/dashboard cards, morph-blob pricing cards, and
four public pages — Research, Survey, Contact, Feedback — built with the same
visual system.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Structure

- `src/app/layout.tsx` — root layout, Google Fonts (Inter, Inter Tight, Caveat, Instrument Serif), metadata.
- `src/app/page.tsx` — renders `<LandingPage config={defaultConfig} />` (home).
- `src/app/research/page.tsx`, `survey/page.tsx`, `contact/page.tsx`, `feedback/page.tsx` — thin routes that render the matching component in `src/components/pages/`.
- `src/components/LandingPage.tsx` — the `SiteConfig` type + `defaultConfig` (all home-page copy/data lives here — edit this file to reword the page) and the page shell.
- `src/components/Navbar.tsx` / `NavbarControls.tsx` — floating pill nav shared by every page (`active` highlights the current pill, `section` shows a small label next to the logo), day/night theme toggle (persists to `localStorage`).
- `src/components/HeroSection.tsx` — hero with the cloud-photo background (`public/hero-clouds-wide.png`), day/night crossfade, and the handwritten "Caveat" hook animation.
- `src/components/DashboardMockup.tsx` — the floating product screenshot mockup (session stats, mastery chart, Kernel gauge).
- `src/components/FeaturesSection.tsx`, `DifferentiatorsSection.tsx`, `InboxSection.tsx`, `PricingSection.tsx`, `Footer.tsx` — the remaining home-page sections.
- `src/components/pages/ResearchPage.tsx` — `/research`: articles, newsletter, collaborations tabs, contribution form. Green accent.
- `src/components/pages/SurveyPage.tsx` — `/survey`: teacher/student question flow, done screen, free-expression wall. Orange accent.
- `src/components/pages/ContactPage.tsx` / `FeedbackPage.tsx` — simple forms, blue accent (same family as the landing hero).
- `src/styles/globals.css` — design tokens (CSS custom properties), day/night theme values, and the custom keyframes (`write`, `pen`, `shine`, `morph`, `float-sm`) also mirrored in `tailwind.config.ts`.

All four new pages are self-contained: forms simulate a network round-trip locally
(no backend, no captcha) and article/wall content is illustrative seed data —
wire up real endpoints by replacing the `window.setTimeout(...)` calls with `fetch`.

## Theming

Day/Night is driven by `data-theme="day" | "night"` on `<html>`, toggled by `NavbarControls`. All theme-dependent colors are CSS custom properties in `globals.css` (`--text-primary`, `--features-bg`, `--pricing-bg`, etc.) — override `html[data-theme="night"] { ... }` to adjust the dark palette.

## Assets

- `public/bluestift-mark.jpeg` — the BlueStift bird logomark (used in Navbar + Footer).
- `public/hero-clouds-wide.png` — the hero background photo.

Replace both with your own assets at the same filenames, or update the `src` paths in `Navbar.tsx`, `Footer.tsx`, and the `.bluestift-hero-day` / `.bluestift-hero-night` classes in `globals.css`.
