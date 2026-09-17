# Welcome to Bluestift — the explainer film

A three-minute film of the whole product — Raya, Study Rooms, Tools, Bluestift
Schools, the Kernel, and the controls people keep — rendered with
[Remotion](https://www.remotion.dev) from the landing page's **own product
shots** (`components/site/ProductShots.tsx`, `KernelDiagrams.tsx`,
`DashboardMockup.tsx`). When a shot changes on the site, re-render and the film
follows.

English, 1920×1080 at 30 fps (rendered at 2× for delivery), no captions: the
voice carries the words, the picture carries what they mean.

This is its own package (own `node_modules`), excluded from the app's
typecheck, lint and build.

## Make the film

```bash
cd video
npm install              # once; downloads Remotion's headless Chrome on first render
npm run prepare:assets   # site CSS + marks, the soundtrack, the screen textures
npm run studio           # preview and scrub in the browser
npm run render           # → out/how-it-works-en.mp4
node scripts/stills.mjs 18.3 53.2 116.6   # a few moments as PNG (seconds)
```

## The sound comes first

`npm run soundtrack` (scripts/soundtrack.mjs) builds `public/audio/soundtrack.wav`
and `src/generated/soundtrack.json` from two recordings in `narration/`:

- `narration-en.mp3` — the ElevenLabs narration, every line of `src/script.json`
  in one take;
- `music-en-iphone.mp3` — the instrumental.

It aligns the script to the narration line by line (and phrase by phrase, and
roughly word by word), re-edits the music in whole bars so each section starts on
a change of the music, places every section's first word where
`src/soundtrack.json` says, keeps at least `minSpeakerGap` between two voices,
plays everything at `speed`, EQs and ducks the music under the voice and levels
the mix to −16 LUFS. `out/soundtrack-preview.mp4` is the result on its own.

The picture never sets a time of its own. Every move in `src/scenes/` is pinned
to something you can hear — `line()`, `phrase()`, `wordAt()` and the music's
section changes (`MUSIC`) from `src/timeline.ts` — so re-running the soundtrack
moves the picture with it.

## What to edit

| To change | Edit | Then |
|---|---|---|
| Where a section starts, speed, gaps, the music edit, the mix | `src/soundtrack.json` | `npm run soundtrack` |
| The words | `src/script.json` — and a new narration take | `npm run soundtrack` |
| What a section shows, its camera | `src/scenes/<Section>.tsx` | render |
| The sky, day and night | `src/Sky.tsx` (`nightAt`) | render |
| The birds, the marks | `src/Birds.tsx`, `src/Marks.tsx` | render |
| The drawn screens (login, settings, sub-processors) | `src/screens.tsx` | render |

Dev tools: `scripts/gallery.mjs` (a contact sheet of the site's shots, light and
dark, at any moment of their choreography) and `scripts/measure.mjs` (where a
piece of text sits inside a shot, for aiming the camera at it).

## How the shots are played on the film's clock

The site's shots animate with CSS keyframes that start when they scroll into
view and loop on timers. A render has neither scrolling nor wall-clock time, so
`src/FrozenShot.tsx`, on every frame: puts each shot in its playing state, seeks
every CSS animation to the frame's time, writes that state into inline styles,
cancels the animation, and then **removes the classes that hold the start
states**. Every step was learnt the hard way: seeking alone left the compositor
painting the old position; `commitStyles` does nothing for SVG, so the Kernel
diagrams' values are read back and written by hand; and with the start-state
classes left on, Chrome kept painting SVG discs at `opacity: 0` whatever the
inline style said.

The hero dashboard animates once at page load, which nothing can seek: the film
switches those animations off and plays the same entrance itself
(`src/reveal.ts`).

The wide shots — the ecosystem, the closing mosaic — show every screen at once,
too small to read and too many to render live, so they use pictures of the
finished screens: `npm run textures` renders them into `public/textures/`.

Two other things that bit:

- **One React.** The shots live outside this package, so `react` is aliased to
  this package's copy (`webpack-override.mjs`).
- **`globals.css` is synced, not copied by hand** (`scripts/sync-css.mjs`),
  minus its `@tailwind` directives and root-relative `url()`s.

Generated assets (all of `public/`, `src/generated/`, `out/`) are not
committed; `prepare:assets` rebuilds them from `narration/` and the site.

## Licence

Remotion is free for individuals and companies of up to three people; above
that it needs a company licence. See remotion.dev/license.
