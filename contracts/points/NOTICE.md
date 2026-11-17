# Third-party-derived data — not covered by the MIT License

The files in this directory are **excluded** from the repository's MIT
license. They contain facts or data derived from third-party sources; the
original sources' terms and attribution requirements apply. See
[`LICENSING.md`](../../LICENSING.md).

| File | Source | Terms / obligations | Status |
|---|---|---|---|
| `fixed-stars.json` | SIMBAD astronomical database, CDS Strasbourg (retrieved 2026-11-06) | Acknowledge: "This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France." | Redistribution with acknowledgement; confirm CDS terms before commercial use |
| `arabic-lots.json` | Al-Biruni, *Kitab al-Tafhim* (1029), sec. 476, via R. Ramsay Wright's translation (1934) | Formula facts independently encoded; no translated text reproduced | Encoding is project work; listed here because it is source-derived |

Hypothetical-body (Uranian) orbital elements are **not distributed** in this
package. Their provenance is unresolved: the values used so far were copied
from Swiss Ephemeris `seorbel.txt`. Only their format is a contract
(`schemas/points/hypothetical-bodies.schema.json`). Implementations ship their
own data pack with its own notice.

