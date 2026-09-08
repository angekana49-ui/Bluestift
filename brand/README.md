# Brand marks — vector source

Five SVGs: the Bluestift bird and the Raya flower, each as colour art plus a
white-only silhouette for use on a dark background, and one dedicated black
outline (`raya-mark-black.svg`) for contexts that need pure black.

`scripts/render-brand-icons.mjs` turns these into everything in `public/`
that carries the marks — the nav-sized PNGs, both apps' PWA icons, the
maskable icons, and the Apple touch icons. Run it after editing any of these
five files, then bump `VERSION` in `public/sw.js` (see the comment there for
why — the service worker's shell cache never revalidates a stable asset that
keeps its filename).

## Where these came from

Bluestift's and Raya's marks originally existed only as a handful of AI-image
crops (`.archive/assets/logos/*.png`, `scripts/process-logos.py`) — raster,
capped at their native ~500px, and each icon size that pipeline produced was
a fresh resize of that same ceiling. Fine for a 256px nav mark; visibly soft
once resized up to a 512px PWA icon, and no path to ever go bigger (print,
merch, a hero-sized rendering) without redrawing from scratch.

These five SVGs are a faithful vector trace of that same artwork (via
`vtracer`, a colour-aware bitmap-to-vector tracer — not a reinterpretation:
the shapes and colours were extracted from the existing marks, not redrawn
from a text description), then hand-cleaned:

1. Background removed at full source resolution (reusing
   `process-logos.py`'s border-flood-fill, just without its later
   downscale-to-256 step) — see `.archive/assets/logos` inside
   `archive-backup.tar.gz` for the untouched raw crops these started from.
2. Traced twice per mark, deliberately with different settings: `stacked`
   hierarchical mode (layered, overlapping regions) for the colour SVGs,
   because it reproduces the gradient shading better; `cutout` mode
   (non-overlapping regions) for deriving the white silhouettes, because a
   flat white recolour of a *stacked* trace paints over the artwork's own
   negative space (the gaps between the flower's petals, the compass and
   chain-link cut into the bird) — those interior "gap" regions and the
   ink strokes both end up opaque white with nothing to tell them apart,
   and the silhouette turns into a solid blob. Cutout mode keeps every
   region distinct, so the gap regions could be dropped (`fill="none"`)
   instead of recoloured, leaving them to show whatever sits behind the icon
   — which for the maskable/Apple icons is `NAVY` in
   `render-brand-icons.mjs`, matching `theme.ts`'s `ctaBg`.
3. Every remaining ink path forced to solid white for the two `*-white.svg`
   files; `raya-mark-black.svg` was already a dedicated near-black trace, no
   recolouring needed.
4. Cleaned up with `svgo --multipass` (~60% smaller, same look — spot-checked
   by re-rendering before/after).

None of this is meant to be re-run casually — steps 1–3 need a Python
environment with Pillow and `pip install vtracer`, plus a fair amount of
per-image judgement (which hierarchical mode, which near-white threshold
counts as "a gap"). If the source art ever changes, redo it by hand and
re-check every output visually before committing; don't just point a script
at a new image and trust it.
