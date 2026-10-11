"""Tile out/stills/*.png into out/sheet.png with each still's time on it (dev aid)."""
import glob, sys
from PIL import Image, ImageDraw
fs = sorted(glob.glob("out/stills/t*.png"))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cols = int(sys.argv[1]) if len(sys.argv) > 1 else 3
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "white")
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 80, y + 20], fill="black")
    d.text((x + 5, y + 4), f.split("t")[-1][:-4], fill="white")
sheet.save("out/sheet.png")
