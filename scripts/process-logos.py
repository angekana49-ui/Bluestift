"""
Turn the delivered logo crops in assets/logos into the canonical brand marks in
public/. Run from the repo root:  python scripts/process-logos.py
Needs Pillow. The sources live outside /public deliberately — they are 1.5 MB of
raw crops with no runtime use, and everything under /public is served publicly.

AFTER RUNNING THIS, BUMP `VERSION` IN public/sw.js. The marks keep their
filenames, and the service worker caches /public images with no revalidation, so
returning visitors would otherwise keep the previous logo forever.

Each source is a screenshot-style crop: opaque baked background, off-centre,
inconsistent aspect ratio, and (on the navy ones) leftover white strips from the
crop. This produces square, transparent, 256x256 marks.

Steps per file:
  1. Flood-fill the background from the border only. Border-connected fill is
     what preserves the WHITE INSIDE the artwork (the petals and the compass
     face are white too) - a global "make white transparent" would punch holes
     through the mark itself.
  2. Drop leftover crop strips: any opaque island that still touches the image
     edge and is thin in one dimension.
  3. Trim to the artwork, pad to a centred square with a 10% margin so the mark
     doesn't collide with the circular masks the UI applies.
  4. Downscale to 256x256 (Lanczos), quantise to a small palette, and write an
     optimised PNG.
"""

from collections import deque
from pathlib import Path
from PIL import Image

SRC = Path("assets/logos")
OUT = Path("public")
SIZE = 256
MARGIN = 0.10
# These are flat-colour marks: a small palette is visually lossless on them and
# cuts the PNG roughly 4x (38 KB -> 9 KB), which is the whole point on the 2G/3G
# connections this product targets. Do NOT drop this step — without it the marks
# ship at ~4x weight and undo the gain over the raw crops.
COLORS = 64
TOLERANCE = 60  # squared-distance threshold per channel triple, tuned per below

# global_clear: also clear background-coloured pixels ENCLOSED by the artwork,
# not just those reachable from the border. Safe only when the artwork contains
# no background colour of its own — true for the two dark marks (white line art
# on navy), false for the light ones (their petals and compass face are white,
# the same white as the background, so a global clear would gut them).
JOBS = [
    ("bird-blue-on-white.png", "bluestift-mark.png", False),
    ("bird-white-on-navy.png", "bluestift-mark-dark.png", True),
    ("flower-blue-on-white.png", "raya-mark.png", False),
    ("flower-white-on-navy.png", "raya-mark-dark.png", True),
    ("flower-black-on-white.png", "raya-mark-black.png", False),
]


def close(a, b, tol=TOLERANCE):
    return (
        abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol
    )


def flood_background(im):
    """Clear background pixels reachable from the border. Returns pixels cleared."""
    w, h = im.size
    px = im.load()
    # Background = the dominant colour around the WHOLE border, not the corners.
    # The navy crops carry white strips along two edges, so three of four corners
    # can be strip-white; sampling corners alone picks the strip and leaves the
    # real background untouched. Quantise to 1/8 so anti-aliasing doesn't split
    # the vote across near-identical shades.
    # A plain border vote still ties on the bird: its white crop strips run the
    # full right and bottom edges, matching the navy on the other two. So among
    # the colours that appear on the border, take the one covering the most of
    # the IMAGE — a background fills the canvas, a crop strip never does.
    def key_of(c):
        return (c[0] // 8, c[1] // 8, c[2] // 8)

    on_border = set()
    for x in range(w):
        on_border.add(key_of(px[x, 0]))
        on_border.add(key_of(px[x, h - 1]))
    for y in range(h):
        on_border.add(key_of(px[0, y]))
        on_border.add(key_of(px[w - 1, y]))

    area = {}
    sample = {}
    for x in range(w):
        for y in range(h):
            c = px[x, y]
            k = key_of(c)
            if k in on_border:
                area[k] = area.get(k, 0) + 1
                sample.setdefault(k, c)
    bg = sample[max(area, key=area.get)]
    # Using ONE colour (not every colour found on the border) matters: accepting
    # the strip-white too would let the fill eat the white artwork itself.

    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[x][y] and close(px[x, y], bg):
                seen[x][y] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[x][y] and close(px[x, y], bg):
                seen[x][y] = True
                q.append((x, y))

    cleared = 0
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        cleared += 1
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny]:
                if close(px[nx, ny], bg):
                    seen[nx][ny] = True
                    q.append((nx, ny))
    return cleared, bg


def drop_edge_strips(im):
    """Erase opaque islands that touch the border and are thin — crop leftovers."""
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    dropped = []
    for sx in range(w):
        for sy in range(h):
            if seen[sx][sy] or px[sx, sy][3] == 0:
                continue
            comp = []
            q = deque([(sx, sy)])
            seen[sx][sy] = True
            touches = False
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                if x in (0, w - 1) or y in (0, h - 1):
                    touches = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and px[nx, ny][3] > 0:
                        seen[nx][ny] = True
                        q.append((nx, ny))
            xs = [p[0] for p in comp]
            ys = [p[1] for p in comp]
            cw, ch = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            # Thin catches a single strip. Sparse catches the L-shaped pair: the
            # right and bottom strips meet at the corner as ONE component whose
            # bounding box spans the whole canvas while filling almost none of it.
            thin = cw <= w * 0.08 or ch <= h * 0.08
            sparse = len(comp) < cw * ch * 0.15
            if touches and (thin or sparse):
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
                dropped.append((cw, ch, len(comp)))
    return dropped


for src_name, out_name, global_clear in JOBS:
    src = SRC / src_name
    im = Image.open(src).convert("RGBA")
    before = im.size

    cleared, bg = flood_background(im)
    if global_clear:
        w, h = im.size
        px = im.load()
        for x in range(w):
            for y in range(h):
                c = px[x, y]
                if c[3] and close(c, bg):
                    px[x, y] = (0, 0, 0, 0)
                    cleared += 1
    dropped = drop_edge_strips(im)

    bbox = im.getbbox()
    if not bbox:
        print(f"!! {src_name}: nothing left after clearing — SKIPPED")
        continue
    art = im.crop(bbox)

    side = int(max(art.size) * (1 + 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(art, ((side - art.width) // 2, (side - art.height) // 2), art)

    final = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    # FASTOCTREE is the only Pillow quantiser that keeps the alpha channel; the
    # default (median cut) would flatten the transparency we just carved out.
    final = final.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE)
    dest = OUT / out_name
    final.save(dest, "PNG", optimize=True)

    kb = dest.stat().st_size / 1024
    print(
        f"{src_name:28} -> {out_name:24} bg={bg[:3]} cleared={cleared:>6} "
        f"strips={len(dropped)} art={art.size} {before}->{SIZE}x{SIZE} {kb:.1f} KB"
    )
