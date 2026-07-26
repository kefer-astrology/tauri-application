// Runes global state (no stores, no classes)

import { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
import {
  ASPECT_ROWS,
  DEFAULT_ASPECT_COLORS,
  DEFAULT_ASPECT_LINE_TIER_STYLE,
  DEFAULT_ASPECT_ORBS,
  normalizeAspectLineTierStyle,
  type AspectLineTierStyleState
} from '$lib/astrology/aspects';
import type { CurrentModelReport } from '$lib/tauri/types';

export interface MoonDetailsDto {
  elongation_deg: number;
  illuminated_fraction: number;
  age_days: number;
  waxing: boolean;
  phase_id: string;
  phase_label: string;
}

export const tabs = ['Radix', 'Aspects', 'Transits', 'Settings', 'About'] as const;
export type Tab = (typeof tabs)[number];

// Chart data structure
export interface ChartData {
  id: string;
  name: string;
  chartType: string;
  dateTime: string;
  location: string;
  tags: string[];
  // Full chart settings
  houseSystem?: string | null;
  zodiacType?: string;
  engine?: string | null;
  model?: string | null;
  overrideEphemeris?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  observableObjects?: string[];
  aspectOrbs?: Record<string, number>;
  selectedAspects?: string[];
  ayanamsa?: string | null;
  timeSystem?: string | null;
  computed?: {
    positions?: Record<string, unknown>;
    motion?: Record<string, { speed: number; retrograde: boolean }>;
    aspects?: any[];
    axes?: {
      asc: number;
      desc: number;
      mc: number;
      ic: number;
    };
    houseCusps?: number[];
    moonDetails?: MoonDetailsDto | null;
  };
}

export interface WorkspaceDefaultsState {
  houseSystem: string;
  zodiacType: string;
  timezone: string;
  locationName: string;
  locationLatitude: number;
  locationLongitude: number;
  engine: string | null;
  defaultBodies: string[];
  defaultAspects: string[];
  defaultAspectOrbs: Record<string, number>;
  defaultAspectColors: Record<string, string>;
  aspectLineTierStyle: AspectLineTierStyleState;
}

const DEFAULT_WORKSPACE_DEFAULTS: WorkspaceDefaultsState = {
  houseSystem: 'Placidus',
  zodiacType: 'Tropical',
  timezone: 'Europe/Prague',
  locationName: 'Prague',
  locationLatitude: 50.0875,
  locationLongitude: 14.4214,
  engine: 'swisseph',
  defaultBodies: [...DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS],
  defaultAspects: ASPECT_ROWS.map((aspect) => aspect.id),
  defaultAspectOrbs: { ...DEFAULT_ASPECT_ORBS },
  defaultAspectColors: { ...DEFAULT_ASPECT_COLORS },
  aspectLineTierStyle: { ...DEFAULT_ASPECT_LINE_TIER_STYLE }
};

export type Mode =
  | 'new_radix'
  | 'open'
  | 'radix_view'
  | 'radix_table'
  | 'radix_transits'
  | 'info'
  | 'dynamic'
  | 'revolution'
  | 'favorite'
  | 'settings'
  | 'export';

export const layout = $state({
  selectedTab: tabs[0] as Tab,
  selectedContext: '' as string,
  contexts: [] as ChartData[],
  workspacePath: null as string | null,
  workspaceDefaults: { ...DEFAULT_WORKSPACE_DEFAULTS } as WorkspaceDefaultsState,
  leftExpanded: true,
  rightExpanded: true,
  mode: 'radix_view' as Mode,
  prevMode: 'radix_view' as Mode,
  overlay: {
    openExport: false,
  },
});

export function setMode(next: Mode) {
  if (layout.mode !== next) {
    layout.prevMode = layout.mode as Mode;
    layout.mode = next;
  }
}

export function showOpenExportOverlay(show: boolean) {
  layout.overlay.openExport = show;
}

export function setWorkspaceDefaults(defaults: Partial<WorkspaceDefaultsState>) {
  const asNonEmpty = (value?: string | null): string | null => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  };

  const asFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  layout.workspaceDefaults = {
    houseSystem: asNonEmpty(defaults.houseSystem) ?? layout.workspaceDefaults.houseSystem,
    zodiacType: asNonEmpty(defaults.zodiacType) ?? layout.workspaceDefaults.zodiacType,
    timezone: asNonEmpty(defaults.timezone) ?? layout.workspaceDefaults.timezone,
    locationName: asNonEmpty(defaults.locationName) ?? layout.workspaceDefaults.locationName,
    locationLatitude: asFiniteNumber(defaults.locationLatitude) ?? layout.workspaceDefaults.locationLatitude,
    locationLongitude: asFiniteNumber(defaults.locationLongitude) ?? layout.workspaceDefaults.locationLongitude,
    engine: asNonEmpty(defaults.engine) ?? layout.workspaceDefaults.engine,
    defaultBodies: Array.isArray(defaults.defaultBodies) ? [...defaults.defaultBodies] : layout.workspaceDefaults.defaultBodies,
    defaultAspects: Array.isArray(defaults.defaultAspects) ? [...defaults.defaultAspects] : layout.workspaceDefaults.defaultAspects,
    defaultAspectOrbs:
      defaults.defaultAspectOrbs && typeof defaults.defaultAspectOrbs === 'object'
        ? { ...layout.workspaceDefaults.defaultAspectOrbs, ...defaults.defaultAspectOrbs }
        : layout.workspaceDefaults.defaultAspectOrbs,
    defaultAspectColors:
      defaults.defaultAspectColors && typeof defaults.defaultAspectColors === 'object'
        ? { ...layout.workspaceDefaults.defaultAspectColors, ...defaults.defaultAspectColors }
        : layout.workspaceDefaults.defaultAspectColors,
    aspectLineTierStyle:
      defaults.aspectLineTierStyle
        ? normalizeAspectLineTierStyle({
            ...layout.workspaceDefaults.aspectLineTierStyle,
            ...defaults.aspectLineTierStyle
          })
        : layout.workspaceDefaults.aspectLineTierStyle
  };
}

export function resetWorkspaceDefaults() {
  layout.workspaceDefaults = { ...DEFAULT_WORKSPACE_DEFAULTS };
}

/** Apply the backend's resolved model-layer defaults before the workspace-layer DTO overlay. */
export function mergeModelReportDefaults(report: CurrentModelReport) {
  const effective = report.effective_settings;
  layout.workspaceDefaults = {
    ...layout.workspaceDefaults,
    defaultBodies:
      effective.default_bodies.length > 0
        ? effective.default_bodies
        : layout.workspaceDefaults.defaultBodies,
    defaultAspects:
      effective.default_aspects.length > 0
        ? effective.default_aspects
        : layout.workspaceDefaults.defaultAspects,
    defaultAspectOrbs:
      Object.keys(effective.aspect_orbs).length > 0
        ? { ...layout.workspaceDefaults.defaultAspectOrbs, ...effective.aspect_orbs }
        : layout.workspaceDefaults.defaultAspectOrbs
  };
}

export function addContext(name: string) {
  const n = name?.trim();
  if (!n) return;
  // Check if context with this name already exists
  const existing = layout.contexts.find(c => c.name === n);
  if (!existing) {
    const newChart: ChartData = {
      id: n.toLowerCase().replace(/\s+/g, '-'),
      name: n,
      chartType: 'NATAL',
      dateTime: '',
      location: '',
      tags: [],
      houseSystem: 'Placidus',
      zodiacType: 'Tropical',
    };
    layout.contexts = [...layout.contexts, newChart];
  }
  const target = layout.contexts.find(c => c.name === n);
  if (target) {
    layout.selectedContext = target.id;
  }
}

export function loadChartsFromWorkspace(charts: ChartData[]) {
  layout.contexts = charts;
  if (charts.length > 0) {
    layout.selectedContext = charts[0].id;
  }
}

export function getSelectedChart(): ChartData | undefined {
  return layout.contexts.find(c => c.id === layout.selectedContext);
}

export function normalizeComputedPayload(computed: ChartData['computed']): ChartData['computed'] {
  const positions = { ...(computed?.positions ?? {}) } as Record<string, unknown>;
  const axes = computed?.axes;
  if (axes) {
    positions.asc = axes.asc;
    positions.desc = axes.desc;
    positions.mc = axes.mc;
    positions.ic = axes.ic;
  }
  const houseCusps = computed?.houseCusps ?? [];
  houseCusps.forEach((cusp, index) => {
    positions[`house_${index + 1}`] = cusp;
  });
  const moonDetails =
    (computed as { moonDetails?: MoonDetailsDto | null; moon_details?: MoonDetailsDto | null } | undefined)
      ?.moonDetails ??
    (computed as { moon_details?: MoonDetailsDto | null } | undefined)?.moon_details;
  return {
    positions,
    motion: computed?.motion ?? {},
    aspects: computed?.aspects ?? [],
    axes,
    houseCusps,
    ...(moonDetails !== undefined ? { moonDetails } : {})
  };
}

export function updateChartComputation(chartId: string, computed: ChartData['computed']) {
  const chart = layout.contexts.find(c => c.id === chartId);
  if (chart) {
    chart.computed = normalizeComputedPayload(computed);
    layout.contexts = [...layout.contexts]; // Trigger reactivity
  }
}

export function updateChartComputationAtTime(
  chartId: string,
  dateTime: string,
  computed: ChartData['computed']
) {
  const chart = layout.contexts.find(c => c.id === chartId);
  if (chart) {
    chart.dateTime = dateTime;
    chart.computed = normalizeComputedPayload(computed);
    layout.contexts = [...layout.contexts];
  }
}

/** Build JSON payload for compute_chart_from_data (Python parse_chart_yaml format). */
export function chartDataToComputePayload(chart: ChartData): Record<string, unknown> {
  const asNonEmpty = (value?: string | null): string | null => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  };

  const defaults = layout.workspaceDefaults;
  const dateTime = asNonEmpty(chart.dateTime);
  const locationName = asNonEmpty(chart.location) ?? defaults.locationName;
  const timezone = asNonEmpty(chart.timezone) ?? defaults.timezone;
  const houseSystem = asNonEmpty(chart.houseSystem) ?? defaults.houseSystem;
  const zodiacType = asNonEmpty(chart.zodiacType) ?? defaults.zodiacType;
  const mode = asNonEmpty(chart.chartType) ?? 'NATAL';
  const engine = asNonEmpty(chart.engine) ?? asNonEmpty(defaults.engine);
  const overrideEphemeris = asNonEmpty(chart.overrideEphemeris);
  const model = asNonEmpty(chart.model);
  const observableObjects =
    chart.observableObjects && chart.observableObjects.length > 0
      ? chart.observableObjects
      : (defaults.defaultBodies.length > 0 ? defaults.defaultBodies : undefined);
  const selectedAspects =
    chart.selectedAspects && chart.selectedAspects.length > 0
      ? chart.selectedAspects
      : [...defaults.defaultAspects];
  const aspectOrbs =
    chart.aspectOrbs && Object.keys(chart.aspectOrbs).length > 0
      ? chart.aspectOrbs
      : defaults.defaultAspectOrbs;

  return {
    id: chart.id,
    subject: {
      id: chart.id,
      name: chart.name,
      event_time: dateTime,
      location: {
        name: locationName,
        latitude: chart.latitude ?? defaults.locationLatitude,
        longitude: chart.longitude ?? defaults.locationLongitude,
        timezone,
      },
    },
    config: {
      mode,
      house_system: houseSystem,
      zodiac_type: zodiacType,
      engine,
      override_ephemeris: overrideEphemeris,
      model,
      observable_objects: observableObjects,
      selected_aspects: selectedAspects,
      aspect_orbs: aspectOrbs,
      ...(chart.ayanamsa ? { ayanamsa: chart.ayanamsa } : {}),
      ...(chart.timeSystem ? { time_system: chart.timeSystem } : {}),
    },
    tags: chart.tags ?? [],
  };
}
