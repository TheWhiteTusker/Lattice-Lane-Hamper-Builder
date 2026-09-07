"""
Cut the app's logo files out of the master artwork.

    python scripts/build-brand-assets.py

The master (docs/brand/lattice-lane-logo.png) is black line art on white, one
stacked lockup: the nest mark, LATTICE LANE, HOUSE OF GIFTING, a rule, and the
LLP line. Nothing in the app can use it as-is - the header sits on the sage
green bar, so the artwork has to be white on transparency, and at header height
the two smallest lines render about six pixels tall, which is mush.

So this script re-cuts it three ways. The bands are found by looking for rows
that contain ink, not by hard-coded pixel offsets, so re-exporting the master at
a different size or with different margins still works.

Run it again after replacing the master; the outputs are committed so a normal
build never needs Pillow.
"""

from PIL import Image
import numpy as np
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/brand/lattice-lane-logo.png"
SAGE = (84, 101, 91)  # --color-brand

master = Image.open(SRC).convert("L")
ink = np.array(master) < 128


def bands():
    """Row ranges containing ink, top to bottom."""
    rows = ink.any(axis=1)
    out, start = [], None
    for i, filled in enumerate(rows):
        if filled and start is None:
            start = i
        elif not filled and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(rows)))
    return out


def crop(top, bottom):
    """Tightly crop rows [top, bottom) to their own ink, as white on alpha."""
    cols = ink[top:bottom].any(axis=0)
    x0, x1 = cols.argmax(), len(cols) - cols[::-1].argmax()
    box = master.crop((x0, top, x1, bottom))
    # The artwork is black on white, so darkness is coverage: invert it into the
    # alpha channel and the shape survives with its antialiasing intact.
    alpha = Image.eval(box, lambda v: 255 - v)
    white = Image.new("RGBA", box.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def scaled(img, height):
    return img.resize(
        (max(1, round(img.width * height / img.height)), height), Image.LANCZOS
    )


mark_band, wordmark_band, *_ = bands()
mark = crop(*mark_band)
wordmark = crop(*wordmark_band)

# Header: the mark beside LATTICE LANE. The tagline and the LLP line are
# deliberately dropped - the bar is ~32px tall and they would be illegible.
# The mark runs taller than the wordmark, which is how the stacked original
# reads too.
WORD_H = 140
mark_h, gap = round(WORD_H * 1.45), round(WORD_H * 0.55)
m, w = scaled(mark, mark_h), scaled(wordmark, WORD_H)
header = Image.new("RGBA", (m.width + gap + w.width, mark_h), (255, 255, 255, 0))
header.paste(m, (0, 0), m)
header.paste(w, (m.width + gap, (mark_h - w.height) // 2), w)
header.save(ROOT / "public/lattice-lane-logo.png")

# Login: the whole lockup, which has room to breathe on a full screen.
top = bands()[0][0]
bottom = bands()[-1][1]
crop(top, bottom).save(ROOT / "public/lattice-lane-lockup.png")

# Favicon: the mark alone on the brand sage. Black on transparency would vanish
# against a dark tab strip; a filled tile reads the same either way. Next picks
# src/app/icon.png up by name.
SIDE = 512
icon = Image.new("RGBA", (SIDE, SIDE), (*SAGE, 255))
m = scaled(mark, round(SIDE * 0.72))
icon.paste(m, ((SIDE - m.width) // 2, (SIDE - m.height) // 2), m)
icon.save(ROOT / "src/app/icon.png")

for p in ("public/lattice-lane-logo.png", "public/lattice-lane-lockup.png", "src/app/icon.png"):
    print(f"{p:38} {Image.open(ROOT / p).size}")
