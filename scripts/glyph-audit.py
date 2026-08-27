#!/usr/bin/env python3
"""Report size consistency across the glyph set.

The glyphs have no badge ring any more, so there is nothing to be contained
by; what matters instead is that every glyph reads at the same visual size.
This measures each one's actual ink extents and flags outliers.

    python3 tauri-application/scripts/glyph-audit.py [glyph-dir]

Measurement is done by rasterising, not by parsing paths, because <text>
glyphs have no geometry in the file - their extents depend on the font.
Rendering happens on a canvas padded well beyond the viewBox: measuring
inside the nominal box silently truncates any ink that overruns it, which
reads back as a too-small glyph.
"""
from __future__ import annotations

import os
import re
import statistics
import subprocess
import sys
import tempfile

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow: pip install pillow")

PX = 240          # render resolution across the nominal viewBox
PAD = 24.0        # extra canvas on every side, in viewBox units
BOX_W, BOX_H = 21.5, 20.5     # the target the set is normalised to
VIEWBOX = 24.0


def ink_bbox(svg_text, pad=PAD):
    """(x0, y0, x1, y1, w, h) of the ink in viewBox units, or None if blank."""
    m = re.search(r'viewBox="([^"]+)"', svg_text)
    if not m:
        return None
    vb = [float(v) for v in m.group(1).split()]
    if pad:
        svg_text = svg_text.replace(
            m.group(0),
            f'viewBox="{vb[0]-pad} {vb[1]-pad} {vb[2]+2*pad} {vb[3]+2*pad}"', 1)
        px = int(PX * (vb[2] + 2 * pad) / vb[2])
        vb = [vb[0] - pad, vb[1] - pad, vb[2] + 2 * pad, vb[3] + 2 * pad]
    else:
        px = PX
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(svg_text)
        src = f.name
    png = src + ".png"
    try:
        subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px),
                        "-b", "white", src, "-o", png], check=True)
        im = Image.open(png).convert("L")
        bb = Image.eval(im, lambda v: 255 - v).getbbox()
    finally:
        for p in (src, png):
            if os.path.exists(p):
                os.unlink(p)
    if not bb:
        return None
    k = vb[2] / px
    x0, x1 = vb[0] + bb[0] * k, vb[0] + bb[2] * k
    y0, y1 = vb[1] + bb[1] * k, vb[1] + bb[3] * k
    return x0, y0, x1, y1, x1 - x0, y1 - y0


def main(root="tauri-application/static/glyphs/default"):
    rows = []
    for cat in ("aspects", "planets", "zodiac"):
        d = os.path.join(root, cat)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".svg"):
                continue
            src = open(os.path.join(d, fn), encoding="utf-8").read()
            bb = ink_bbox(src)
            if bb:
                rows.append((f"{cat}/{fn[:-4]}", "<text" in src, *bb))
    if not rows:
        sys.exit(f"no glyphs found under {root}")

    def show(sel, label):
        hs = [r[7] for r in sel]
        print(f"{label}: n={len(sel)}  height mean {statistics.mean(hs):5.2f}  "
              f"range {min(hs):5.2f}-{max(hs):5.2f}")

    print(f"glyphs measured: {len(rows)}   target box {BOX_W} x {BOX_H}\n")
    show([r for r in rows if not r[1]], "symbols")
    show([r for r in rows if r[1]], "text labels")

    clipped = [r for r in rows if r[2] < 0.2 or r[3] < 0.2
               or r[4] > VIEWBOX - 0.2 or r[5] > VIEWBOX - 0.2]
    over = [r for r in rows if r[6] > BOX_W + 0.1 or r[7] > BOX_H + 0.1]
    off = [r for r in rows
           if abs((r[2] + r[4]) / 2 - 12) > 0.3 or abs((r[3] + r[5]) / 2 - 12) > 0.3]

    for sel, label in ((clipped, "touching/outside the viewBox"),
                       (over, "larger than the target box"),
                       (off, "not centred on (12,12)")):
        print(f"\n{label}: {len(sel)}")
        for r in sel:
            print(f"    {r[0]:26} x {r[2]:5.2f}..{r[4]:5.2f}  "
                  f"y {r[3]:5.2f}..{r[5]:5.2f}  {r[6]:5.2f} x {r[7]:5.2f}")
    return 1 if (clipped or over or off) else 0


if __name__ == "__main__":
    sys.exit(main(*(sys.argv[1:2] or [])))
