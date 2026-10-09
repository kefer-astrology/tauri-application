---
title: 'Settings and appearance'
description: 'A reference to workspace defaults, calculation choices, symbols, and application appearance.'
weight: 50
---

Open **Settings** at the bottom of the primary sidebar. The secondary sidebar
has eight entries. The first six contain preferences; **Jan Kefer** is a short
biography and **Manual** opens this documentation. The support button opens the
project donation page.

## What changes a calculation?

The workspace defaults below supply values when creating a new horoscope and
when a view needs a default. They do not alter the date, place, or result saved
with an existing chart. A chart can also explicitly choose its own objects and
aspects.

### Language and location

Choose the interface language from **Čeština**, **English**, **Français**, and
**Español**. It changes labels and bundled text, not stored astronomical data.

Set a default place by searching for it, which fills its name, latitude, and
longitude, or enter the latitude and longitude yourself. The **Timezone** field
is the default timezone for new chart forms. Check all three location values
before calculating: a place name is descriptive, while coordinates and time
are the calculation inputs.

### House system and position mode

**House system** offers the systems which the current Rust/JPL backend reports
as computable. The list is deliberately supplied by the backend, so it can
change with backend capability; choosing one changes the cusps and house-based
results.

**Position mode** has two choices:

- **Apparent** — the normal astrological choice, using the route's apparent
  positions and corrections.
- **Geometric / true** — the uncorrected instantaneous geometric vector. Use
  it only when that distinction is intentional.

There is no calculation-engine picker in the current Settings screen. Backend
choice and ephemeris availability are described in
[Ephemerides and coverage](../../developer/ephemeris-manager/).

### Observable objects

Choose the bodies and points proposed for new charts and used as defaults in
views. The picker groups the available catalog; [Objects, aspects, and chart
patterns](../objects-aspects-and-patterns/#observable-objects) is the complete
list. Selection does not install data or guarantee a result for every date:
the active local kernels still decide coverage. Fixed stars can be browsed and
filtered by northern/southern ecliptic latitude, but they are currently
discoverability entries rather than backend-computed positions.

### Aspect settings

The **School** selector is a shortcut for an aspect preset. It replaces the
enabled aspects, their default orbs, and whether angles participate; it does
not switch the house system, objects, zodiac, or engine. The preset values and
the separate workspace “active school” concept are documented under
[Schools and aspect settings](../objects-aspects-and-patterns/#schools-and-aspect-settings).

Each built-in aspect can then be configured independently:

- enable or disable it;
- set its orb (0–30°, in 0.5° steps) and display color;
- include chart angles; and
- enable an extended scope and set its smaller extended orb.

The **radix aspect lines** controls only change the wheel drawing: percentage
thresholds for tight, medium, and loose lines; line widths for each tier and
the outer line; and a solid, dashed, or dotted outer-line style. They never
change whether the aspect itself is calculated.

## Symbols and wheel presentation

These options change how the React application looks, not the astronomical
calculation.

- Choose the **Default** or **Modern** astrology glyph set, and the **Default**
  or **Alternative** app-shell icon family.
- Enable available degree-symbol text sets. Catalogued sets without bundled
  text appear disabled; a set falls back to English where its translation is
  unavailable.
- Choose a **Minimalist** radix wheel (sign ring and 12 dividers) or a
  **Technical** wheel (the sign ring plus a 360° tick scale).
- Set colors for Fire, Earth, Air, and Water, and use the glyph manager for
  glyph overrides.

### Radix wheel orientation

**Left edge of radix** controls only how the wheel is drawn:

- **Ascendant (ASC)** places the chart's computed Ascendant at the left edge.
- **Beginning of Aries (0°)** keeps 0° Aries at the left edge.

It does not change the house system, calculated cusps or axes, planet
positions, or aspects. In the current React app, wheel orientation is a
device-local display preference, so it does not travel with a workspace.

## Application layout

Choose one of four base themes: **Sunrise**, **Noon**, **Twilight**, or
**Midnight**. The compact control at the bottom of the primary sidebar changes
that base theme quickly.

The full **Theme palette** editor lets you adjust the two colors of the main
sidebar, secondary sidebar, and canvas; primary, secondary, and muted text;
the accent; and hover and selected backgrounds. Hover and selected backgrounds
can retain transparency, while **Popup background fuzziness** controls their
softness. **Reset current** restores the built-in palette for the selected base
theme. The **Monochromatic view** switch desaturates the whole application on
top of the chosen theme and palette; it does not discard those colors.

Use **Save** to commit palette and element-color edits, or **Cancel** to return
the unsaved fields in this screen to their current values. Several small
display choices and the interface language are stored locally by the frontend;
workspace calculation defaults are stored with the workspace. Do not rely on a
visual preference being shared with another device.
