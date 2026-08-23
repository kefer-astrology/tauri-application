---
title: 'Guided Tour contract'
description: 'How the documentation site layers an interactive tour over the primary React application.'
weight: 28
---

## Entry point

Each public tour page embeds the browser-safe React build from `/apps/web-react/`. The `tour` query parameter selects one of four independent scenarios:

- `?tour=quickstart`
- `?tour=radix`
- `?tour=transits`
- `?tour=settings`

Without a recognized value, the same build remains a normal interactive preview.

The Hugo page owns the tour introduction and application frame. The React application owns the overlay because it can position callouts against live interface elements without relying on iframe coordinates.

## Anchor contract

Tour targets use stable `data-tour` attributes. A tour step selects an anchor such as `[data-tour="nav-horoskop"]` and derives the highlight rectangle from the element at runtime.

- Anchor names describe meaning, not visual position.
- Layout and styling changes may move an anchor without breaking the tour.
- Renaming or removing an anchor requires updating every tour step that targets it.
- Fixed pixel coordinates are not part of the contract.

The primary and secondary sidebars expose their navigation destinations. The radix dashboard additionally exposes its profile, Astrolabe, wheel, positions, and chart-context strip. Transit computation exposes its period selector and calculation action.

## Overlay behavior

The overlay highlights the current target, dims the surrounding interface, and presents Back, Next, Exit, and Finish controls. Left and right arrow keys move between steps; Escape closes the tour.

A step may activate its target before describing it. This allows each scenario to open the relevant view or settings section without duplicating application screens in documentation-specific code. Explanatory steps must not automatically submit a computation or persistence action.

## Browser-safe boundary

The tour must remain useful without Tauri. Browser fallbacks may demonstrate interface structure and non-native interactions, but the tour must not imply that file dialogs, durable workspace persistence, or backend-dependent calculations are available when they are not.

Add new tour sequences in `apps/web-react/src/app/components/guided-tour.tsx`. Add or revise anchors in the owning application component rather than querying presentation-only class names.
