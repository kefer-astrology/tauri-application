#!/usr/bin/env python3
"""Flatten potrace wrapper transforms in app-shell icons.

potrace emits every glyph as a path wrapped in

    <g transform="translate(0,H) scale(0.1,-0.1)" fill="#000">

The negative Y scale is a vertical flip. Nothing downstream handles it: the
canvas sync parser tracks a single uniform scale factor, so it reads the X
scale and silently drops the flip, placing the artwork far outside the
viewBox. Rather than thread a flip through the whole pipeline, bake the
transform into the path data once, leaving a plain un-transformed path that
round-trips like the astrology glyphs already do.

    python3 tauri-application/scripts/appshell-normalize.py --check   # report only
    python3 tauri-application/scripts/appshell-normalize.py           # rewrite

Rendering is unchanged: the icons are consumed as CSS `mask-image`, so the
fill colour never reaches the screen, and the baked geometry is identical.
Verify that claim with --verify (needs rsvg-convert + ImageMagick).

No dependencies - stdlib Python 3 only.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = os.path.abspath(os.path.join(HERE, "..", ".."))
DEFAULT_DIR = os.path.join(SPACE, "tauri-application", "static", "app-shell",
                           "icons", "default")

# Commands whose parameters are all coordinate pairs. potrace only ever emits
# these; anything else means the file did not come from potrace and is left
# alone rather than mangled.
PAIR_COMMANDS = set("MmLlCcSsQqTt")
NO_PARAM_COMMANDS = set("Zz")

TOKEN = re.compile(r"[MmLlCcSsQqTtAaHhVvZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?")


def num(v: float) -> str:
    """Trim to 4dp without trailing zeros, matching the sync tool's style."""
    s = f"{round(v, 4):.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def transform_path(d: str, sx: float, sy: float, tx: float, ty: float) -> str:
    """Apply x' = sx*x + tx, y' = sy*y + ty to every coordinate in `d`.

    Absolute commands take the full affine; relative ones take only the
    linear part, since a delta carries no translation.
    """
    tokens = TOKEN.findall(d)
    out: list[str] = []
    i = 0
    cmd = None
    while i < len(tokens):
        t = tokens[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t
            out.append(cmd)
            i += 1
            if cmd in NO_PARAM_COMMANDS:
                continue
            if cmd not in PAIR_COMMANDS:
                raise ValueError(f"unsupported path command {cmd!r}")
            continue
        if cmd is None:
            raise ValueError("path data starts with a number")

        # An implicit repeat after M/m is a lineto, but both are pair-shaped,
        # so the coordinate maths is identical and we need no special case.
        x, y = float(tokens[i]), float(tokens[i + 1])
        absolute = cmd.isupper()
        # The very first moveto is absolute even when written lowercase.
        if cmd == "m" and len([o for o in out if re.match(r"[A-Za-z]", o)]) == 1:
            absolute = True
        if absolute:
            x, y = sx * x + tx, sy * y + ty
        else:
            x, y = sx * x, sy * y
        out.append(num(x))
        out.append(num(y))
        i += 2
    return " ".join(out)


# Literal blacks the sync tool would carry through as hardcoded colours
# instead of binding to the ink variable.
BLACKS = ("#000", "#000000", "black")


def recolor(src: str) -> tuple[str, bool]:
    """Point fill/stroke at currentColor so the canvas can theme them."""
    out = src
    for attr in ("fill", "stroke"):
        for black in BLACKS:
            out = out.replace(f'{attr}="{black}"', f'{attr}="currentColor"')
    return out, out != src


def rounded_rect_path(w: float, h: float, r: float) -> str:
    """Rounded rectangle as path data, corners as arcs."""
    return (f"M {num(r)} 0 H {num(w - r)} A {num(r)} {num(r)} 0 0 1 {num(w)} {num(r)} "
            f"V {num(h - r)} A {num(r)} {num(r)} 0 0 1 {num(w - r)} {num(h)} "
            f"H {num(r)} A {num(r)} {num(r)} 0 0 1 0 {num(h - r)} "
            f"V {num(r)} A {num(r)} {num(r)} 0 0 1 {num(r)} 0 Z")


def flatten_mask(src: str) -> tuple[str, bool]:
    """Collapse a <defs><mask> knockout into one even-odd path.

    The logo mark is a filled rounded rect with the wordmark masked out. The
    .pen schema has no mask concept, so the same result is expressed as a
    single path: the rect outline plus the wordmark subpaths, filled even-odd
    so the letterforms punch holes. A glyph's own counter sits at three
    crossings and fills back in, which is what the mask did too.
    """
    if "<mask" not in src or "mask=" not in src:
        return src, False

    mrect = re.search(r'<rect[^>]*\brx="([\d.]+)"[^>]*mask="url\(#[^)]+\)"[^>]*>', src)
    if not mrect:
        return src, False
    r = float(mrect.group(1))

    vb = re.search(r'viewBox="([^"]+)"', src)
    _, _, w, h = (float(v) for v in vb.group(1).split())

    body = src[src.index("<mask"):src.index("</mask>")]
    g = re.search(r'<g\s+transform="translate\(([-\d.]+),([-\d.]+)\)\s*'
                  r'scale\(([-\d.]+),([-\d.]+)\)"', body)
    if not g:
        return src, False
    tx, ty, sx, sy = (float(g.group(i)) for i in (1, 2, 3, 4))

    subpaths = [transform_path(d, sx, sy, tx, ty)
                for d in re.findall(r'<path[^>]*\bd="([^"]*)"', body)]

    merged = " ".join([rounded_rect_path(w, h, r), *subpaths])
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(h)}">'
           f'<path fill="currentColor" fill-rule="evenodd" d="{merged}"/>'
           f'</svg>\n')
    return out, True


def normalize(src: str) -> tuple[str, bool]:
    """Return (new_source, changed)."""
    flat, did = flatten_mask(src)
    if did:
        return flat, True

    m = re.search(r'<g\s+transform="translate\(([-\d.]+),([-\d.]+)\)\s*'
                  r'scale\(([-\d.]+),([-\d.]+)\)"([^>]*)>', src)
    if not m:
        # No potrace wrapper, but it may still carry a literal black.
        return recolor(src)
    tx, ty, sx, sy = (float(m.group(i)) for i in (1, 2, 3, 4))
    g_attrs = m.group(5)

    fill = re.search(r'fill="([^"]*)"', g_attrs)
    # The file is used as a mask, so the literal colour is never rendered;
    # currentColor keeps it consistent with the astrology glyph set.
    fill_value = "currentColor" if fill and fill.group(1) != "none" else None

    def redo(pm):
        d = pm.group(1)
        return 'd="%s"' % transform_path(d, sx, sy, tx, ty)

    body = src[m.end():]
    body = body[:body.rindex("</g>")] + body[body.rindex("</g>") + 4:]
    body = re.sub(r'd="([^"]*)"', redo, body)

    head = src[:m.start()]
    if fill_value:
        body = body.replace("<path ", f'<path fill="{fill_value}" ')
    return head + body, True


def render(path: str, out: str, size: int = 256) -> bool:
    try:
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size),
                        path, "-o", out], check=True,
                       capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def compare(a: str, b: str) -> float | None:
    """Mean absolute error between two PNGs, or None if unavailable."""
    try:
        r = subprocess.run(["compare", "-metric", "MAE", a, b, "null:"],
                           capture_output=True, text=True)
        # ImageMagick prints a near-zero normalised value in scientific
        # notation (1.25e-06); a plain [\d.]+ pattern misses it and the
        # caller then reports a perfect match as "cannot compare".
        m = re.search(r"\(([\d.eE+-]+)\)", r.stderr)
        return float(m.group(1)) if m else None
    except FileNotFoundError:
        return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default=DEFAULT_DIR)
    ap.add_argument("--check", action="store_true",
                    help="report what would change, write nothing")
    ap.add_argument("--verify", action="store_true",
                    help="rasterise before/after and compare pixels")
    ap.add_argument("--only", nargs="+", metavar="STEM",
                    help="limit to these files (with or without .svg)")
    args = ap.parse_args(argv)

    files = sorted(f for f in os.listdir(args.dir) if f.endswith(".svg"))
    if args.only:
        want = {o[:-4] if o.endswith(".svg") else o for o in args.only}
        files = [f for f in files if f[:-4] in want]
    changed, skipped, failures = [], [], []

    for fn in files:
        p = os.path.join(args.dir, fn)
        with open(p, encoding="utf-8") as fh:
            src = fh.read()
        try:
            new, did = normalize(src)
        except ValueError as e:
            failures.append(f"{fn}: {e}")
            continue
        if not did:
            skipped.append(fn)
            continue

        if args.verify:
            with tempfile.TemporaryDirectory() as td:
                a, b = os.path.join(td, "a.png"), os.path.join(td, "b.png")
                nf = os.path.join(td, fn)
                with open(nf, "w", encoding="utf-8") as fh:
                    fh.write(new)
                if render(p, a) and render(nf, b):
                    mae = compare(a, b)
                    if mae is None:
                        print(f"  {fn}: cannot compare (ImageMagick missing)")
                    elif mae > 0.01:
                        failures.append(f"{fn}: renders differently (MAE {mae:.4f})")
                        continue
                    else:
                        print(f"  {fn}: pixel-identical (MAE {mae:.4f})")
                else:
                    print(f"  {fn}: cannot rasterise (rsvg-convert missing)")

        changed.append(fn)
        if not args.check:
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(new)

    verb = "would normalize" if args.check else "normalized"
    print(f"\n{verb} {len(changed)} file(s); {len(skipped)} already clean.")
    if skipped:
        print("  untouched: " + ", ".join(skipped))
    for f in failures:
        print(f"  FAILED {f}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
