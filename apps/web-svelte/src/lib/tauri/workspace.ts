import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '$lib/astrology/aspects';
import type { ChartData, WorkspaceDefaultsState } from '$lib/state/layout';
import type {
  Aspect,
  ChartDetails,
  ComputeChartResult,
  Position,
  RadixRelativePosition,
  ResolvedLocation,
  TransitSeriesRequest,
  TransitSeriesResult,
  WorkspaceChartSummary,
  WorkspaceDefaultsDto,
  WorkspaceInfo
} from './types';

export function workspaceDefaultsToDto(defaults: WorkspaceDefaultsState): WorkspaceDefaultsDto {
  return {
    default_house_system: defaults.houseSystem,
    default_timezone: defaults.timezone,
    default_location_name: defaults.locationName,
    default_location_latitude: defaults.locationLatitude,
    default_location_longitude: defaults.locationLongitude,
    default_engine: defaults.engine,
    default_bodies: defaults.defaultBodies,
    default_aspects: defaults.defaultAspects,
    default_aspect_orbs: defaults.defaultAspectOrbs,
    default_aspect_colors: defaults.defaultAspectColors,
    aspect_line_tier_style: {
      tight_threshold_pct: defaults.aspectLineTierStyle.tightThresholdPct,
      medium_threshold_pct: defaults.aspectLineTierStyle.mediumThresholdPct,
      loose_threshold_pct: defaults.aspectLineTierStyle.looseThresholdPct,
      width_tight: defaults.aspectLineTierStyle.widthTight,
      width_medium: defaults.aspectLineTierStyle.widthMedium,
      width_loose: defaults.aspectLineTierStyle.widthLoose,
      width_outer: defaults.aspectLineTierStyle.widthOuter
    }
  };
}

export function workspaceDefaultsDtoToStatePatch(
  defaults: WorkspaceDefaultsDto
): Partial<WorkspaceDefaultsState> {
  return {
    houseSystem: defaults.default_house_system ?? undefined,
    timezone: defaults.default_timezone ?? undefined,
    locationName: defaults.default_location_name ?? undefined,
    locationLatitude: defaults.default_location_latitude ?? undefined,
    locationLongitude: defaults.default_location_longitude ?? undefined,
    engine: defaults.default_engine ?? undefined,
    defaultBodies: defaults.default_bodies ?? undefined,
    defaultAspects: defaults.default_aspects ?? undefined,
    defaultAspectOrbs: defaults.default_aspect_orbs ?? undefined,
    defaultAspectColors: defaults.default_aspect_colors ?? undefined,
    aspectLineTierStyle: defaults.aspect_line_tier_style
      ? {
          tightThresholdPct:
            defaults.aspect_line_tier_style.tight_threshold_pct ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.tightThresholdPct,
          mediumThresholdPct:
            defaults.aspect_line_tier_style.medium_threshold_pct ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.mediumThresholdPct,
          looseThresholdPct:
            defaults.aspect_line_tier_style.loose_threshold_pct ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.looseThresholdPct,
          widthTight:
            defaults.aspect_line_tier_style.width_tight ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.widthTight,
          widthMedium:
            defaults.aspect_line_tier_style.width_medium ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.widthMedium,
          widthLoose:
            defaults.aspect_line_tier_style.width_loose ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.widthLoose,
          widthOuter:
            defaults.aspect_line_tier_style.width_outer ??
            DEFAULT_ASPECT_LINE_TIER_STYLE.widthOuter
        }
      : undefined
  };
}

export function summaryToChartData(summary: WorkspaceChartSummary): ChartData {
  return {
    id: summary.id,
    name: summary.name,
    chartType: summary.chart_type,
    dateTime: summary.date_time,
    location: summary.location,
    tags: summary.tags
  };
}

export function chartDetailsToChartData(details: ChartDetails): ChartData {
  return {
    id: details.id,
    name: details.subject.name,
    chartType: details.config.mode,
    dateTime: details.subject.event_time || '',
    location: details.subject.location.name,
    latitude: details.subject.location.latitude,
    longitude: details.subject.location.longitude,
    timezone: details.subject.location.timezone,
    houseSystem: details.config.house_system,
    zodiacType: details.config.zodiac_type,
    engine: details.config.engine,
    model: details.config.model,
    overrideEphemeris: details.config.override_ephemeris,
    tags: details.tags
  };
}

export function computeResultToComputed(result: ComputeChartResult): ChartData['computed'] {
  return {
    positions: result.positions ?? {},
    motion: result.motion ?? {},
    aspects: result.aspects ?? [],
    axes: result.axes,
    houseCusps: result.house_cusps,
    moonDetails: result.moon_details
  };
}

export function openFolderDialog(): Promise<string | null> {
  return invoke<string | null>('open_folder_dialog');
}

export function loadWorkspace(workspacePath: string): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>('load_workspace', { workspacePath });
}

export function initStorage(workspacePath: string): Promise<string> {
  return invoke<string>('init_storage', { workspacePath });
}

export function getWorkspaceDefaults(workspacePath: string): Promise<WorkspaceDefaultsDto> {
  return invoke<WorkspaceDefaultsDto>('get_workspace_defaults', { workspacePath });
}

export function getChartDetails(workspacePath: string, chartId: string): Promise<ChartDetails> {
  return invoke<ChartDetails>('get_chart_details', { workspacePath, chartId });
}

export function computeChart(workspacePath: string, chartId: string): Promise<ComputeChartResult> {
  return invoke<ComputeChartResult>('compute_chart', { workspacePath, chartId });
}

export function computeChartFromData(
  chartJson: Record<string, unknown>
): Promise<ComputeChartResult> {
  return invoke<ComputeChartResult>('compute_chart_from_data', { chartJson });
}

export function resolveLocation(query: string): Promise<ResolvedLocation> {
  return invoke<ResolvedLocation>('resolve_location', { query });
}

export function searchLocations(query: string): Promise<ResolvedLocation[]> {
  return invoke<ResolvedLocation[]>('search_locations', { query });
}

export function createChart(
  workspacePath: string,
  chart: Record<string, unknown>
): Promise<string> {
  return invoke<string>('create_chart', { workspacePath, chart });
}

export function updateChart(
  workspacePath: string,
  chartId: string,
  chart: Record<string, unknown>
): Promise<string> {
  return invoke<string>('update_chart', { workspacePath, chartId, chart });
}

export function saveWorkspace(
  workspacePath: string,
  owner: string,
  charts: Record<string, unknown>[],
  defaults: WorkspaceDefaultsState
): Promise<string> {
  return invoke<string>('save_workspace', {
    workspacePath,
    owner,
    charts,
    defaults: workspaceDefaultsToDto(defaults)
  });
}

export function saveWorkspaceDefaults(
  workspacePath: string,
  defaults: WorkspaceDefaultsState
): Promise<WorkspaceDefaultsDto> {
  return invoke<WorkspaceDefaultsDto>('save_workspace_defaults', {
    workspacePath,
    defaults: workspaceDefaultsToDto(defaults)
  });
}

export function computeTransitSeries(params: TransitSeriesRequest): Promise<TransitSeriesResult> {
  return invoke<TransitSeriesResult>('compute_transit_series', params);
}

export async function queryWorkspacePositions(params: {
  workspacePath: string;
  chartId: string;
  startDatetime?: string;
  endDatetime?: string;
  useParquet?: boolean;
}): Promise<Position[]> {
  const startDatetime =
    params.startDatetime && params.startDatetime.trim() !== '' ? params.startDatetime : null;
  const endDatetime =
    params.endDatetime && params.endDatetime.trim() !== '' ? params.endDatetime : null;

  const positions = await invoke<Array<{
    datetime: string;
    object_id: string;
    data: {
      longitude: number;
      latitude?: number;
      declination?: number;
      right_ascension?: number;
      distance?: number;
      altitude?: number;
      azimuth?: number;
      apparent_magnitude?: number;
      phase_angle?: number;
      elongation?: number;
      light_time?: number;
      speed?: number;
      retrograde?: boolean;
    };
    radix_chart_id?: string;
    is_radix: boolean;
  }>>('query_positions', {
    workspacePath: params.workspacePath,
    chartId: params.chartId,
    startDatetime,
    endDatetime,
    useParquet: params.useParquet ?? false
  });

  return positions.map((position) => ({
    chart_id: params.chartId,
    datetime: position.datetime,
    object_id: position.object_id,
    longitude: position.data.longitude,
    latitude: position.data.latitude,
    declination: position.data.declination,
    right_ascension: position.data.right_ascension,
    distance: position.data.distance,
    altitude: position.data.altitude,
    azimuth: position.data.azimuth,
    apparent_magnitude: position.data.apparent_magnitude,
    phase_angle: position.data.phase_angle,
    elongation: position.data.elongation,
    light_time: position.data.light_time,
    speed: position.data.speed,
    retrograde: position.data.retrograde,
    radix_chart_id: position.radix_chart_id,
    is_radix: position.is_radix
  }));
}

export async function computeWorkspaceAspects(params: {
  workspacePath: string;
  chartId: string;
  datetime: string;
  aspectTypes: string[];
  maxOrb: number;
}): Promise<Aspect[]> {
  const aspects = await invoke<Array<{
    relation_id: string;
    datetime: string;
    source_object: string;
    target_object: string;
    aspect_type: string;
    angle: number;
    orb: number;
    exact_datetime?: string;
  }>>('compute_aspects', {
    workspacePath: params.workspacePath,
    chartId: params.chartId,
    datetime: params.datetime,
    aspectTypes: params.aspectTypes,
    maxOrb: params.maxOrb
  });

  return aspects.map((aspect) => ({
    from_object: aspect.source_object,
    to_object: aspect.target_object,
    aspect_type: aspect.aspect_type,
    angle: aspect.angle,
    orb: aspect.orb,
    exact_datetime: aspect.exact_datetime
  }));
}

export async function queryWorkspaceRadixRelative(params: {
  workspacePath: string;
  transitChartId: string;
  radixChartId: string;
  startDatetime?: string;
  endDatetime?: string;
}): Promise<RadixRelativePosition[]> {
  const relative = await invoke<Array<{
    datetime: string;
    object_id: string;
    transit_longitude: number;
    radix_longitude: number;
    longitude_diff: number;
    transit_declination?: number;
    radix_declination?: number;
    declination_diff?: number;
    transit_distance?: number;
    radix_distance?: number;
    distance_diff?: number;
  }>>('query_radix_relative', {
    workspacePath: params.workspacePath,
    transitChartId: params.transitChartId,
    radixChartId: params.radixChartId,
    startDatetime: params.startDatetime ?? null,
    endDatetime: params.endDatetime ?? null
  });

  return relative.map((position) => ({
    datetime: position.datetime,
    object_id: position.object_id,
    transit_longitude: position.transit_longitude,
    radix_longitude: position.radix_longitude,
    longitude_diff: position.longitude_diff,
    transit_declination: position.transit_declination,
    radix_declination: position.radix_declination,
    declination_diff: position.declination_diff,
    transit_distance: position.transit_distance,
    radix_distance: position.radix_distance,
    distance_diff: position.distance_diff
  }));
}

export async function openWorkspaceFolder(
  folderPath: string,
  onDefaults?: (defaults: WorkspaceDefaultsDto) => void
): Promise<{ path: string; charts: ChartData[] }> {
  const workspace = await loadWorkspace(folderPath);

  try {
    const defaults = await getWorkspaceDefaults(folderPath);
    onDefaults?.(defaults);
  } catch (defaultsErr) {
    console.warn('Failed to load workspace defaults, using current defaults:', defaultsErr);
  }

  const charts: ChartData[] = [];
  for (const summary of workspace.charts) {
    try {
      const details = await getChartDetails(folderPath, summary.id);
      charts.push(chartDetailsToChartData(details));
    } catch (err) {
      console.error(`Failed to load full chart data for ${summary.id}:`, err);
      charts.push(summaryToChartData(summary));
    }
  }

  await initStorage(workspace.path);

  for (const chart of charts) {
    try {
      const result = await computeChart(workspace.path, chart.id);
      chart.computed = computeResultToComputed(result);
    } catch (err) {
      console.error(`Failed to compute chart ${chart.id}:`, err);
    }
  }

  return { path: workspace.path, charts };
}
