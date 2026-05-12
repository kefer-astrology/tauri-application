---
title: "Physical properties"
description: "Reference notes for richer astronomy fields exposed by JPL-backed results."
weight: 70
---

# Physical properties

This page describes the richer astronomy fields that may be available from JPL-backed computation.

These fields are additive. They should enrich the common result shape, not break it.

## Core extended fields

Fields commonly expected from JPL-backed results:

- `distance`
- `declination`
- `right_ascension`

These are the most important richer astronomy fields beyond ecliptic longitude.

## Location-dependent fields

When observer location is available, the backend may also provide:

- `altitude`
- `azimuth`

These belong to topocentric result enrichment rather than the minimum shared shape.

## Optional further fields

When supported by the backend and requested by the flow, the result may also include:

- `apparent_magnitude`
- `phase_angle`
- `elongation`
- `light_time`

These should be treated as optional extended astronomy metadata.

## Modeling rules

- the stable shared result shape should stay backend-neutral
- richer astronomy fields should be additive rather than mandatory for every backend
- absent fields should be omitted or represented as missing values rather than guessed
- frontend tables and views should tolerate partial field availability

## Usage notes

These fields are useful for:

- higher-precision astronomy inspection
- richer table views
- observational and visibility-oriented analysis
- future advanced filtering and comparison tools

## Current architecture note

The current desktop architecture does not yet treat these fields as part of a persisted computed-data database model. They are primarily part of the live computed result surface.

Use [architecture](../architecture/) and [tauri-command-contracts](../tauri-command-contracts/) for the current runtime contract around computed results.
