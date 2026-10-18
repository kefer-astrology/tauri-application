---
title: 'Transits and time'
description: 'Inspect changing positions and move a chart through time.'
weight: 40
---

Open **Transits** to compare a selected radix chart with positions for another
moment. The radix stays fixed; the selected **Transiting bodies** move through
the period and are compared with the selected **Transited bodies** in the
radix. Use the secondary navigation to configure General, Transited Bodies,
Transiting Bodies, and Aspects.

## Calculate a transit range

1. Choose **Transit** as the type. Primary and secondary directions are shown
   but unavailable today.
2. Choose the source radix chart. In a workspace, the series calculation uses
   its saved chart; the selected chart remains the fixed reference.
3. Choose a period:
   - **Current** calculates one instant at the time you press **Calculate**.
   - **Next/previous 3 months**, **next/previous 6 months**, and
     **next/previous year** create a range from the moment you choose that
     preset. The displayed dates are read-only for a preset.
   - **Custom** lets you edit both date and time fields.
4. Select the moving (**transiting**) objects, the fixed radix
   (**transited**) objects, and the aspects to compare. The two object lists
   are independent: an object may appear in both, which is useful for return
   events such as a transiting planet aspecting its natal position.
5. For a range with sampled output, choose a positive graph interval in
   seconds, minutes, hours, or days, then select **Calculate**.

The sampled result is a sequence of snapshots at that interval. A smaller
interval gives a denser graph/table and may take longer; it does not make an
exact-event search more precise. Very dense or long ranges can exceed the
calculation limit, so use a coarser interval when the sample estimate is high.

The date and time controls currently use the browser's local time for entry
and are sent as a concrete instant. The timezone text fields in this screen
are disabled placeholders; use the source chart's location/timezone settings
when you need to change the chart's time basis.

## Read the results

With sampled output enabled, the results area offers a **Resonance** chart and
a sortable table of aspect activity. The Resonance view can be zoomed in time
and orb distance; its Layers sidebar lets you show or hide all waves attached
to each selected transited body. The table and chart describe the sampled
series, so their apparent closest approach is not a substitute for an exact
event result.

Opening a sampled hit, an exact event, or a configuration boundary creates the
transit overlay for that instant against the same radix. It does not alter the
radix chart itself.

## Exact events, stations, and configurations

These optional searches are independent of graph sampling. You can turn off
**Sampled graph output** when you only need these results.

- **Exact events** finds the root-calculated time a requested aspect becomes
  exact, including moving-to-radix and moving-to-moving pairs. A result can
  therefore occur between graph samples.
- **Stations** finds a selected moving body's direct/retrograde turning points.
- **Multi-body configurations** finds intervals, rather than a single instant,
  during which a Grand Trine, T-square, Yod, or Grand Cross remains within orb.

For a configuration search, the role controls can constrain which bodies fill
each pattern role and can hold selected roles at radix positions. This lets a
pattern combine moving bodies with fixed natal targets. A configuration's
**best fit** is its closest fit within orb, not a claim that every constituent
aspect is exact simultaneously.

An event or configuration result can be opened as a chart at that instant.
Exact-event and configuration searches may report a warning or incomplete
result when the requested period lacks usable ephemeris coverage or a bounded
search cannot finish. Some near-contact results are labelled tangential or
unconfirmed rather than silently presented as crossings. Treat an incomplete
empty list as inconclusive, not as proof that no event occurred.

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
