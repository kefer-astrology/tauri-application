# Widget workspace plan

Plan for the widget workspace that the chart screens of the React app
(`apps/web-react`) are built from: Horoskop, Spektrum and the Aspectarium. The interaction design comes
from the proposal _Kefer – návrh struktury widgetů_ (Czech); this file turns it
into an implementation plan on top of the existing component layers
(`docs/content/developer/frontend-components.md`).

## Concepts

- **Modules.** _Horoskop_ is chart work: a protected centre for the wheel,
  with left, right and an optional bottom region for widgets. _Spektrum_ is
  analysis: a free grid of 12 columns on desktop, 6 on tablet and 1 on mobile,
  scrolling vertically rather than shrinking cards.
- **Workspace profile** (_profil pracovní plochy_): which widgets are shown,
  their settings, position and size, collapsed / pinned state and data context,
  with one layout per module and per screen size. A profile decides **what is
  shown and how**, never **what is calculated**.
- **Presets:** Basic (Základní), Modern (Moderní), Traditional (Tradiční) and
  Kabbalistic (Kabalistický), defined in code and read-only. A workspace may override a preset partly (its name, its widget
  list, or the layout of one module at one screen size); the effective profile
  is the preset with that override applied. A new profile starts from the
  current workspace (offered first), from a preset, or empty.
- **School and profile:** every profile belongs to one astrological school
  (`astrologyTradition`, set in Settings). The school decides what is
  calculated and which profiles are offered; the profile only decides what is
  shown, so switching profiles never changes a result.

  | Profile     | School                 | Within the school                        |
  | ----------- | ---------------------- | ---------------------------------------- |
  | Basic       | Modern western         | fewer, simpler widgets                   |
  | Modern      | Modern western         | the full modern set                      |
  | Traditional | Medieval / traditional | the traditional set (dignities, sect, …) |
  | Kabbalistic | Medieval / traditional | + Tree of Life and its correspondences   |

  Kabbalistic astrology (the hermetic line Jan Kefer worked in) maps the seven
  classical planets onto the sephiroth and the signs onto the paths of the Tree
  of Life; it interprets the traditional chart and does not calculate it
  differently. Only Modern western and Medieval / traditional are available
  yet; Hellenistic, Harmonic, Cosmobiology, Uranian and Jyotish are listed but
  disabled. There is no "no school": a workspace without an available school
  works as Modern western. A workspace opens with its school's first profile.

- **Widget** = a manifest (id, title, description, categories, sizes, settings,
  unique or repeatable) plus a component. One widget with several
  configurations, not near-duplicate widgets per tradition.
- **Archetypes:** the fifteen reusable building blocks below. They are the
  shared views in `app/views/`; the catalog shows widgets by their user-facing
  name ("Planet positions"), never by archetype.
- **Data context:** a widget follows the active chart (default), is pinned to
  one chart, or compares chart A with chart B. A widget-local filter that
  differs from the global one shows a small indicator.
- **Edit mode** (_Upravit plochu_): positions are locked outside it.
- **One right panel:** profiles, the widget catalog, widget settings and
  details share a single right panel that switches content. Panels never stack.

## Current state

In place:

- **Horoskop module** (`src/app/features/horoscope/horoskop/`): `HoroskopView`
  places the school profile's widgets into the regions of
  `ChartWorkspaceLayout` around the protected wheel. Widgets: chart profile,
  astrolabe, positions, each in a `WidgetFrame`; the selection shared by the
  wheel and the positions lives in `HoroskopProvider`. The old dashboard is
  gone; the guided-tour anchors are kept.
- **Aspectarium** (`src/app/features/horoscope/aspectarium/`): its own screen
  on a `WidgetGrid`, with the aspect grid, aspect list and midpoints as widgets
  and the shared filters in the toolbar.
- **Spektrum** (`src/app/features/horoscope/spektrum/`): a `WidgetGrid` of 14
  cards, every one from the chart facts (pure rows in
  `src/lib/astrology/informationView.ts`) with an empty state. Hover previews
  a card item's bodies and chart half on the wheel, a click locks it. The
  proportion charts are shared data views (`views/data/share-charts.tsx`).
  Left out from the mockup, as they have no facts behind them: focal scores,
  the configuration preview and the "dynamics in wheel" switch.
- **Workspace basics:** `WidgetWorkspaceProvider` holds the profile in use and
  this session's changes. Each widget has a `⋯` menu (remove from the
  workspace, with Undo); the Horoskop toolbar switches between the school's
  profiles and opens the catalog in the right panel ("+ Add", or "On the
  workspace · Find"). Changes are not saved yet.

- **One right panel:** `RightPanelProvider` (`src/app/providers/right-panel.tsx`)
  with `DetailSidePanel` views. A view opened from another shows on top with
  Back; nothing stacks.
- **Chart halves:** the wheel's `hemisphereOverlay` uses the facts' names
  (`upper`, `lower`, `east`, `west`).
- **Model start:** `src/lib/widgets/` has the types, the presets,
  `resolveProfile` (preset + workspace override) and
  `defaultPresetForTradition`.

Guided-tour anchors to keep (`src/app/shell/guided-tour.tsx`):
`radix-profile`, `radix-astrolabe`, `radix-wheel`, `radix-positions`
(`radix-chart-tabs` belongs to the shell's chart tabs).

### Archetypes against existing views

| #   | Archetype            | Existing                                                             | Work                       |
| --- | -------------------- | -------------------------------------------------------------------- | -------------------------- |
| 1   | Circular diagram     | `HoroscopeWheel` (`views/domain/horoscope-wheel/`, layered)          | Ready; multi-ring later    |
| 2   | Context card         | `ChartContextCard`                                                   | Ready                      |
| 3   | Navigation control   | `TimeNavigator`; `DatePickerInput`, `TimeRollerPicker`               | Ready                      |
| 4   | Data table           | `DataTable`, `PositionsList`, `ChartTreeTable`                       | Ready; size variants       |
| 5   | Matrix               | `AspectMatrix`                                                       | Ready                      |
| 6   | Summary indicators   | Spektrum highlights, retrograde and focal-planet cards               | Ready                      |
| 7   | Proportion chart     | Share charts (`views/data/share-charts.tsx`)                         | Ready                      |
| 8   | Configuration review | `ConfigurationMatchesPanel` (transits); Spektrum configurations card | Generalize                 |
| 9   | Relation diagram     | Data only: `final_dispositors`, `chart_ruler`                        | Build                      |
| 10  | Cycle indicator      | `CycleAnalysisPanel`; Spektrum wheel's phase badges                  | Generalize                 |
| 11  | Timeline             | `TimeTicker`, `time-axis`                                            | Ready                      |
| 12  | Event list           | `EventSearchPanel`, `ExactHitsTable` (transit-specific props)        | Generalize                 |
| 13  | Continuous chart     | `TimeSeriesChart` (zoom, pan, highlight)                             | Ready                      |
| 14  | Text and notes       | —                                                                    | Build; needs a notes store |
| 15  | Comparison view      | Transit overlay on wheel and aspectarium; synastry form              | Build                      |

Fifteen is a starting set, not a limit.

### Data for the Spektrum widgets

The selected chart's `computed` data and `computed.facts` (`ChartFacts`,
`src/lib/tauri/types.ts`; defined in
`docs/content/developer/chart-facts-contract.md`). Widgets do not recompute
classifications. Without facts a widget shows an empty state, not demo numbers.

| Widget                             | Source                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Element dominance (Převaha živlu)  | `facts.element_counts`, `facts.bodies[id].element`                                                     |
| Modality dominance (Převaha modu)  | `facts.modality_counts`, `facts.bodies[id].modality`                                                   |
| House dominance (Převaha v domech) | `facts.house_group_counts`, `facts.bodies[id].house` / `house_group`                                   |
| Quadrants (Kvadranty)              | `facts.distribution.quadrants`                                                                         |
| Hemispheres (Hemisféry)            | `facts.distribution` (`east`, `west`, `upper`, `lower`, `placed`)                                      |
| Extroversion / introversion        | `facts.orientation`                                                                                    |
| Aspects (Aspekty)                  | `facts.aspect_counts`, `facts.unaspected`, the chart's aspects                                         |
| Configurations (Konfigurace)       | `computed.configurations`, `computed.shapes`                                                           |
| Stellium                           | `facts.stelliums`                                                                                      |
| Singleton in a hemisphere          | `facts.bodies` + `facts.distribution` (pure helper)                                                    |
| Retrograde (Retrogradita)          | `facts.bodies[id].motion`, `computed.motion`                                                           |
| Focal planets (Ohniskové planety)  | `facts.angular_planets`, `facts.chart_ruler`, `facts.final_dispositors`                                |
| Lunar phase, lights, synodic roles | `facts.lunar_cycle_phase`, `facts.sun_horizon` / `moon_horizon`, `facts.mercury_phase` / `venus_phase` |

## Architecture

```
src/lib/widgets/                    # pure, Vitest-tested
  types.ts                          # WidgetManifest, WidgetInstance, DataContext, Layout, Profile
  layout.ts                         # free-slot search, move with minimal push, per-breakpoint layouts
  profiles.ts                       # presets, copy / rename / duplicate / reorder, (de)serialization
src/app/providers/
  right-panel.tsx                   # the one right panel: open(content), close, back
  widget-workspace.tsx              # active profile, edit mode, layouts, undo
src/app/views/data/widget-frame/    # header (collapse, title, ⋯ menu, drag handle), size variants
src/app/views/data|domain/          # archetype views, data as props
src/app/features/<feature>/widgets.ts   # each feature exports its widget manifests
src/app/shell/widget-registry.ts    # the shell assembles the registry from the features
src/app/shell/workspace/            # module hosts: Horoskop regions, Spektrum grid, catalog, profile menu
```

The registry lives in the shell because the shell is the only layer that may
compose several features; features never import each other. Features reach
the right panel and the workspace state through the providers.

## Rules

- **Layers** per `frontend-components.md`. Archetype views take data and
  callbacks as props; widget wrappers resolve the data context and settings.
- **Calculation stays separate.** Switching profiles never changes house
  system, zodiac, orbs, method or `astrologyTradition` (see decision 2).
- **Categories:** Common, Modern, Traditional, Kabbalistic; a widget may have
  several. The same set serves the Open-view filter tabs.
- **Adding:** "+ Add" for repeatable widgets (with an instance count), "On the
  workspace · Find" for unique ones. A new widget goes to the nearest free slot
  and is briefly highlighted; the workspace is never silently rearranged.
  Dragging a widget from the catalog onto the grid is out of scope; widgets are
  moved on the workspace itself in edit mode.
- **Header:** collapse chevron, title, `⋯` menu (settings, size, move,
  duplicate for repeatable widgets, expand to detail, remove from workspace);
  the drag handle shows only in edit mode. A pencil appears only where it edits
  content.
- **Remove** means "remove from workspace" (instances, never data), with an
  Undo toast. Confirmation dialogs only for irreversible actions.
- **Edit mode:** fine grid, move and resize handles, region outlines, Save and
  Cancel, undo. Moving previews the target, pushes only the neighbours that
  must move, keeps their sizes, commits on drop. A keyboard "Move" with a target
  region or position is required (WCAG 2.2, 2.5.7 Dragging Movements).
- **Size changes content:** each widget declares a minimum, a default and its
  supported sizes, and what each size shows (positions: compact = object and
  position; standard = + house and retrograde; extended = chosen columns). The
  wheel keeps its aspect ratio. Resizing never changes the meaning of an
  analysis.
- **Right panel:** opening the catalog does not reflow the grid; on desktop the
  panel overlays the right part; on small screens it opens as its own view. It
  stays modal.
- **Interaction:** single click selects, double click opens. `⋯` is a click
  menu; there are no right-click menus.
- **Copy** through i18n keys (`translations.csv`, then `npm run i18n:sync`);
  chart times are local time at the event's place; no raw native controls
  outside `app/components/ui/`.

## Phases

Each phase ends with its tests passing and the component catalog updated.

1. **Model** in `lib/widgets/`: placement and move rules (free-slot search,
   minimal push, per-breakpoint layouts), creating / duplicating / reordering
   profiles, serialization; tested. Fill the presets' widget sets as widgets
   are built.
2. **Archetype views** still missing: relation diagram, notes,
   comparison; generalize configuration review, cycle indicator and event list.
3. **Workspace shell, rest:** more `⋯` actions (settings, size, move, duplicate,
   expand), catalog search and category filter, creating and managing own
   profiles, data-context resolver (pinned and compared charts), edit mode with
   undo. Dragging uses `@dnd-kit` (pointer and keyboard sensors); placement
   stays in `lib/widgets/`. The right panel overlays the content without
   reflowing it.
4. **Horoskop module, rest:** the bottom region, per-screen-size layouts (the
   compact layout still moves the left region as a whole), and widgets for the
   Horoskop-specific views that come later.
5. **Spektrum module, rest:** the Aspectarium widgets may be added there too.
6. **Profile management:** rename, duplicate, default, reorder, reset to
   preset, delete own profiles; per-breakpoint layouts. Saving workspace
   overrides needs a workspace-file field (Rust and `workspace.yaml`).

## Decisions

- **Storage:** presets live in code; workspace overrides (saved with the
  workspace) adjust them partly.
- **Calculation:** profiles never change calculation settings; the school
  decides the calculation and which profiles are offered.
- **Dragging:** own placement model plus `@dnd-kit`.
- **Right panel:** overlays the content on desktop; a full view on small
  screens.
- **Matrix transit layer:** a widget setting (data context), not a separate
  widget.

- **Schools and profiles:** see _School and profile_ above; the school list is
  `src/lib/astrology/schools.ts`.

- **Out of scope:** dragging widgets from the catalog onto the grid; the right
  panel stays modal.

## Tests

- Vitest for `lib/widgets/` (placement, push rules, per-breakpoint layouts,
  presets, serialization) and for every helper that maps facts to widget rows.
- A server-render test per archetype view and per module host, with and
  without facts and with no chart selected (pattern:
  `src/app/features/transits/transits.test.tsx`).
- Keyboard move and resize in edit mode.
- Time-dependent tests in `TZ=UTC`, `Europe/Prague`, `America/Los_Angeles` and
  `Asia/Kathmandu`.

## Done when

1. `npm run check`, `npx eslint apps/web-react/src`,
   `npx prettier --check apps/web-react/src`, `npm test` and `npm run build`
   pass.
2. The three screens in `src/app/components/` are gone; Horoskop and Spektrum
   are module hosts built from widgets.
3. Every Spektrum widget shows the selected chart's facts, or an empty state.
4. The component catalog describes the widget model, the archetype views and
   both modules, current state only.
