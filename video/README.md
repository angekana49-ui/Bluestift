# Welcome to Bluestift — the explainer film

A film of just under three minutes (177.9 s) of the whole product — Raya, Study
Rooms, Tools, Bluestift Schools, the Kernel, and the controls people keep —
made with [Remotion](https://www.remotion.dev) as motion design over the
owner's narration and music: colour fields that change with the music, type set
on the word as it is said, line drawings that build themselves, and the
product's own pieces (a composer, a chat, a report, a heatmap) redrawn large.

English, 1920×1080 at 30 fps, mastered at 4K and delivered at 1080p under
100 MB. This is its own package (own `node_modules`), excluded from the app's
typecheck, lint and build.

## Make the film

```bash
cd video
npm install              # once; downloads Remotion's headless Chrome on first render
npm run prepare:assets   # fonts and marks compiled into the bundle, the soundtrack built
npm run studio           # preview and scrub in the browser
npm run render           # → out/welcome-to-bluestift.mp4 (+ poster)
node scripts/stills.mjs 18.3 53.2 116.6 --scale=0.5   # a few moments as PNG (seconds)
python scripts/sheet.py 4                            # tile them into out/sheet.png
node scripts/subtitles.mjs                           # → out/welcome-to-bluestift.vtt + .srt
```

`npm run render` is two steps, both resumable:

- `scripts/master.mjs` renders silent 4K in 150-frame pieces into `out/chunks/`.
  A piece is written as `.part.mp4` and renamed when complete, finished ranges
  are listed in `done.json`, and a lock stops two renders running at once — so
  an interruption costs one piece, never the film. Re-run it to resume.
- `scripts/deliver.mjs` joins the pieces, lays the soundtrack on, scales to
  1080p with lanczos and encodes two-pass to a target size (`--mb=95`).

## The sound comes first

`node scripts/soundtrack.mjs` builds `public/audio/soundtrack.wav` and
`src/generated/soundtrack.json` from the two recordings in `narration/`: the
narration (every line of `src/script.json` in one take; `script-en.md` is the
same script to read) and the instrumental. It aligns the script to the take line
by line, phrase by phrase and roughly word by word, re-edits the music in whole
bars so each section starts on a change of the music, places each section's
first word where `src/soundtrack.json` says, and levels the mix.

The picture never sets a time of its own: every move in `src/film/` is pinned to
something you can hear — `line()`, `phrase()`, `wordAt()` and the music's
changes (`MUSIC`) from `src/timeline.ts`. Re-run the soundtrack and the picture
moves with it.

## What to edit

| To change | Edit | Then |
|---|---|---|
| Where a section starts, speed, the music edit, the mix | `src/soundtrack.json` | `node scripts/soundtrack.mjs` |
| The words | `src/script.json` — and a new narration take | `node scripts/soundtrack.mjs` |
| A scene | `src/film/<Scene>.tsx` | render |
| The shared look (palette, type, reveals, grain) | `src/film/kit.tsx` | render |

## Licence

Remotion is free for individuals and companies of up to three people; above
that it needs a company licence. See remotion.dev/license.
