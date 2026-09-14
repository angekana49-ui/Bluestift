# How it works — the explainer video

A ≤2-minute tour of Raya (Chat, Study Rooms, Tools, the Kernel), rendered with
[Remotion](https://www.remotion.dev) from the landing page's **own product
shots** (`components/site/ProductShots.tsx`, `KernelDiagrams.tsx`). Nothing in
the picture is drawn for the video: when a shot changes on the site, re-render
and the video follows.

English only for now. 1920×1080, 30 fps, burned-in captions, two voices in relay,
soft music under the voice.

This is its own package (own `node_modules`), excluded from the app's
typecheck, lint and build.

## Make a video

```bash
cd video
npm install              # once; downloads Remotion's headless Chrome on first render
npm run prepare:assets   # site CSS + marks, draft voices, voice timings, draft music
npm run studio           # preview and scrub in the browser
npm run render           # → out/how-it-works-en.mp4
node scripts/stills.mjs 220 805 1325   # a few frames as PNG, from one bundle
```

## What to edit

| To change | Edit | Then |
|---|---|---|
| The words (voice-over and captions) | `src/script.json` | `npm run prepare:assets` |
| Which shot a scene shows, its speed | `src/HowItWorks.tsx` (`SceneBody`) | render |
| Layout, camera, captions style | `src/ShotScene.tsx`, `src/Captions.tsx`, `src/TitleScenes.tsx` | render |

The timeline is **computed**, not written: each scene lasts as long as its
measured voice lines need (or its `minSeconds`), with spare time spread between
lines. `src/timeline.ts` refuses to build a video longer than 120 s.

## The final voices

The voices in `public/voice/` are **drafts** from Windows' built-in speech
(Zira and Hazel), there only so timing and captions can be judged. For the real
thing, record or generate one WAV per script line (ElevenLabs, a voice actor…),
named `<scene>-<line>.wav` exactly as the drafts are (`chat-0.wav`, `chat-1.wav`,
…), drop them in `public/voice/`, then:

```bash
npm run manifest && npm run render
```

Speaker `A` leads, `B` relays (`script.json` → `voices`). Warm, enthusiastic, clear.

The music in `public/music/bed.wav` is synthesised by `scripts/music-draft.mjs`
(no licence question). Replace it with a licensed track under the same name.

Generated assets (all of `public/`, `src/generated/`, `out/`) are not committed;
`prepare:assets` rebuilds them. Keep final voice recordings somewhere durable —
`public/voice/` is not versioned.

## How the shots are played on the video's clock

The site's shots animate with CSS keyframes that start when they scroll into
view and loop on timers. A render has neither scrolling nor wall-clock time, so
`src/FrozenShot.tsx`, on every frame: puts each shot in its playing state,
seeks every CSS animation to the frame's time, **writes that state into inline
styles and cancels the animation**. The last step matters: seeking alone
updated the computed style, but the headless compositor kept painting the old
position, so the chat shot showed the same half-played frame for its whole
scene. It also points the shots' root-relative images (`/raya-mark.png`) at this
package's `public/` and holds the frame until they load.

Two other things that bit, so they don't again:

- **One React.** The shots live outside this package, so `react` must be
  aliased to a single copy (`webpack-override.mjs`), and it must be *this*
  package's copy — Remotion's own aliases already point here, and pinning to the
  app's copy mixed React 19.2 and 19.3 in one bundle.
- **`globals.css` is synced, not copied by hand** (`scripts/sync-css.mjs`),
  minus its `@tailwind` directives and root-relative `url()`s.

## Licence

Remotion is free for individuals and companies of up to three people; above
that it needs a company licence. See remotion.dev/license.
