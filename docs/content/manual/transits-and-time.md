---
title: 'Transits and time'
description: 'Inspect changing positions and move a chart through time.'
weight: 40
---

Open **Transits** to compare a selected radix chart with positions for another moment. Use its secondary navigation to choose the available transit operation.

## Calculate a transit range

1. Choose **Transit** as the type. Primary and secondary directions are visible
   as future work but are not currently selectable.
2. Choose the source radix chart. Transit calculation requires a saved chart;
   it does not use an unsaved chart draft.
3. Choose **Current** for a single current-moment view, or **Custom** to enter
   a start and end date/time.
4. Select the moving (**transiting**) objects, the radix (**transited**) objects,
   and the aspects to compare.
5. Choose the graph sampling interval, then select **Calculate**.

The sampled result is a sequence of snapshots at that interval. A smaller
interval gives a denser graph/table and may take longer; it does not make an
exact-event search more precise. Results can be viewed as a chart or table;
the selected radix remains the fixed reference point.

## Exact events, stations, and configurations

These optional searches are independent of graph sampling. You can turn off
**Sampled graph output** when you only need these results.

- **Exact events** finds the exact time a requested aspect becomes exact,
  including moving-to-radix and moving-to-moving pairs.
- **Stations** finds a selected moving body's direct/retrograde turning points.
- **Multi-body configurations** finds intervals, rather than a single instant,
  during which a Grand Trine, T-square, Yod, or Grand Cross remains within orb.

An event or configuration result can be opened as a chart at that instant.
Exact-event and configuration searches may report a warning or incomplete
result when the requested period lacks usable ephemeris coverage or a bounded
search cannot finish. Treat an incomplete empty list as inconclusive, not as
proof that no event occurred.

For the supported objects, aspects, and the Yod/Double Quincunx terminology,
see [Objects, aspects, and chart patterns](../objects-aspects-and-patterns/).

## Current limitations

The visible controls for house crossings, sign crossings, transit limits, and
general precession are disabled placeholders; they do not add results yet.
The timezone fields are also currently unavailable in this view. **Dynamics**
uses the same time-oriented area for broader movement and range workflows, but
does not make primary or secondary directions available today.

When time navigation is available elsewhere in the application, choose a unit
and amount before stepping backward or forward. Calendar-aware units such as
months and years are applied as calendar changes rather than fixed numbers of
seconds.
