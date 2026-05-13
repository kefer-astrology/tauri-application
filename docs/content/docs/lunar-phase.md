---
title: "Lunar phase (moon details)"
description: "How Kefer derives geocentric lunar phase and illumination from chart positions."
weight: 43
---

# Lunar phase (moon details)

Chart compute commands attach a **`moon_details`** object to the JSON result whenever **`positions.sun`** and **`positions.moon`** are present (tropical longitude in degrees, same convention as the rest of the radix).

Source: [src-tauri/src/lunar_phase.rs](../../../src-tauri/src/lunar_phase.rs)

---

## What is included

| Field | Meaning |
|-------|---------|
| `elongation_deg` | Moon minus Sun in tropical longitude, in \[0, 360). 0° = new (conjunction), 180° = full (opposition). |
| `illuminated_fraction` | Fraction of the lunar disk illuminated as seen from Earth, in \[0, 1\], from `(1 - cos(elongation_rad)) / 2`. |
| `age_days` | Rough age since new moon: `elongation / 360 × 29.530588853` days (mean synodic month). |
| `waxing` | `true` when `0° < elongation < 180°` (waxing from new toward full). |
| `phase_id` | Stable id: `new_moon`, `waxing_crescent`, `first_quarter`, `waxing_gibbous`, `full_moon`, `waning_gibbous`, `third_quarter`, `waning_crescent`. |
| `phase_label` | Short English label (e.g. “First Quarter”). |

Eight equal 45° sectors around the principal phases are used for `phase_id` / `phase_label`.

---

## Model and limitations

- Phase uses **geocentric tropical ecliptic longitudes** already computed for the chart. That matches common astrological phase wheels; it is **not** a separate SPICE three-vector solve for the true phase angle at the Moon.
- If either `sun` or `moon` is missing from `positions` (e.g. a highly filtered object list), **`moon_details` is omitted or null** and no error is raised.
- **Sidereal** charts: elongation is still computed from the longitudes returned for that zodiac mode; the geometric relation Sun–Moon is the same; only the origin of longitude differs.

---

## Where it appears

- **`compute_chart`** / **`compute_chart_from_data`** (Rust path): `build_chart_result` adds `moon_details` after aspects are built.
- **Python chart responses**: `normalize_chart_response` fills `moon_details` from `positions` when it was not already set, so Python-backed computes stay aligned when Sun and Moon are present.

This is **not** the [Part of Fortune](../ephemeris-manager/#remaining-gaps) (Pars Fortuna lot); that remains a separate formula on ascendant + luminaries.

---

## Related

- [Ephemeris manager](../ephemeris-manager/) — BSP / position pipeline
- [Tauri command contracts](../tauri-command-contracts/) — `compute_chart` response shape
