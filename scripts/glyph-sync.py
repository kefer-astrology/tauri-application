#!/usr/bin/env python3
"""Two-way sync between the Glyphs.pen canvas and static/glyphs/*.

    pull      SVG files  -> Glyphs.pen      (rebuild the canvas sheet from disk)
    push      Glyphs.pen -> SVG files       (write canvas refinements back)
    status    show what push would write, without touching anything
    baseline  adopt the current canvas as the "unchanged" reference

Identity is structural: a section frame named Aspects/Planets/Zodiac gives the
category, and each cell frame's name is the glyph's filename stem. The 56px
"Glyph" frame inside a cell is the unit that maps to one .svg file.

push only writes glyphs whose emitted SVG differs from the baseline, so the
files a designer never touched are never reformatted.

The modern/ set is derived: every file written to default/ is also written to
modern/ with currentColor replaced by the modern ink. Use --no-modern to skip.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = os.path.abspath(os.path.join(HERE, "..", ".."))

DEFAULT_PEN = os.path.join(SPACE, "Glyphs.pen")
DEFAULT_GLYPHS = os.path.join(SPACE, "tauri-application", "static", "glyphs")
DEFAULT_BASELINE = os.path.join(SPACE, ".glyphs-sync.json")

CATEGORIES = {"aspects": "Aspects", "planets": "Planets", "zodiac": "Zodiac"}
SECTION_TO_CATEGORY = {v: k for k, v in CATEGORIES.items()}

INK = "#161616"          # canvas ink; becomes currentColor in default/
MODERN_INK = "#e5e7eb"   # what currentColor becomes in modern/
BOX = 56                 # canvas px per glyph box
CELL = 96
COLS = 10
EPS = 1e-6

# fonts used only for on-canvas rendering; never written into an asset
CANVAS_FONTS = {"Inter", "$font-ui", "$font-sym"}


# ---------------------------------------------------------------- utilities

def num(v: float) -> str:
    """Compact number: at most 3 decimals, no trailing zeros, no '-0'.

    3 decimals in a 24-unit viewBox is ~0.004% of the glyph - far below any
    visual threshold - and it stops rounding drift accumulating over repeated
    pull/push cycles.
    """
    r = round(float(v) + 0.0, 3)
    if r == 0:
        return "0"
    s = f"{r:.3f}".rstrip("0").rstrip(".")
    return s


def parse_len(v) -> float:
    if isinstance(v, (int, float)):
        return float(v)
    return float(re.sub(r"[a-z%]+$", "", str(v).strip()))


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


class Report:
    def __init__(self) -> None:
        self.warnings: list[str] = []

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def flush(self, prefix: str = "warning") -> None:
        for w in self.warnings:
            print(f"{prefix}: {w}")
        self.warnings.clear()


# ------------------------------------------------------------- canvas reader

def load_pen(path: str) -> dict:
    if not os.path.exists(path):
        die(f"canvas file not found: {path}")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def resolve_color(value, variables: dict):
    """Resolve a fill/stroke to a hex string, or None when there is no paint."""
    if value is None:
        return None
    if isinstance(value, list):
        value = value[0] if value else None
        if value is None:
            return None
    if isinstance(value, dict):
        if value.get("enabled") is False:
            return None
        if value.get("type") not in (None, "color"):
            return "UNSUPPORTED:" + str(value.get("type"))
        value = value.get("color")
    if not isinstance(value, str):
        return None
    if value.startswith("$"):
        var = variables.get(value[1:])
        if not var:
            return None
        v = var.get("value")
        if isinstance(v, list):
            v = v[0].get("value") if v else None
        return v if isinstance(v, str) else None
    return value


def find_glyph_cells(doc: dict, report: Report) -> dict[tuple[str, str], dict]:
    """Map (category, stem) -> the 56px Glyph frame node."""
    found: dict[tuple[str, str], dict] = {}

    def walk(node, section):
        if not isinstance(node, dict):
            return
        name = node.get("name")
        if name in SECTION_TO_CATEGORY:
            section = SECTION_TO_CATEGORY[name]
        kids = node.get("children") or []
        # a cell is a frame containing a child frame named "Glyph"
        box = next((k for k in kids if k.get("name") == "Glyph"
                    and k.get("type") == "frame"), None)
        if box is not None and section:
            key = (section, str(name))
            if key in found:
                report.warn(f"duplicate cell {section}/{name} on canvas; "
                            f"using the first")
            else:
                found[key] = box
            return
        for k in kids:
            walk(k, section)

    for child in doc.get("children") or []:
        walk(child, None)
    return found


# ------------------------------------------------------------- SVG emission

def emit_paint(node, variables, report, label):
    """Return (fill_expr, stroke_expr, extra_style_parts)."""
    def conv(raw, what):
        c = resolve_color(raw, variables)
        if c is None:
            return None
        if isinstance(c, str) and c.startswith("UNSUPPORTED:"):
            report.warn(f"{label}: {what} uses "
                        f"{c.split(':', 1)[1]} paint, which cannot be written "
                        f"to SVG; emitted as currentColor")
            return "currentColor"
        if c.upper() in (INK.upper(), "#000000", "#000"):
            return "currentColor"
        return c

    return conv(node.get("fill"), "fill"), conv(node.get("stroke"), "stroke")


def stroke_style(node, fill, stroke, s, k, report, label):
    parts = []
    parts.append(f"fill: {fill}" if fill else "fill: none")
    if stroke:
        parts.append(f"stroke: {stroke}")
        sw = node.get("strokeWidth")
        if isinstance(sw, dict):
            report.warn(f"{label}: per-side strokeWidth is not representable; "
                        f"using the top edge")
            sw = sw.get("top", 1)
        if sw is None:
            sw = 1
        parts.append(f"stroke-width: {num(parse_len(sw) * s / k)}px")
        if node.get("strokeLinecap"):
            parts.append(f"stroke-linecap: {node['strokeLinecap']}")
        if node.get("strokeLinejoin"):
            parts.append(f"stroke-linejoin: {node['strokeLinejoin']}")
    return "; ".join(parts)


def emit_node(node, s, variables, report, label, out, indent):
    """Emit one canvas node into SVG lines. s = svg units per canvas px."""
    t = node.get("type")
    if node.get("enabled") is False:
        return
    pad = "    " * indent
    x = float(node.get("x") or 0)
    y = float(node.get("y") or 0)
    name = node.get("name") or t

    if t in ("frame", "group"):
        kids = node.get("children") or []
        if not kids:
            return
        inner = []
        for k in kids:
            emit_node(k, s, variables, report, f"{label} > {name}", inner,
                      indent + 1)
        if not inner:
            return
        if abs(x) < EPS and abs(y) < EPS:
            out.extend(ln[4:] if ln.startswith("    ") else ln for ln in inner)
        else:
            out.append(f'{pad}<g transform="translate({num(x * s)},'
                       f'{num(y * s)})">')
            out.extend(inner)
            out.append(f"{pad}</g>")
        return

    fill, stroke = emit_paint(node, variables, report, f"{label} > {name}")

    if t == "ellipse":
        w = parse_len(node.get("width") or 0)
        h = parse_len(node.get("height") or 0)
        if node.get("innerRadius") or node.get("sweepAngle") is not None \
                or node.get("startAngle"):
            report.warn(f"{label} > {name}: ring/arc ellipses are not "
                        f"representable in SVG; emitted as a full ellipse")
        style = stroke_style(node, fill, stroke, s, 1.0, report,
                             f"{label} > {name}")
        cx, cy = (x + w / 2) * s, (y + h / 2) * s
        if abs(w - h) < 1e-3:
            out.append(f'{pad}<circle cx="{num(cx)}" cy="{num(cy)}" '
                       f'r="{num(w / 2 * s)}" style="{style}" />')
        else:
            out.append(f'{pad}<ellipse cx="{num(cx)}" cy="{num(cy)}" '
                       f'rx="{num(w / 2 * s)}" ry="{num(h / 2 * s)}" '
                       f'style="{style}" />')
        return

    if t == "rectangle":
        w = parse_len(node.get("width") or 0)
        h = parse_len(node.get("height") or 0)
        style = stroke_style(node, fill, stroke, s, 1.0, report,
                             f"{label} > {name}")
        r = node.get("cornerRadius")
        rr = ""
        if isinstance(r, (int, float)) and r:
            rr = f' rx="{num(parse_len(r) * s)}"'
        elif isinstance(r, list):
            report.warn(f"{label} > {name}: per-corner radius is not "
                        f"representable; using the first corner")
            rr = f' rx="{num(parse_len(r[0]) * s)}"'
        out.append(f'{pad}<rect x="{num(x * s)}" y="{num(y * s)}" '
                   f'width="{num(w * s)}" height="{num(h * s)}"{rr} '
                   f'style="{style}" />')
        return

    if t == "path":
        d = (node.get("geometry") or "").strip()
        if not d:
            return
        w = parse_len(node.get("width") or 0)
        h = parse_len(node.get("height") or 0)
        vb = node.get("viewBox")
        if not vb or len(vb) != 4 or not vb[2] or not vb[3]:
            report.warn(f"{label} > {name}: path has no usable viewBox; "
                        f"emitting geometry unscaled")
            vb = [0, 0, w, h]
        vx, vy, vw, vh = (float(v) for v in vb)
        kx, ky = w * s / vw, h * s / vh
        tx, ty = (x - vx * w / vw) * s, (y - vy * h / vh) * s
        if abs(kx - ky) > 1e-3:
            report.warn(f"{label} > {name}: non-uniform path scale "
                        f"({num(kx)} vs {num(ky)}); stroke width will be "
                        f"approximate")
        style = stroke_style(node, fill, stroke, s, kx, report,
                            f"{label} > {name}")
        if node.get("fillRule") == "evenodd":
            style += "; fill-rule: evenodd"
        identity = (abs(kx - 1) < 1e-6 and abs(ky - 1) < 1e-6
                    and abs(tx) < 1e-6 and abs(ty) < 1e-6)
        if identity:
            out.append(f'{pad}<path d="{d}" style="{style}" />')
        else:
            xf = []
            if abs(tx) > EPS or abs(ty) > EPS:
                xf.append(f"translate({num(tx)},{num(ty)})")
            if abs(kx - 1) > 1e-6 or abs(ky - 1) > 1e-6:
                xf.append(f"scale({num(kx)})" if abs(kx - ky) < 1e-9
                          else f"scale({num(kx)},{num(ky)})")
            out.append(f'{pad}<g transform="{" ".join(xf)}">')
            out.append(f'{pad}    <path d="{d}" style="{style}" />')
            out.append(f"{pad}</g>")
        return

    if t == "text":
        content = node.get("content")
        if not content:
            return
        w = parse_len(node.get("width") or 0)
        h = parse_len(node.get("height") or 0)
        ha = node.get("textAlign") or "left"
        va = node.get("textAlignVertical") or "top"
        anchor = {"left": "start", "center": "middle", "right": "end",
                  "justify": "start"}[ha]
        ax = {"start": x, "middle": x + w / 2, "end": x + w}[anchor]
        if va == "middle":
            ay, baseline = y + h / 2, "middle"
        elif va == "bottom":
            ay, baseline = y + h, "text-after-edge"
        else:
            ay, baseline = y, "text-before-edge"
        style = [f"fill: {fill or 'currentColor'}"]
        fam = node.get("fontFamily") or ""
        if isinstance(fam, str) and fam.startswith("$"):
            v = variables.get(fam[1:], {}).get("value")
            fam = v if isinstance(v, str) else "sans-serif"
        # fonts that only exist to render the sheet must not leak into an asset
        if not fam or fam in CANVAS_FONTS or fam.startswith("Noto Sans Symbols"):
            fam = "sans-serif"
        elif fam != "sans-serif":
            report.warn(f"{label} > {name}: font '{fam}' will be written to "
                        f"the asset; it must be available wherever the SVG "
                        f"renders, or the glyph falls back to a default face")
        style.append(f"font-family: {fam}")
        if node.get("fontWeight"):
            style.append(f"font-weight: {node['fontWeight']}")
        style.append(f"font-size: {num(parse_len(node.get('fontSize') or 11) * s)}px")
        esc = (str(content).replace("&", "&amp;").replace("<", "&lt;")
               .replace(">", "&gt;"))
        out.append(f'{pad}<text x="{num(ax * s)}" y="{num(ay * s)}" '
                   f'text-anchor="{anchor}" dominant-baseline="{baseline}" '
                   f'style="{"; ".join(style)}">{esc}</text>')
        return

    report.warn(f"{label} > {name}: node type '{t}' cannot be written to SVG; "
                f"skipped")


def canvas_to_svg(box: dict, vb: float, variables: dict, report: Report,
                  label: str) -> str:
    s = vb / BOX
    body: list[str] = []
    for kid in box.get("children") or []:
        emit_node(kid, s, variables, report, label, body, 1)
    vbi = num(vb)
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vbi} {vbi}" '
        f'width="100" height="100" fill="none">',
        *body,
        "</svg>",
        "",
    ]
    return "\n".join(lines)


# ------------------------------------------------------------- SVG -> canvas

def parse_svg(path: str, report: Report) -> tuple[list[dict], float]:
    """Parse an SVG into flat canvas-space elements plus its viewBox size."""
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    m = re.search(r'viewBox="([^"]+)"', src)
    if not m:
        report.warn(f"{path}: no viewBox; assuming 24")
        vb = 24.0
    else:
        vb = float(m.group(1).split()[2])
    k = BOX / vb

    def style_of(attrs):
        d = {}
        sm = re.search(r'style="([^"]*)"', attrs)
        if sm:
            for part in sm.group(1).split(";"):
                if ":" in part:
                    a, b = part.split(":", 1)
                    d[a.strip()] = b.strip()
        for prop in ("fill", "stroke", "stroke-width", "fill-rule",
                     "stroke-linecap", "stroke-linejoin", "font-size",
                     "font-family", "font-weight"):
            am = re.search(rf'\b{prop}="([^"]*)"', attrs)
            if am and prop not in d:
                d[prop] = am.group(1)
        return d

    def paint(st, key):
        v = st.get(key)
        if v is None or v in ("none", "transparent"):
            return None
        return "$ink" if ("currentColor" in v or v.lower() == MODERN_INK) else v

    def attr(attrs, key, default=None):
        m2 = re.search(rf'\b{key}="([^"]*)"', attrs)
        return m2.group(1) if m2 else default

    els: list[dict] = []
    tx = ty = 0.0
    sc = 1.0
    stack: list[tuple[float, float, float]] = []
    pattern = r'<(g|/g|circle|ellipse|rect|path|text)\b([^>]*?)(/?)>([^<]*)'
    for m2 in re.finditer(pattern, src):
        tag, attrs, _selfclose, inner = m2.groups()
        if tag == "g":
            stack.append((tx, ty, sc))
            for t2 in re.finditer(r'(translate|scale)\(([^)]+)\)', attrs):
                vals = [float(v) for v in
                        re.split(r'[,\s]+', t2.group(2).strip()) if v]
                if t2.group(1) == "translate":
                    tx, ty = tx + sc * vals[0], ty + sc * (vals[1] if len(vals) > 1 else 0)
                else:
                    sc *= vals[0]
            continue
        if tag == "/g":
            if stack:
                tx, ty, sc = stack.pop()
            continue

        st = style_of(attrs)
        fill, stroke = paint(st, "fill"), paint(st, "stroke")
        node: dict = {"layoutPosition": "absolute"}
        if fill:
            node["fill"] = fill
        if stroke:
            node["stroke"] = stroke
            sw = parse_len(st.get("stroke-width", 1)) * sc * k
            node["stroke"] = stroke
            node["strokeWidth"] = round(sw, 3)
            for a, b in (("stroke-linecap", "strokeLinecap"),
                         ("stroke-linejoin", "strokeLinejoin")):
                if st.get(a):
                    node[b] = st[a]

        if tag in ("circle", "ellipse"):
            cx = float(attr(attrs, "cx", 0)); cy = float(attr(attrs, "cy", 0))
            if tag == "circle":
                rx = ry = float(attr(attrs, "r", 0))
            else:
                rx = float(attr(attrs, "rx", 0)); ry = float(attr(attrs, "ry", 0))
            node.update(type="ellipse", name="Circle",
                        x=round((tx + sc * (cx - rx)) * k, 3),
                        y=round((ty + sc * (cy - ry)) * k, 3),
                        width=round(2 * rx * sc * k, 3),
                        height=round(2 * ry * sc * k, 3))
        elif tag == "rect":
            rx0 = float(attr(attrs, "x", 0)); ry0 = float(attr(attrs, "y", 0))
            node.update(type="rectangle", name="Rect",
                        x=round((tx + sc * rx0) * k, 3),
                        y=round((ty + sc * ry0) * k, 3),
                        width=round(float(attr(attrs, "width", 0)) * sc * k, 3),
                        height=round(float(attr(attrs, "height", 0)) * sc * k, 3))
            if attr(attrs, "rx"):
                node["cornerRadius"] = round(float(attr(attrs, "rx")) * sc * k, 3)
        elif tag == "path":
            d = attr(attrs, "d")
            if not d:
                continue
            node.update(type="path", name="Path", x=0, y=0,
                        width=BOX, height=BOX,
                        geometry=" ".join(d.split()),
                        viewBox=[round(-tx / sc, 4), round(-ty / sc, 4),
                                 round(vb / sc, 4), round(vb / sc, 4)])
            if st.get("fill-rule") == "evenodd":
                node["fillRule"] = "evenodd"
        elif tag == "text":
            txt = inner.strip()
            if not txt:
                continue
            cx = float(attr(attrs, "x", 0)); cy = float(attr(attrs, "y", 0))
            fs = parse_len(st.get("font-size", 11))
            # keep the anchor exact but shrink the box so it cannot overhang
            # the 56px glyph frame (an overhang shows up as a clipping warning)
            ay = (ty + sc * cy) * k
            th = min(BOX, 2 * min(ay, BOX - ay)) if 0 < ay < BOX else BOX
            node.update(type="text", name="Symbol", content=txt,
                        x=round((tx + sc * cx) * k - BOX / 2, 3),
                        y=round(ay - th / 2, 3),
                        width=BOX, height=round(th, 3),
                        textGrowth="fixed-width-height",
                        textAlign="center", textAlignVertical="middle",
                        fontFamily="$font-ui",
                        fontSize=round(fs * sc * k, 3),
                        fontWeight=st.get("font-weight", "600"))
            if not node.get("fill"):
                node["fill"] = "$ink"
        els.append(node)
    return els, vb


# ------------------------------------------------------------------ commands

def glyph_files(glyphs_dir: str, setid: str = "default") -> dict[tuple[str, str], str]:
    out = {}
    for cat in CATEGORIES:
        d = os.path.join(glyphs_dir, setid, cat)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".svg"):
                out[(cat, fn[:-4])] = os.path.join(d, fn)
    return out


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def load_baseline(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return {"hashes": {}}


def save_baseline(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, sort_keys=True)
        fh.write("\n")


def build_emissions(args, report):
    doc = load_pen(args.pen)
    variables = doc.get("variables") or {}
    cells = find_glyph_cells(doc, report)
    if not cells:
        die("no glyph cells found on the canvas (expected section frames named "
            "Aspects/Planets/Zodiac containing cells with a 'Glyph' frame)")
    files = glyph_files(args.glyphs)
    emissions = {}
    for key, box in sorted(cells.items()):
        cat, stem = key
        target = files.get(key)
        if target is None:
            report.warn(f"canvas cell {cat}/{stem} has no matching "
                        f"default/{cat}/{stem}.svg; skipped (rename the cell "
                        f"to match a file, or create the file first)")
            continue
        _, vb = parse_svg(target, Report())
        emissions[key] = (target, canvas_to_svg(box, vb, variables, report,
                                                f"{cat}/{stem}"))
    for key in sorted(set(files) - set(cells)):
        report.warn(f"{key[0]}/{key[1]}.svg has no cell on the canvas; "
                    f"left untouched")
    return emissions


def cmd_push(args):
    report = Report()
    emissions = build_emissions(args, report)
    baseline = load_baseline(args.baseline)
    hashes = baseline.get("hashes", {})

    only = set(args.only or [])
    changed, skipped = [], 0
    for key, (target, svg) in emissions.items():
        kid = f"{key[0]}/{key[1]}"
        if only and key[1] not in only and kid not in only:
            continue
        h = sha(svg)
        if not args.force and hashes.get(kid) == h:
            skipped += 1
            continue
        changed.append((kid, target, svg, h))

    verb = "would write" if args.dry_run else "wrote"
    for kid, target, svg, h in changed:
        if not args.dry_run:
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(svg)
            hashes[kid] = h
        extra = ""
        if not args.no_modern:
            mt = target.replace(os.sep + "default" + os.sep,
                                os.sep + "modern" + os.sep)
            if not args.dry_run:
                os.makedirs(os.path.dirname(mt), exist_ok=True)
                with open(mt, "w", encoding="utf-8") as fh:
                    fh.write(svg.replace("currentColor", MODERN_INK))
            extra = " (+modern)"
        print(f"{verb}: {kid}{extra}")

    if not args.dry_run:
        baseline["hashes"] = hashes
        save_baseline(args.baseline, baseline)
    report.flush()
    print(f"\n{len(changed)} glyph(s) {verb}, {skipped} unchanged, "
          f"{len(emissions)} on canvas.")
    if args.dry_run:
        print("dry run - nothing written.")


def cmd_status(args):
    args.dry_run = True
    args.force = False
    cmd_push(args)


def cmd_baseline(args):
    report = Report()
    emissions = build_emissions(args, report)
    baseline = load_baseline(args.baseline)
    baseline["hashes"] = {f"{c}/{s}": sha(svg)
                          for (c, s), (_t, svg) in emissions.items()}
    save_baseline(args.baseline, baseline)
    report.flush()
    print(f"baseline adopted for {len(emissions)} glyph(s) -> {args.baseline}")
    print("push will now only write glyphs edited after this point.")


def cmd_pull(args):
    report = Report()
    files = glyph_files(args.glyphs)
    if not files:
        die(f"no glyphs found under {args.glyphs}/default")

    nid = [0]

    def gid():
        nid[0] += 1
        return f"g{nid[0]}"

    def text(content, **kw):
        n = {"type": "text", "id": gid(), "content": content,
             "fontFamily": "$font-ui", "fill": "$ink",
             "name": kw.pop("name", content)}
        n.update(kw)
        return n

    def cell(cat, stem):
        els, _vb = parse_svg(files[(cat, stem)], report)
        for e in els:
            e["id"] = gid()
        return {
            "type": "frame", "id": gid(), "name": stem, "layout": "vertical",
            "width": CELL, "alignItems": "center", "gap": 8,
            "children": [
                {"type": "frame", "id": gid(), "name": "Glyph",
                 "layout": "none", "width": BOX, "height": BOX,
                 "children": els},
                text(stem.replace("_", " "), name="Name", fontSize=10,
                     lineHeight=1.3, fill="$muted", textGrowth="fixed-width",
                     width="fill_container", textAlign="center",
                     letterSpacing=0.2),
            ],
        }

    def section(cat):
        stems = [s for (c, s) in sorted(files) if c == cat]
        rows = []
        for i in range(0, len(stems), COLS):
            rows.append({"type": "frame", "id": gid(),
                         "name": f"Row {i // COLS + 1}", "layout": "horizontal",
                         "gap": 12, "alignItems": "start",
                         "children": [cell(cat, s) for s in stems[i:i + COLS]]})
        head = {"type": "frame", "id": gid(), "name": "Heading",
                "layout": "horizontal", "width": "fill_container",
                "alignItems": "center", "gap": 12, "children": [
                    text(CATEGORIES[cat], name="Title", fontSize=20,
                         fontWeight="600", letterSpacing=-0.2),
                    text(str(len(stems)), name="Count", fontSize=13,
                         fill="$faint"),
                    {"type": "rectangle", "id": gid(), "name": "Rule",
                     "width": "fill_container", "height": 1, "fill": "$rule"},
                ]}
        return {"type": "frame", "id": gid(), "name": CATEGORIES[cat],
                "layout": "vertical", "width": "fill_container", "gap": 24,
                "children": [head, {"type": "frame", "id": gid(),
                                    "name": "Grid", "layout": "vertical",
                                    "gap": 24, "children": rows}]}

    width = COLS * CELL + (COLS - 1) * 12 + 2 * 56
    sheet = {
        "type": "frame", "id": "bi8Au", "name": "Glyph Set — default",
        "x": 0, "y": 0, "width": width, "height": "fit_content",
        "layout": "vertical", "gap": 48, "padding": 56, "fill": "#FFFFFF",
        "clip": True, "children": [
            {"type": "frame", "id": gid(), "name": "Header",
             "layout": "vertical", "gap": 6, "width": "fill_container",
             "children": [
                 text("Astrology Glyphs", name="Title", fontSize=34,
                      fontWeight="700", letterSpacing=-0.8),
                 text("tauri-application/static/glyphs/default", name="Source",
                      fontSize=13, fill="$faint", letterSpacing=0.2),
             ]},
            *[section(c) for c in CATEGORIES],
        ],
    }

    doc = load_pen(args.pen) if os.path.exists(args.pen) else {"version": "2.17"}
    doc["variables"] = {
        "ink": {"type": "color", "value": INK},
        "muted": {"type": "color", "value": "#6B6B6B"},
        "faint": {"type": "color", "value": "#9A9A9A"},
        "rule": {"type": "color", "value": "#E4E4E4"},
        "font-ui": {"type": "string", "value": "Inter"},
    }
    doc["children"] = [sheet]
    with open(args.pen, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    report.flush()
    print(f"pulled {len(files)} glyph(s) into {args.pen}")
    print("the editor ignores external writes - reopen Glyphs.pen to see it.")
    args2 = argparse.Namespace(**vars(args))
    cmd_baseline(args2)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pen", default=DEFAULT_PEN)
    ap.add_argument("--glyphs", default=DEFAULT_GLYPHS)
    ap.add_argument("--baseline", default=DEFAULT_BASELINE)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("push", help="canvas -> svg files")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--force", action="store_true",
                   help="rewrite even unchanged glyphs")
    p.add_argument("--only", nargs="+", metavar="GLYPH",
                   help="limit to these stems (e.g. trine planets/lilith)")
    p.add_argument("--no-modern", action="store_true",
                   help="do not derive the modern/ set")
    p.set_defaults(func=cmd_push)

    p = sub.add_parser("status", help="show what push would write")
    p.add_argument("--only", nargs="+", metavar="GLYPH")
    p.add_argument("--no-modern", action="store_true", default=True)
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("baseline", help="adopt the canvas as unchanged")
    p.set_defaults(func=cmd_baseline)

    p = sub.add_parser("pull", help="svg files -> canvas")
    p.set_defaults(func=cmd_pull)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
