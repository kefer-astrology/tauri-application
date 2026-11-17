# Third-party data: not covered by the MIT License

Files in this directory are compiled into the application. They are
**excluded** from the repository's MIT licence.

| File | Source | Status |
|---|---|---|
| `hypothetical-bodies.json` | Witte/Sieggrün orbital elements refined by J. Neely, *Matrix Journal* VII (1980), **copied from Swiss Ephemeris `seorbel.txt`** (an AGPL-3.0/commercial distribution). Model `kepler-neely-j1900-v1`. | **Unresolved** (decision L8): the values must be re-derived from a primary source or cleared before an enforced release. `licensing/resource-inventory.json` marks the file `unresolved`, so the release-content check blocks it. |

The file follows the kefer-contracts format
`contracts/schemas/points/hypothetical-bodies.schema.json`. Users can also
import their own hypothetical bodies (Settings → Observable Objects).
