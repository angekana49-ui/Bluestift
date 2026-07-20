# Handoff: BlueStift / RAYA Marketing Site (Home, Research, Survey, Contact)

## Overview
Marketing site for **BlueStift**, maker of **RAYA** (an AI tutor for K-12 students). Four pages: Home (hero + product overview + pricing), Research (blog/publications), Survey (student/teacher intake survey), Contact (contact form). Every page shares a nav bar and a **light/dark ("Day"/"Night") theme toggle** persisted in `localStorage`, plus an animated cloud-sky background system.

## About the Design Files
The files in `reference-*.html` are **design references**, not production code. They were built in an internal prototyping tool (custom template syntax, a `DCLogic` class, `<sc-if>` conditionals) — none of that runs in a normal browser/React app. **Open them in a browser via a static file server to see the live rendering and interactions** (toggle the theme, hover the cards, reload to replay the entrance animations). Your job is to **recreate this design pixel-for-pixel in the target stack** (this project is Next.js + TypeScript + React) using real components, not to copy the file syntax.

## Fidelity
**High-fidelity (hifi).** All colors, gradients, shadows, spacing, typography, and animation timings below are final values — implement them exactly, don't reinterpret.

---

## ⚠️ Read this first: why the cloud background & effects tend to get lost or degraded during implementation

This is the part that has broken on previous attempts. Four specific causes, and the fix for each:

1. **`overflow: hidden` on a layout wrapper clips the fixed background.**
   On Research/Survey/Contact, the cloud image is `position: fixed; inset: 0` so it stays pinned behind the whole page as you scroll (not just behind the hero). Next.js `app/layout.tsx` or any wrapping `<div>` with `overflow-x-hidden` / `overflow-hidden` around `{children}` will **clip a `position: fixed` descendant to that wrapper's box**, which turns "fixed full-page sky" back into "sky that stops at the hero" — the exact bug being fixed here. Make sure no ancestor between the fixed layer and the viewport has `overflow` set to anything but `visible`.

2. **`next/image` recompresses/recrops the PNG.**
   Use the cloud image as a plain CSS `background-image` (as in these references) or an `<img>` with `unoptimized` — do **not** run it through Next's automatic image optimizer, which changes format/quality and can shift the color balance.

3. **Percentage-based gradient stops behave differently depending on element height.**
   The hero's fade-to-solid overlay intentionally uses **pixel-based stops with `calc()`** (e.g. `... calc(100% - 260px), #eef2f8 100%`), not percentages. Percentages are relative to the section's own (variable) height, so on a tall hero the "fade zone" gets squeezed behind other content and reads as a hard cut. Keep the pixel-based stops.

4. **SSR/hydration mismatch strips the dark-mode read.**
   Theme is read from `localStorage` on mount (see State Management below). If you read it during SSR render (not in `useEffect`/after mount) Next will throw a hydration warning, and the common "fix" developers reach for is deleting the localStorage read — which is why dark mode / persistence disappears. Follow the pattern in State Management exactly: render the light theme by default, then swap after mount.

---

## Cloud / Sky Background System

**Asset**: `assets/hero-clouds-wide.png` (1100×500ish landscape sky+clouds painting). Load as a `background-image`, `background-size: cover`, `background-position: center 30%`.

### Home page (contained to hero)
The hero `<section>` is `position: relative; overflow: hidden`. Three absolutely-positioned (`inset:0`) layers stack inside it, in this order:
1. **Cloud image div** — background-image as above, `opacity` per theme (`0.9` light / `0.85` dark), `filter` per theme (`none` light / `brightness(0.42) saturate(1.15) contrast(1.05)` dark — this is what makes the exact same photo read as "night sky"), animated on mount with `cloudZoom` (see Animations).
2. **Haze overlay div** — flat color (`#eaf4fb` light / `#0a1220` dark) animated with `hazeFade` on mount (a "mist clearing" effect).
3. **Fade-to-solid overlay div** — `background: heroFade` gradient (see Design Tokens) — this is what blends the sky into the solid color of the next section using the pixel-based-stops technique from point 3 above. **The final color stop of `heroFade` must exactly equal `sectionAltBg`** (the Features section's background) — that equality is what makes the seam disappear; don't let them drift apart.

All hero content (badge, heading, buttons, dashboard mockup) sits in a `position: relative; z-index: 1` wrapper above these three layers.

### Research / Survey / Contact (spans whole page)
Same three layers, but the wrapper around them is `position: fixed; inset: 0; z-index: 0` (not confined to a section) — so the sky stays visible behind the nav gaps and content padding as the user scrolls, and every subsequent section just needs its own opaque background to naturally occlude it (no special blending needed there). The outer page wrapper needs `position: relative` for this to attach correctly, and **every** section/footer that should sit above the sky needs `position: relative; z-index: 1` (or higher) — anything left as a plain non-positioned block will paint *behind* a `z-index: 0` fixed element per CSS stacking rules, and effectively disappear.

### Section-to-section blending (Home only — Features → Differentiators → Pricing → Footer)
Same principle as the hero fix: rather than two flat colors touching, extend the **earlier** section's background into a gradient whose final pixel-based stop is the exact color of the **next** section. E.g. Pricing's own background (`pricingBg`) is a 4-stop gradient whose last stop is `#ffffff` (Footer's `footerBg`) using `calc(100% - 160px)`, so pricing visually dissolves into the footer with no visible edge. Do **not** put an overlay on the receiving section — bake the target color into the sending section's own gradient. This was the working, final approach after iterating (an "overlay of the previous color fading down onto the next section" was tried first, then abandoned as less reliable — extending the sender's own gradient is simpler and more robust).

---

## Screens / Views

### 1. Home
**Layout**: Sticky pill navbar (max-width 1100px) → Hero (badge, animated handwritten headline with a "flying bird" pen-substitute, subheadline, 2 CTAs, 3 trust chips, floating dashboard mockup card) → Features (3-card grid) → Differentiators (comparison rows: ChatGPT/Claude ✕, Khan Academy ✕, RAYA ✓) → Pricing (3-card grid, middle "Classroom" card highlighted + dark) → Footer (4-column link grid + legal row).

**Dashboard mockup card** (inside hero): tab bar (Overview/Sessions/Students/Kernel + search), 4 stat tiles (Sessions today: 482, Students stuck: 6, Average mastery: 83%, Active students: 1,204 — two of the tiles have a diagonal "shine" sweep animation), a **grouped bar chart** ("Sessions vs. mastery") with 6 months (Jan–Jun) × 3 series (Sessions/indigo, Quizzes/orange, Mastery/green) — past months use muted/pastel gradient bars, the current month (Jun) uses vivid bars and a bold label, plus a right column with an "AI suggestion" card and a **semi-circular gauge** ("Kernel mastery", value 1,204) whose progress arc is a 4-stop SVG `linearGradient` (`#f97316 → #fbbf24 → #84cc16 → #22c55e`) rather than a flat color.

### 2. Research
Hero (badge "Volume 1 · Open research", heading, sub, Articles/Newsletter/Collaborations segmented control + "+ Submit" pill button, all vertically centered together) → Featured article card (green left-border accent, shine sweep) → 2 more publication cards.

### 3. Survey
Hero (orange badge, 2-line heading, sub, 2 big CTA buttons "I'm a teacher"/"I'm a student", "Or share freely →" link, 2 stat counters) → sample question card (progress bar 2/6, 4 answer options, one pre-selected/highlighted).

### 4. Contact
Hero-style header immediately containing a contact form card (Name/Email 2-col grid, Subject, Message textarea, Send button) — no separate content section, footer follows directly.

---

## Interactions & Behavior

### Theme toggle (all 4 pages, identical)
A single pill switch in the navbar, `66×30px`, `box-sizing: border-box` (critical — without it, padding inflates the box and the knob/label go visually off-center). A `22×22px` circular knob slides between `left: 3px` (Day) and `left: 41px` (Night) with `transition: left 0.45s cubic-bezier(0.34,1.56,0.64,1)` (springy overshoot). The knob contains a tiny inline SVG: a sun (circle + 8 rays, `#f59e0b`) in Day, a plain circle moon (`#bae6fd`) in Night — swapped via conditional render, not CSS filter. A single text label ("Day" or "Night", 9px, weight 600) sits in the empty half of the pill **opposite** the knob (`right: 6px` when knob is left/Day, `left: 6px` when knob is right/Night) — never both labels at once, and never overlapping the knob's travel path.

Click toggles state, immediately re-renders every themed value, and persists to `localStorage` under key **`bluestift-dark`** (`'1'` or `'0'`).

### Card hovers
Feature cards / pricing cards / publication cards: `transform: translateY(-4px)` (or `-6px scale(1.02)` for pricing) + deeper `box-shadow` on hover, `transition: transform 0.3s ease, box-shadow 0.3s ease`.

### Animations (all `@keyframes`, run once on mount unless noted)
- `writeReveal` (2.6s): hero `<h1>` reveals via `clip-path: inset(0 101% 0 0) → inset(0 -1% 0 0)` (handwriting-style wipe).
- `birdFly` / `birdFly2` (2.6s / 2.8s, staggered): two small bird-silhouette SVGs (simple 2-wing path, no detail) fly left-to-right across the headline with a bobbing `top`/`translateY`/`rotate` path, fading in/out at the ends. Fill color is theme-aware (`birdColor`: dark navy in light mode, off-white in dark mode).
- `wingFlap` (0.19–0.22s, infinite): `scaleY(1 → 0.5 → 1)` on the bird SVG itself, layered under the flight-path animation on the wrapping `<span>`.
- `cloudZoom` (5.2s, once): the sky image starts at `scale(2.2) translateY(6%)` and settles to `scale(1) translateY(0)` — a slow zoom-out revealing the full sky.
- `hazeFade` (5.2s, once): the haze overlay starts at `opacity: 0.96`, dips through `0.5` at 60%, ends at `0` — a "mist clearing" effect layered with the zoom.
- `floatSm` (6.5–7.2s, infinite, staggered per card): gentle `translateY(0 → -6px → 0)` idle float on the dashboard mockup and feature cards.
- `shine` (6–7s, infinite, staggered per card via `animation-delay`): a diagonal white gradient sweeps across stat tiles / cards (`background-position: -120% 0 → 120% 0`).
- `morphBlob` (7.5–10.5s, infinite, staggered): a blurred blob behind each pricing card slowly morphs `border-radius` and drifts, for ambient motion.

All "once" animations use `animation-fill-mode: both` so they hold their end state rather than resetting.

---

## State Management
- **One boolean**: `isDark`. Default `false` (light) for the very first paint (SSR-safe).
- On mount (`useEffect`, client-only): read `localStorage.getItem('bluestift-dark')`; if `'1'`, set `isDark = true`. This avoids hydration mismatches — do not read localStorage during the initial render.
- On toggle click: flip `isDark`, write `'1'`/`'0'` back to `localStorage.setItem('bluestift-dark', ...)`.
- Every color/shadow/gradient value in the page is derived from `isDark` via a single `getTheme(isDark)` function (see Design Tokens) — no per-component theme logic, one source of truth per page.
- No cross-page sync beyond `localStorage` — each page reads it independently on mount (a shared React Context + the same key would also work if the 4 pages become client-side routes in one app).

---

## Design Tokens

Each page defines its own `getTheme(isDark)` returning an object of the tokens below (values are already tuned per page for its palette — e.g. Home is the "premium" light variant, Research/Survey/Contact use a slightly simpler light variant). **Home's light theme was explicitly upgraded to feel as premium/rich as its dark mode** — richer shadows, less washed-out pastel — use Home's values as the canonical light palette if unifying.

### Home — Light
```
pageBg:        linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)
text:          #0b1220        muted: #64748b        mutedLight: #546578
navBg:         rgba(255,255,255,0.75)   navBorder: rgba(255,255,255,0.65)
navShadow:     0 18px 60px rgba(15,23,42,0.14)
pillTrackBg:   rgba(0,0,0,0.06)  pillActiveBg: #ffffff  pillActiveShadow: 0 1px 4px rgba(15,23,42,0.1)
switchTrackBg: linear-gradient(180deg,#d7e9f7,#f3f9fd)  switchBorder: rgba(255,255,255,0.7)  switchKnobBg: #ffffff
ctaBg:         #0b1220   ctaText: #ffffff
cardBg:        #ffffff   cardBorder: rgba(15,23,42,0.07)
cardShadow:    0 20px 50px rgba(15,23,42,0.1)     cardShadowLg: 0 26px 64px rgba(15,23,42,0.13)
footerBg:      #ffffff   footerBorder: rgba(148,163,184,0.18)   footerMuted: #475569
inputBorder:   #dde5ee   inputBg: transparent   inputFieldBg: #f3f6fa   inputPlaceholder: #94a3b8
sectionAltBg:  #eef2f8   (Features section bg — must equal heroEndSolid)
pricingBg:     linear-gradient(180deg,#dde8f3 0px,#cfdfec 30%,#c2d5e5 calc(100% - 160px),#ffffff 100%)
heroEndSolid:  #eef2f8   pricingStart: #dde8f3   pricingMid: #cfdfec   pricingEnd: #c2d5e5
heroFade:      linear-gradient(180deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0) 220px, rgba(255,255,255,0) calc(100% - 260px), #eef2f8 100%)
cloudFilter:   none      cloudOpacity: 0.9
chipBg:        rgba(255,255,255,0.55)   chipBorder: rgba(15,23,42,0.08)
wordmarkA:     #173d8a (word "Blue")    wordmarkB: #2f7fe0 (word "Stift")
birdColor:     #1e293b   hazeColor: #eaf4fb
greenBg:       #ecfdf5   greenBorder: #a7f3d0   greenText: #047857   greenDot: #059669   greenSolid: #10b981
diffRowBg:     rgba(34,197,94,0.06)   diffRowBorder: rgba(34,197,94,0.35)   diffStrong: #16a34a   diffSoft: #166534
crossBg:       #f1f5f9   crossText: #546578   labelMuted: #475569
orangeBg:      #fff7ed   orangeBorder: #fed7aa   orangeText: #c2410c   orange: #f97316
```

### Home — Dark
```
pageBg:        linear-gradient(180deg,#0a0f1e 0%,#0d1526 45%,#0a1220 100%)
text:          #eef2f8   muted: #9aa7bd   mutedLight: #d3dbe8
navBg:         rgba(13,20,38,0.72)   navBorder: rgba(255,255,255,0.08)   navShadow: 0 14px 50px rgba(0,0,0,0.45)
pillTrackBg:   rgba(255,255,255,0.06)   pillActiveBg: #1c2942   pillActiveShadow: 0 1px 4px rgba(0,0,0,0.35)
switchTrackBg: linear-gradient(180deg,#111b2a,#0b1220)   switchBorder: rgba(255,255,255,0.15)   switchKnobBg: #0b1220
ctaBg:         #2f7fe0   ctaText: #ffffff
cardBg:        #111a2e   cardBorder: rgba(255,255,255,0.08)
cardShadow:    0 14px 36px rgba(0,0,0,0.35)   cardShadowLg: 0 16px 40px rgba(0,0,0,0.4)
footerBg:      #0a0f1e   footerBorder: rgba(255,255,255,0.08)   footerMuted: #d3dbe8
inputBorder:   rgba(255,255,255,0.14)   inputBg: rgba(255,255,255,0.03)   inputFieldBg: #16203a   inputPlaceholder: #7c8aa3
sectionAltBg:  #0d1526
pricingBg:     linear-gradient(180deg,#0d1526 0px,#0a1220 30%,#070b14 calc(100% - 160px),#0a0f1e 100%)
heroEndSolid:  #0d1526   pricingStart: #0d1526   pricingMid: #0a1220   pricingEnd: #070b14
heroFade:      linear-gradient(180deg, rgba(8,12,24,0.35) 0px, rgba(8,12,24,0) 220px, rgba(8,12,24,0) calc(100% - 260px), #0d1526 100%)
cloudFilter:   brightness(0.42) saturate(1.15) contrast(1.05)   cloudOpacity: 0.85
chipBg:        rgba(255,255,255,0.06)   chipBorder: rgba(255,255,255,0.1)
wordmarkA:     #8fb8f0   wordmarkB: #4e9bf5   birdColor: #f4f6fb   hazeColor: #0a1220
greenBg:       rgba(16,185,129,0.12)   greenBorder: rgba(16,185,129,0.4)   greenText: #34d399   greenDot: #10b981   greenSolid: #10b981
diffRowBg:     rgba(16,185,129,0.1)   diffRowBorder: rgba(16,185,129,0.4)   diffStrong: #34d399   diffSoft: #a7f3d0
crossBg:       rgba(255,255,255,0.06)   crossText: #d3dbe8   labelMuted: #c7d2e3
orangeBg:      rgba(249,115,22,0.12)   orangeBorder: rgba(249,115,22,0.4)   orangeText: #fb923c   orange: #f97316
```

### Research / Survey / Contact — Light & Dark
Same structural token names, slightly simpler (no `sectionAltBg`/`pricing*`/`diff*`/`green*` needed on Contact; Survey/Research keep `orange*`/`green*` respectively). See each `reference-*.html`'s inline `getTheme()` function for the exact per-page values — they follow the same naming/value conventions as Home above, just without Home's "premium" light-mode boost (feel free to apply Home's richer shadows/borders to these three for visual consistency — the user's last open request was to bring the light mode of the other 3 pages up to the same standard as Home).

### Shared type scale
- Display/headings: **Inter Tight**, weight 900, `letter-spacing: -0.02em`, sizes via `clamp()` (e.g. `clamp(1.8rem, 4vw, 2.8rem)`).
- Body: **Inter**, weights 400–700.
- Handwritten hero headline: **Caveat**, weight 700.
- Italic accent phrases (e.g. "a chatbot.", "the others?"): **Instrument Serif**, italic.
- All four fonts loaded from Google Fonts in `<head>`.

### Shared shape scale
- Pills/buttons: `border-radius: 99px`.
- Cards: `18–24px` border-radius depending on size.
- Small badges/icon tiles: `12–16px`.

---

## Assets
- `hero-clouds-wide.png` — the sky/cloud background photo used on every page (same file, themed via CSS `filter` + `opacity`, never swapped for a different asset between light/dark).
- `bluestift-mark.jpeg` — circular brand mark, used in navbar (28px) and footer (26px, squared/rounded-rect).
- No icon font/library — all small icons (sun, moon, check, cross, birds) are minimal inline SVGs (a few circles/paths), not an icon set.

## Next.js / TypeScript / Tailwind Implementation

The `nextjs/` folder contains **actual, ready-to-drop-in React/TypeScript source** for the parts that are fragile to reimplement from scratch (theme system + cloud background) — not just the reference HTML:

- `nextjs/lib/theme.ts` — the full `Theme` TS interface + `getTheme(isDark)`, exact values from Design Tokens above.
- `nextjs/hooks/useThemeMode.ts` — SSR-safe dark/light hook (localStorage read deferred to `useEffect`, so it won't hydration-mismatch in Next.js).
- `nextjs/components/ThemeToggle.tsx` — the pill switch component.
- `nextjs/components/Navbar.tsx` — the shared navbar.
- `nextjs/components/CloudBackground.tsx` — the 3-layer sky system, with a `variant="hero" | "fixed"` prop covering both usages (Home vs. the other 3 pages), and inline comments on the exact pitfalls from the section above (z-index/stacking, `overflow:hidden` clipping, `next/image` recompression).
- `nextjs/examples/HomeHero.example.tsx` and `nextjs/examples/ResearchPage.example.tsx` — full working compositions showing how Navbar + CloudBackground + theme tokens fit together for each of the two background patterns (contained-to-hero vs. fixed-to-viewport).
- `nextjs/tailwind.config.snippet.ts` — every `@keyframes`/`animation` entry, ready to merge into `theme.extend` if you want Tailwind utility classes (e.g. `animate-cloudZoom`) instead of the inline `style={{ animation }}` used in the example components (both work identically — inline styles were used in the examples so they're copy-paste-safe regardless of your Tailwind version/config).
- `nextjs/globals.snippet.css` — the same keyframes as plain CSS (for anyone not using Tailwind) + the Google Fonts `@import`.

Components are written as plain inline `style={{...}}` objects rather than Tailwind classes so they work identically whether you're on Tailwind, CSS Modules, styled-components, or plain CSS — copy the values, not a class name that might not exist in your config. Convert to Tailwind utility classes / `@apply` afterward if you prefer, using `tailwind.config.snippet.ts` for the animation names.

The remaining sections (Features, Differentiators, Pricing, Footer, and the Research/Survey/Contact page bodies) aren't transcribed component-by-component here — they're plain JSX using the exact same `theme.<token>` values and the layout/copy spec already documented above; only the two genuinely fragile systems (theme + sky) are provided as finished code.

## Files
- `reference-Home.html`
- `reference-Research.html`
- `reference-Survey.html`
- `reference-Contact.html`
- `support.js` — runtime required only to render these specific reference files in a browser (the internal prototyping tool's template engine). **Not relevant to your Next.js implementation** — do not port this file or its `<script>`/template syntax; it's here only so the references open and animate correctly for you to inspect.

Open any of the `reference-*.html` files directly in a browser (double-click, or serve the folder statically — file:// works fine here since everything is relative) to see the live, interactive reference — reload to replay entrance animations, click the theme pill to compare Day/Night.
