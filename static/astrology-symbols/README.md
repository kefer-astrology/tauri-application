# Degree symbol sets

Shared data, consumed by both `apps/web-react` and `apps/web-svelte` via Vite's
shared `publicDir` (`static/` at the repo root). See `catalog.json` for the
list of sets, their availability, and attribution/license notes. Each
available set's English data file (`<id>.json`) is a plain JSON array of 360
strings, index 0 = Aries 1° through index 359 = Pisces 30°.

Each set also has one `<id>.<lang>.json` per supported UI language (`cs`,
`fr`, `es` — English lives in `<id>.json`), same 360-entry convention,
consumed by `apps/web-react/src/lib/astrology/degreeSymbolSets.ts`. A
language missing a translated file falls back to the English text.

## Provenance

- **Sepharial** (`sepharial.json`): Sepharial's (Walter Gorn Old, 1864–1929)
  1898 English translation of the anonymous Italian "La Volasfera", published
  alongside Charubel's book. Public domain (translator died 1929; expired
  under UK/EU life+70 in 2000, and the 1898 US publication is unambiguously
  PD there too). Transcribed from a compiled public-domain anthology on
  archive.org (item `new-360-symbolic-degrees`).
- **Charubel** (`charubel.json`): Charubel (John Thomas, 1826–1908), "The
  Degrees of the Zodiac Symbolised" (1898, reprinted 1907 and again
  undated/3rd ed.). Public domain (author died 1908; expired everywhere
  relevant by 1978/1979). Confirmed via the book's own preface to be his
  complete, sole-authored 360-degree set — a second symbol set (Sepharial's
  Volasfera translation, above) and an unrelated 1898-only essay by H.S.
  Green are bound in the same physical volume but are not part of this set
  and were excluded. Transcribed page-by-page from a full scan
  (`iapsop.com/ssoc/1902__charubel___degrees_of_the_zodiac_symbolised.pdf`),
  reading rendered page images directly rather than relying on the scan's
  own OCR layer.
- **Sabian**: not bundled. No version of the widely-known Sabian symbols
  (Marc Edmund Jones's original, Dane Rudhyar's rephrasing, or any other
  popular retelling) could be confirmed as public domain or otherwise
  licensed for redistribution — see `catalog.json`'s `licenseNote` for that
  entry. `apps/web-react/src/lib/astrology/sabianSymbols.ts` still exists in
  the repo (sourced from a third-party program's shipped data files, which
  is itself a separate licensing problem) but is intentionally not wired
  into the enabled-by-default set list.
- **Kefer**: reserved slot for the app's own original degree symbols; no
  content yet.

The `cs`/`fr`/`es` files for Sepharial and Charubel are machine-translated
from the English text above (not independently sourced), preserving each
entry's index and imagery. Treat them as a good-faith rendering rather than a
scholarly translation; corrections are welcome.

Adding a set later: drop a new `<id>.json` (360-entry array, same index
convention) in this folder, add a catalog entry, and add a
`symbol_set_<id>` translation key. No frontend code needs to change beyond
that — see `apps/web-react/src/lib/astrology/symbolSystems.ts`. Also drop
`<id>.cs.json`, `<id>.fr.json`, and `<id>.es.json` for full localization (see
`degreeSymbolSets.ts`), or omit them to fall back to English everywhere.
