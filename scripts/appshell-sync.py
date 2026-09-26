#!/usr/bin/env python3
"""Two-way sync between AppShellIcons.pen and static/app-shell/icons/default.

Same engine as glyph-sync.py - this module only re-points it at the app-shell
canvas and folder, so behaviour, warnings and the push hash-skip all match.

    python3 tauri-application/scripts/appshell-sync.py status
    python3 tauri-application/scripts/appshell-sync.py push
    python3 tauri-application/scripts/appshell-sync.py pull

Only the `default` family is synced. `icons/modern/` is Lucide, a third-party
icon set rather than project artwork, so it is left alone; `push` never derives
it the way the astrology glyphs derive their modern variant. The modern *brand*
marks are project artwork (the `logos/` re-trace), but they ride on the same
read-only sheet, so edit them on disk and `pull` rather than pushing.

Run appshell-normalize.py on any newly added potrace icon before `pull`, or the
flip in its wrapper transform will place the artwork outside the viewBox.

No dependencies - stdlib Python 3 only.
"""

from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCES = os.path.join(SPACE, "graphical-sources")


def load_engine():
    """Import glyph-sync.py; the hyphen keeps it off the normal import path."""
    path = os.path.join(HERE, "glyph-sync.py")
    spec = importlib.util.spec_from_file_location("glyph_sync", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


g = load_engine()

# Brand marks sit beside `icons/`, not inside it, and their filenames are
# load-bearing (app-shell-icons.svelte.ts builds `logo-full-${set}.svg`), so
# they are addressed where they are rather than moved into a tidier folder.
BRAND = ["logo-mark-default", "logo-full-default", "icon"]

# The modern family has no `icon` of its own - the launcher icon is cut from
# the default wordmark - so its brand row is the two logos only.
BRAND_MODERN = ["logo-mark-modern", "logo-full-modern"]

# Sidebar order, top to bottom, as the app presents it - not alphabetical.
# `settings` and `favorite` close the list, apart from the document and chart
# actions above them. `favorite` has no visible control in the app yet; it is
# carried here deliberately so the asset stays tracked and designed alongside
# the rest rather than drifting.
MENU = ["menu", "new", "open", "save", "export", "horoscope", "aspects",
        "information", "transits", "dynamics", "revolution", "synastry",
        "settings", "favorite"]

# Chronological, matching how the themes read as a day.
THEME = ["theme-sunrise", "theme-noon", "theme-twilight", "theme-midnight"]

# `key` namespaces the cells, so Menu and Theme can share one folder while
# staying separate sections on the sheet.
def plan(setid, brand):
    return [
        {"key": "brand", "title": "Logo & icon", "dir": "", "stems": brand},
        {"key": "menu", "title": "Menu", "dir": f"icons/{setid}",
         "stems": MENU},
        {"key": "theme", "title": "Theme", "dir": f"icons/{setid}",
         "stems": THEME},
    ]


g.SECTION_PLAN = plan("default", BRAND)
g.CATEGORIES = {s["key"]: s["title"] for s in g.SECTION_PLAN}
g.SECTION_TO_CATEGORY = {s["title"]: s["key"] for s in g.SECTION_PLAN}
g.SET_DIR = ""

g.SHEET_ID = "as1Ic"
g.SHEET_NAME = "App Shell — default"
g.SHEET_TITLE = "App Shell"
g.SHEET_SOURCE = "tauri-application/static/app-shell"

# Two screens, one per family, named after the folder each one syncs with.
# The folder id is the load-bearing name - it is the filename suffix the app
# builds at runtime (`icons/${set}/`, `logo-full-${set}.svg`) - so the sheets
# take their names from it rather than from the design language, which reads
# the other way round: `default` is the hand-traced Kefer set whose aspectarium
# is a triangle, `modern` carries stock Lucide icons whose aspectarium is a
# square. Only the *icons* differ by family - since 2026-09-26 both brand rows
# are the Kefer script K, `modern` taking it from the smoother `logos/`
# re-trace. Each header says all of this, so the sheets cannot be confused.
g.SHEETS = [
    {
        "id": "as1Ic",
        "name": "App Shell — default",
        "title": "App Shell — default",
        "source": "static/app-shell + icons/default/   ·   Kefer traced, "
                  "triangle aspectarium   ·   push writes here",
        "plan": g.SECTION_PLAN,
        "writable": True,
    },
    {
        "id": "as2Mo",
        "name": "App Shell — modern",
        "title": "App Shell — modern",
        "source": "static/app-shell + icons/modern/   ·   brand: Kefer "
                  "re-trace from logos/   ·   icons: Lucide upstream, "
                  "square aspectarium   ·   read-only, push never writes it",
        "plan": plan("modern", BRAND_MODERN),
        "writable": False,
    },
]

# Wide enough that each section is a single row, read left to right.
g.COLS = len(MENU)

g.DEFAULT_PEN = os.path.join(SOURCES, "AppShellIcons.pen")
g.DEFAULT_GLYPHS = os.path.join(SPACE, "tauri-application", "static",
                                "app-shell")
g.DEFAULT_BASELINE = os.path.join(SOURCES, ".appshell-sync.json")


def main() -> int:
    argv = sys.argv[1:]
    # The modern set is upstream Lucide - never write it.
    if argv and argv[0] == "push" and "--no-modern" not in argv:
        argv.append("--no-modern")
    sys.argv = [sys.argv[0]] + argv
    return g.main()


if __name__ == "__main__":
    sys.exit(main())
