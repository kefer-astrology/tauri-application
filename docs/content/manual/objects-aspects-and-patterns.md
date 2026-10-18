---
title: 'Objects, aspects, and chart patterns'
description: 'The built-in objects and aspects, plus chart shapes and configurations Kefer can report.'
weight: 35
---

This reference lists the complete built-in catalog. The available choices in
**Settings** are the final authority for the selected workspace and calculation
engine. A workspace can define its own model, and an object can be catalogued
but unavailable because its engine or local ephemeris kernel does not support
it. The selector marks entries that are not computable; they cannot be used to
produce a chart yet.

## Observable objects

| Group | Computable built-in objects |
| --- | --- |
| Luminaries and planets | Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto |
| Angles | Ascendant, Midheaven, Descendant, Imum Coeli |
| Lunar nodes | North Node, South Node, True North Node, True South Node |
| Calculated points and lots | Lilith, True Lilith, Vertex, Antivertex, Part of Fortune, Part of Spirit |
| Asteroids and centaurs | Chiron, Ceres, Pallas, Juno, Vesta, Astraea, Hebe, Iris, Flora, Metis, Hygiea, Parthenope, Victoria, Egeria, Irene, Eunomia, Psyche, Thetis, Melpomene, Fortuna, Massalia |

The ten planets, angles, lunar nodes, mean Lilith, Chiron, Ceres, Pallas, Juno,
and Vesta work with either supported engine. True Lilith, Vertex, Antivertex,
the Parts of Fortune and Spirit, and the extended asteroid set require the JPL
route and the applicable local kernels. The application never silently
downloads ephemerides during chart calculation. See
[Settings and appearance](../settings-and-appearance/) to choose objects, and
[Ephemerides and coverage](../../developer/ephemeris-manager/) for acquisition,
coverage, and offline behavior.

### Catalogued, not yet computable

The following entries are intentionally visible in the built-in catalog but
are disabled until a calculation route is implemented. They are not hidden
options or alternative names for a currently calculated object.

| Group | Catalogued entries |
| --- | --- |
| Additional Lilith | Osculating Lilith |
| Geocentric planetary nodes | Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto nodes |
| Trans-Neptunian objects | Eris, Sedna, Haumea, Makemake, Quaoar, Orcus, Varuna |
| Uranian / Hamburg hypotheticals | Cupido, Hades, Zeus, Kronos, Apollon, Admetos, Vulcanus, Poseidon |
| Fixed stars | Alpheratz, Algenib, Hamal, Algol, Alcyone, Aldebaran, Rigel, Capella, Bellatrix, Betelgeuse, Sirius, Canopus, Procyon, Pollux, Regulus, Denebola, Zosma, Vindemiatrix, Spica, Arcturus, Alphecca, Zuben Elgenubi, Zuben Eschamali, Antares, Vega, Altair, Deneb, Fomalhaut, Deneb Algedi, Scheat, Markab, Achernar |

This distinction is useful when sharing a workspace: another workspace may
choose a different model catalog, but selecting a planned entry in the
built-in one does not cause a fallback position to be invented.

## Available aspects

All built-in aspects can be enabled, assigned an orb, and limited by object
category in **Settings**. The default selected set is conjunction, sextile,
square, trine, quincunx, and opposition.

| Aspect | Exact angle |
| --- | ---: |
| Conjunction | 0° |
| Semisextile | 30° |
| Undecile | 32.727…° |
| Decile | 36° |
| Novile | 40° |
| Octile | 45° |
| Septile | 51.429…° |
| Sextile | 60° |
| Biundecile | 65.455…° |
| Quintile | 72° |
| Binovile | 80° |
| Triundecile | 98.182…° |
| Square | 90° |
| Biseptile | 102.857…° |
| Tridecile | 108° |
| Trine | 120° |
| Quadriundecile | 130.909…° |
| Trioctile | 135° |
| Biquintile | 144° |
| Quincunx | 150° |
| Triseptile | 154.286…° |
| Quadrinovile | 160° |
| Quinundecile | 163.636…° |
| Opposition | 180° |

An aspect is reported only when the selected model, enabled aspect list,
object-category rule, and resolved orb allow it. The exact angle is fixed; the
orb is a configurable tolerance around it.

## Schools and aspect settings

The **School** selector in React is an **astrological-tradition preset**. It
replaces the workspace defaults for enabled aspects, their orbs, and whether
angles may participate. You can then adjust individual aspects in Settings.
It does **not** currently change objects, house system, zodiac, ayanamsa,
calculation engine, or the underlying model.

| Tradition | Enabled aspects and default orb |
| --- | --- |
| Hellenistic | Conjunction 10°, sextile 8°, square 9°, trine 9°, opposition 10° |
| Medieval / Renaissance traditional | Conjunction 8°, sextile 6°, square 7°, trine 8°, opposition 8° |
| Modern Western | Conjunction 8°, sextile 5°, square 6°, trine 6°, quincunx 2°, semisextile 1°, opposition 8° |
| Harmonic / vibrational | Every built-in aspect, using the catalog orb for each aspect (0.5°–8°) |
| Cosmobiology | Conjunction, octile, square, trioctile, opposition — 2° each |
| Uranian / Hamburg | Conjunction, octile, square, trioctile, opposition — 1.5° each |
| Jyotish — Parāśari | Conjunction 8°, sextile 5°, square 6°, trine 6°, opposition 8° |

Angles are included for the listed major/hard aspects. Modern Western does not
include angles for its semisextile; Harmonic follows the per-aspect catalog
setting. The Hellenistic widths stand in for a whole-sign tolerance, Medieval
widths for per-planet moieties, and the Jyotish option is a temporary
Western-angle approximation—not Jyotish directional *drishti*.

The workspace format has a second, separate concept: an optional
**active school** names a workspace-defined school and chooses its default
calculation model. It is not limited to these seven traditions and does not
automatically merge settings from an `extends` relationship. Most users only
need the visible School preset; see **Settings** for its current effect.

## Chart shapes and configurations

Aspectarium can report these calculated patterns. Information, including its
Spektrum prototype, does not yet use the selected chart's computed result.
Patterns are descriptions of a chart at its computed instant, not extra objects
or additional calculations to configure.

**Distribution shapes:** Bundle, Bowl, Locomotive, Bucket, Seesaw, Splash,
Splay, Shifted Center, and Stellium. Bowl, Bucket, and Locomotive can include
a leader or hemisphere variant. Shape detection uses the ten classical bodies
(Sun through Pluto) and needs at least seven of them in the calculation.

**Aspect configurations:** T-square, Grand Trine, Grand Cross, Kite, Mystic
Rectangle, Double Quincunx, Double Biquintile, Hexagram, and Pentagram.
T-squares and Grand Crosses can include a modality; Grand Trines and Kites can
include an element. These configurations use the computed aspect list among
the ten classical bodies.

For transits, **Yod** is the name used for the same two-quincunx-plus-sextile
geometry called **Double Quincunx** in a chart snapshot. Transit configuration
search currently supports Grand Trine, T-square, Yod, and Grand Cross; see
[Transits and time](../transits-and-time/) for the user workflow.
