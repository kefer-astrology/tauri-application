#!/usr/bin/env python3
"""Coverage map: what the app can ask for vs. what art actually exists.

Reads the three registries the UI derives from - OBSERVABLE_OBJECTS, ASPECT_ROWS
and the zodiac id list - and cross-references them against the files in
static/glyphs/ and the cells on the Glyphs.pen canvas.

    python3 tauri-application/scripts/glyph-coverage.py            # write the CSV
    python3 tauri-application/scripts/glyph-coverage.py --summary  # print totals only

Output columns:
    category    aspects | planets | zodiac          (the static/glyphs/ subfolder)
    id          the id the app looks up
    group       registry category, e.g. asteroids   (planets only)
    status      available | planned                 (backend computation path)
    asset       the file actually resolved for this id
    default     yes/no  - static/glyphs/default/<category>/<asset>.svg exists
    modern      yes/no  - static/glyphs/modern/<category>/<asset>.svg exists
    canvas      yes            - this id has its own cell in Glyphs.pen
                shares:<asset> - no cell of its own; renders <asset>'s art
                no             - resolves to a file with no cell yet
    note        why asset differs from id, or what is missing

No dependencies - stdlib Python 3 only.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCES = os.path.join(SPACE, "graphical-sources")

ASTRO = os.path.join(SPACE, "tauri-application", "apps", "web-react",
                     "src", "lib", "astrology")
DEFAULT_PEN = os.path.join(SOURCES, "Glyphs.pen")
DEFAULT_GLYPHS = os.path.join(SPACE, "tauri-application", "static", "glyphs")
DEFAULT_OUT = os.path.join(SOURCES, "glyph-coverage.csv")

SECTION_TO_CATEGORY = {"Aspects": "aspects", "Planets": "planets",
                       "Zodiac": "zodiac"}


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def parse_observable_objects() -> list[dict]:
    """Literal entries plus the fixedStar() helper calls, in source order."""
    src = read(os.path.join(ASTRO, "observableObjects.ts"))
    arr = src[src.index("export const OBSERVABLE_OBJECTS"):]

    out = []
    for m in re.finditer(r"\{\s*id:\s*'([^']+)'(.*?)\n\t\}", arr, re.S):
        body = m.group(2)
        cat = re.search(r"category:\s*'([^']+)'", body)
        status = re.search(r"status:\s*'([^']+)'", body)
        out.append({
            "id": m.group(1),
            "group": cat.group(1) if cat else "",
            "status": status.group(1) if status else "",
        })

    # fixedStar('Name') -> id star_<slug>; mirrors the slug rule in the TS helper.
    for name in re.findall(r"fixedStar\('([^']+)'", arr):
        slug = re.sub(r"^_+|_+$", "",
                      re.sub(r"[^a-z0-9]+", "_", name.lower()))
        out.append({"id": f"star_{slug}", "group": "fixed_stars",
                    "status": "planned"})
    return out


def parse_aspect_rows() -> list[str]:
    src = read(os.path.join(ASTRO, "aspects.ts"))
    rows = src[src.index("ASPECT_ROWS"):]
    # Stop before the interface/type block that follows the array.
    rows = rows.split("export interface")[0].split("export type")[0]
    seen, out = set(), []
    for i in re.findall(r"id:\s*'([^']+)'", rows):
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def parse_zodiac_ids() -> list[str]:
    src = read(os.path.join(ASTRO, "glyphs.ts"))
    block = src[src.index("export const ZODIAC_IDS"):]
    block = block[:block.index("]")]
    return re.findall(r"'([^']+)'", block)


def parse_alias_map() -> dict[str, str]:
    src = read(os.path.join(ASTRO, "glyphs.ts"))
    block = src[src.index("const glyphAliasMap"):]
    block = block[:block.index("};")]
    return dict(re.findall(r"(\w+):\s*'([^']+)'", block))


def canvas_cells(pen_path: str) -> dict[str, set[str]]:
    """Cell names per category, read straight off the canvas sheet."""
    cells = {c: set() for c in SECTION_TO_CATEGORY.values()}
    if not os.path.exists(pen_path):
        return cells
    doc = json.load(open(pen_path, encoding="utf-8"))
    for root in doc.get("children", []):
        for section in root.get("children", []):
            cat = SECTION_TO_CATEGORY.get(section.get("name"))
            if not cat:
                continue
            for grid in section.get("children", []):
                if grid.get("name") != "Grid":
                    continue
                for row in grid.get("children", []):
                    for cell in row.get("children", []):
                        if cell.get("name"):
                            cells[cat].add(cell["name"])
    return cells


def build_rows(glyphs_dir: str, pen_path: str) -> list[dict]:
    def files(variant: str, cat: str) -> set[str]:
        d = os.path.join(glyphs_dir, variant, cat)
        if not os.path.isdir(d):
            return set()
        return {f[:-4] for f in os.listdir(d) if f.endswith(".svg")}

    have = {(v, c): files(v, c)
            for v in ("default", "modern")
            for c in SECTION_TO_CATEGORY.values()}
    cells = canvas_cells(pen_path)
    alias = parse_alias_map()

    rows = []

    def add(cat, ident, group, status, asset, note):
        # `canvas` answers "does THIS id have a cell of its own", not "does
        # whatever it resolves to have one" - otherwise 65 fixed stars all
        # report yes off the single shared placeholder and the column reads
        # as full coverage when 68 ids have no art of their own.
        if ident and asset != ident:
            canvas = f"shares:{asset}"
        elif asset in cells[cat]:
            canvas = "yes"
        else:
            canvas = "no"
        rows.append({
            "category": cat,
            "id": ident,
            "group": group,
            "status": status,
            "asset": asset,
            "default": "yes" if asset in have[("default", cat)] else "no",
            "modern": "yes" if asset in have[("modern", cat)] else "no",
            "canvas": canvas,
            "note": note,
        })

    for a in parse_aspect_rows():
        add("aspects", a, "", "", a, "")

    for z in parse_zodiac_ids():
        add("zodiac", z, "", "", z, "")

    for obj in parse_observable_objects():
        ident, note = obj["id"], ""
        if ident.startswith("star_"):
            asset, note = "fixed_star_generic", "shared placeholder; no per-star art"
        elif ident in alias:
            asset = alias[ident]
            note = f"aliased to '{asset}' in glyphs.ts"
        else:
            asset = ident
        add("planets", ident, obj["group"], obj["status"], asset, note)

    # Art on disk that no registry id resolves to.
    claimed = {(r["category"], r["asset"]) for r in rows}
    for cat in SECTION_TO_CATEGORY.values():
        for orphan in sorted(have[("default", cat)]):
            if (cat, orphan) not in claimed:
                rows.append({
                    "category": cat, "id": "", "group": "", "status": "",
                    "asset": orphan,
                    "default": "yes",
                    "modern": "yes" if orphan in have[("modern", cat)] else "no",
                    "canvas": "yes" if orphan in cells[cat] else "no",  # noqa
                    "note": "orphan: file exists but no registry id resolves to it",
                })
    return rows


FIELDS = ["category", "id", "group", "status", "asset",
          "default", "modern", "canvas", "note"]


def summarize(rows: list[dict]) -> None:
    from collections import Counter
    total = Counter()
    covered = Counter()
    for r in rows:
        if not r["id"]:
            continue
        key = r["group"] or r["category"]
        total[key] += 1
        if r["default"] == "yes":
            covered[key] += 1
    # An id resolving to art is not the same as an id having its OWN art:
    # 65 fixed stars share one placeholder and several points alias onto
    # another glyph. Count those separately so the totals don't flatter.
    shared = Counter()
    for r in rows:
        if r["id"] and r["asset"] != r["id"]:
            shared[r["group"] or r["category"]] += 1

    width = max(len(k) for k in total)
    print(f"  {'':<{width}}  resolved   dedicated")
    for k in sorted(total):
        gap = total[k] - covered[k]
        own = covered[k] - shared[k]
        flag = "" if not gap else f"   <- {gap} missing"
        extra = "" if not shared[k] else f"   ({shared[k]} shared/aliased)"
        print(f"  {k:<{width}}  {covered[k]:3}/{total[k]:3}     {own:3}{extra}{flag}")
    print(f"  {'TOTAL':<{width}}  {sum(covered.values()):3}/{sum(total.values()):3}"
          f"     {sum(covered.values()) - sum(shared.values()):3}"
          f"   ({sum(shared.values())} shared/aliased)")

    orphans = [r for r in rows if not r["id"]]
    if orphans:
        print("\n  orphan files (no registry id resolves to them):")
        for r in orphans:
            print(f"    {r['category']}/{r['asset']}.svg")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pen", default=DEFAULT_PEN)
    ap.add_argument("--glyphs", default=DEFAULT_GLYPHS)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--summary", action="store_true",
                    help="print totals instead of writing the CSV")
    args = ap.parse_args(argv)

    rows = build_rows(args.glyphs, args.pen)

    if args.summary:
        summarize(rows)
        return 0

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {args.out}")
    summarize(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
