# Glyph sync

Refine the astrology glyphs visually on the pen.dev canvas, then write the
refinements back into `static/glyphs/`.

- **Canvas:** `Glyphs.pen` (repo root's parent — the "Space" folder)
- **Assets:** `tauri-application/static/glyphs/{default,modern}/{aspects,planets,zodiac}/*.svg`
- **Tool:** `python3 tauri-application/scripts/glyph-sync.py <command>`

No dependencies — stdlib Python 3 only.

## The loop

```
                 pull
   SVG files  ─────────────>  Glyphs.pen  ──> designer refines on canvas
       ^                                              │
       └──────────────────────────────────────────────┘
                          push
```

```bash
python3 tauri-application/scripts/glyph-sync.py status   # what would change
python3 tauri-application/scripts/glyph-sync.py push     # canvas -> svg
python3 tauri-application/scripts/glyph-sync.py pull     # svg -> canvas
```

**Always run `status` before `push`.** It prints the exact list of glyphs that
would be written and any warnings, and touches nothing.

### Two rules about the editor

The pen.dev editor keeps its own in-memory copy of `Glyphs.pen` and neither
reads nor honours external writes. So:

1. **Before `push`:** save in the editor (`Ctrl+S`). Unsaved canvas edits are
   invisible to the tool.
2. **After `pull`:** reopen `Glyphs.pen` in the editor. It will not pick the
   new file up on its own.

Forgetting rule 1 is safe — `push` simply reports "0 changed" rather than
writing anything wrong. Forgetting rule 2 just means you keep looking at the
old canvas.

## What push writes

Only glyphs that actually changed. A hash of each glyph's emitted SVG is kept
in `.glyphs-sync.json`; a glyph whose hash still matches is skipped, so the 90-odd
files nobody touched are never reformatted and your diffs stay readable.

`modern/` is **derived**, not edited: every file written to `default/` is also
written to `modern/` with `currentColor` replaced by `#e5e7eb`. The two sets
cannot drift. Pass `--no-modern` to suppress this.

```bash
push --only trine planets/lilith   # limit to specific glyphs
push --force                       # rewrite even unchanged glyphs
push --dry-run                     # same as status
baseline                           # accept the canvas as-is, without writing
```

Use `baseline` after deliberately discarding canvas work, to stop `push`
re-reporting it.

## How a glyph is identified

Structurally, from frame names — there is no hidden id to preserve
(`metadata` does not survive an `Update` in this editor build):

```
Glyph Set — default        root frame
└─ Planets                 section  -> category
   └─ Grid / Row 4
      └─ lilith            cell     -> planets/lilith.svg
         ├─ Glyph          56×56    -> everything in here becomes the file body
         └─ Name           caption, ignored by sync
```

Rename a cell and it stops matching a file: sync reports it and writes
nothing rather than guessing. Move cells between rows freely — only the
section and cell names matter. To add a glyph, create the `.svg` first, then
`pull`.

## Coordinate mapping

The 56 px `Glyph` frame maps onto the file's own `viewBox` (24, or 32 for
zodiac), read from the file being overwritten. Everything scales by
`viewBox / 56`.

Paths are never re-mathed: the raw `d` is preserved and wrapped in a
`translate()/scale()` derived from the node's box and viewBox. A designer can
do anything to path geometry and it round-trips exactly. Round-tripping the
original assets reproduces them essentially byte-for-byte, including their
original `translate(1,3) scale(.9)` group transforms.

Anything resolving to the ink colour (`$ink` / `#161616`) is written as
`currentColor`, preserving the theming contract. Any other colour is written
literally — which means it will **not** follow the theme, so avoid hardcoded
colours inside a glyph.

## Caveats

Sync covers `frame`/`group`, `ellipse`, `rectangle`, `path` and `text`. It
warns and skips anything else, and warns on constructs SVG cannot express
(ring/arc ellipses, per-side stroke widths, per-corner radii, non-uniform path
scale). Warnings are worth reading — they mean the file does not fully match
the canvas.

Fonts used only for on-canvas rendering (`Inter`, `Noto Sans Symbols*`) are
written as `sans-serif`. Any other font is written through with a warning: the
assets are consumed as `<image href>` in `horoscope-wheel.tsx`, so a font that
is not installed where the SVG renders will silently fall back.

`<text>`-based glyphs depend on the renderer having the character. 65 glyphs
still use text, all with ASCII abbreviations or `□ △ ★`. The 12 glyphs that
used U+260A–26BB were converted to paths, because no font available to the
canvas renders that range.

## Where the symbols come from

37 glyphs that previously showed letter abbreviations now use forms taken from
`Graficke_podklady/Hermetica/` — the project's own 782-symbol reference set
(uniform 268x268, one `#000000` path per glyph; the `#ffffff` path is a
background plate and is discarded).

They are fitted, not redrawn: the reference `d` is preserved verbatim and
wrapped in a `translate()/scale()` derived from its flattened tight bounding
box, centred on the badge and scaled to a max radial reach of 7.8 (the badge
inner edge is 9.25). Stroke-based glyphs target ~8.9; filled ones sit smaller
because solid shapes read heavier at 56px.

Check the fit of anything you add with:

```bash
python3 tauri-application/scripts/glyph-audit.py
```

It flattens every path (cubics sampled, arcs converted to centre
parameterisation) **and composes enclosing `<g transform>`s**, then reports any
glyph whose ink crosses its badge ring. Both of those matter: skipping arcs or
ignoring group transforms produces confidently wrong numbers.

### Glyphs still using letters (28)

Deliberate, not missed:

- **Harmonic aspects** (`binovile`, `biquintile`, `novile`, `quadrinovile`,
  `quintile`, `septile`, `tridecile`) — no cross-software consensus glyph
  exists; letters *are* the common notation.
- **Chart angles** (`asc`, `desc`, `mc`, `ic`, `vertex`, `antivertex`) —
  `AS`/`DS`/`MC`/`IC` is the established convention, not a fallback.
- **Planetary nodes** (`geo_node_*`, 8) — no standard mark; conventionally the
  planet glyph plus a node marker.
- **No Hermetica entry**: `irene`, `massalia`, `victoria`, `part_of_spirit`.
- **Already symbols**: `square` (□), `trine` (△), `fixed_star_generic` (★) —
  these three render in available fonts, unlike U+260A-26BB.
