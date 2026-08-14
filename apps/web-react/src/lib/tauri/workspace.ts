import { invoke } from '@tauri-apps/api/core';
import type {
	ChartDetails,
	ComputeChartResult,
	ComputeSettingsOverrides,
	CurrentModelReport,
	ResolvedLocation,
	TransitSeriesRequest,
	TransitSeriesResult,
	WorkspaceDefaultsDto,
	WorkspaceInfo
} from './types';
import {
	aspectLineTierStyleToDto,
	chartDetailsToAppChart,
	normalizeComputedChartPayload,
	summaryToAppChart,
	type AppChart,
	type WorkspaceDefaultsState
} from './chartPayload';
import type { TransitAspect } from '@/lib/astrology/transits';
import { isTauriRuntime } from './runtime';

const DEMO_LOCATIONS: ResolvedLocation[] = [
	{
		query: 'Prague',
		display_name: 'Prague, Czech Republic',
		latitude: 50.0875,
		longitude: 14.4213,
		timezone: 'Europe/Prague'
	},
	{
		query: 'Brno',
		display_name: 'Brno, Czech Republic',
		latitude: 49.1951,
		longitude: 16.6068,
		timezone: 'Europe/Prague'
	},
	{
		query: 'Pardubice',
		display_name: 'Pardubice, Czech Republic',
		latitude: 50.0343,
		longitude: 15.7812,
		timezone: 'Europe/Prague'
	},
	{
		query: 'Bratislava',
		display_name: 'Bratislava, Slovakia',
		latitude: 48.1486,
		longitude: 17.1077,
		timezone: 'Europe/Bratislava'
	},
	{
		query: 'Vienna',
		display_name: 'Vienna, Austria',
		latitude: 48.2082,
		longitude: 16.3738,
		timezone: 'Europe/Vienna'
	}
];

function demoChartId(chartJson: Record<string, unknown>): string {
	if (typeof chartJson.id === 'string') return chartJson.id;
	const subject = chartJson.subject;
	if (
		subject &&
		typeof subject === 'object' &&
		typeof (subject as { id?: unknown }).id === 'string'
	) {
		return (subject as { id: string }).id;
	}
	return 'demo-chart';
}

function findDemoLocations(query: string): ResolvedLocation[] {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return [];
	return DEMO_LOCATIONS.filter((location) =>
		`${location.query} ${location.display_name}`.toLocaleLowerCase().includes(normalized)
	);
}

export async function openFolderDialog(): Promise<string | null> {
	if (!isTauriRuntime()) return null;
	return invoke<string | null>('open_folder_dialog');
}

export async function loadWorkspace(workspacePath: string): Promise<WorkspaceInfo> {
	return invoke<WorkspaceInfo>('load_workspace', { workspacePath });
}

export async function initStorage(workspacePath: string): Promise<string> {
	return invoke<string>('init_storage', { workspacePath });
}

export async function getWorkspaceDefaults(workspacePath: string): Promise<WorkspaceDefaultsDto> {
	return invoke<WorkspaceDefaultsDto>('get_workspace_defaults', { workspacePath });
}

export async function getCurrentModelReport(
	workspacePath: string,
	chartId?: string | null
): Promise<CurrentModelReport> {
	return invoke<CurrentModelReport>('get_current_model_report', { workspacePath, chartId });
}

export async function getChartDetails(
	workspacePath: string,
	chartId: string
): Promise<ChartDetails> {
	return invoke<ChartDetails>('get_chart_details', { workspacePath, chartId });
}

export async function computeChart(
	workspacePath: string,
	chartId: string,
	options?: {
		presetId?: string | null;
		settingsOverrides?: ComputeSettingsOverrides | null;
	}
): Promise<ComputeChartResult> {
	return invoke<ComputeChartResult>('compute_chart', {
		workspacePath,
		chartId,
		presetId: options?.presetId ?? null,
		settingsOverrides: options?.settingsOverrides ?? null
	});
}

export async function computeChartFromData(
	chartJson: Record<string, unknown>,
	settingsOverrides?: ComputeSettingsOverrides | null
): Promise<ComputeChartResult> {
	if (!isTauriRuntime()) {
		return {
			chart_id: demoChartId(chartJson),
			positions: {},
			aspects: []
		};
	}
	return invoke<ComputeChartResult>('compute_chart_from_data', {
		chartJson,
		settingsOverrides: settingsOverrides ?? null
	});
}

export async function computeCrossAspectsFromData(
	chartJson: Record<string, unknown>,
	transitingPositions: Record<string, number>,
	transitedPositions: Record<string, number>,
	aspectTypes: string[],
	settingsOverrides?: ComputeSettingsOverrides | null
): Promise<TransitAspect[]> {
	if (!isTauriRuntime()) return [];
	return invoke<TransitAspect[]>('compute_cross_aspects_from_data', {
		chartJson,
		transitingPositions,
		transitedPositions,
		aspectTypes,
		settingsOverrides: settingsOverrides ?? null
	});
}

export function computeTransitSeries(params: TransitSeriesRequest): Promise<TransitSeriesResult> {
	return invoke<TransitSeriesResult>('compute_transit_series', {
		...params,
		presetId: params.presetId ?? null,
		settingsOverrides: params.settingsOverrides ?? null
	});
}

export async function resolveLocation(query: string): Promise<ResolvedLocation> {
	if (!isTauriRuntime()) {
		const location = findDemoLocations(query)[0];
		if (location) return { ...location, query };
		return {
			query,
			display_name: query.trim(),
			latitude: 0,
			longitude: 0,
			timezone: 'UTC'
		};
	}
	return invoke<ResolvedLocation>('resolve_location', { query });
}

export async function resolveTimezone(latitude: number, longitude: number): Promise<string> {
	if (!isTauriRuntime()) {
		const nearest = DEMO_LOCATIONS.reduce((best, candidate) => {
			const bestDistance = Math.hypot(best.latitude - latitude, best.longitude - longitude);
			const candidateDistance = Math.hypot(
				candidate.latitude - latitude,
				candidate.longitude - longitude
			);
			return candidateDistance < bestDistance ? candidate : best;
		});
		const nearestDistance = Math.hypot(nearest.latitude - latitude, nearest.longitude - longitude);
		return nearestDistance <= 5 ? nearest.timezone : 'UTC';
	}
	return invoke<string>('resolve_timezone', { latitude, longitude });
}

export async function searchLocations(query: string): Promise<ResolvedLocation[]> {
	if (!isTauriRuntime()) return findDemoLocations(query);
	return invoke<ResolvedLocation[]>('search_locations', { query });
}

export async function saveWorkspace(
	workspacePath: string,
	owner: string,
	charts: Record<string, unknown>[],
	defaults?: WorkspaceDefaultsState
): Promise<string> {
	return invoke<string>('save_workspace', {
		workspacePath,
		owner,
		charts,
		defaults: defaults
			? {
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
					aspect_line_tier_style: aspectLineTierStyleToDto(defaults.aspectLineTierStyle)
				}
			: undefined
	});
}

export async function saveWorkspaceDefaults(
	workspacePath: string,
	defaults: WorkspaceDefaultsState
): Promise<WorkspaceDefaultsDto> {
	return invoke<WorkspaceDefaultsDto>('save_workspace_defaults', {
		workspacePath,
		defaults: {
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
			aspect_line_tier_style: aspectLineTierStyleToDto(defaults.aspectLineTierStyle)
		}
	});
}

/** Load workspace folder: summaries → full chart rows where possible, init DB, compute each chart. */
export async function openWorkspaceFolder(
	folderPath: string,
	onDefaults?: (d: WorkspaceDefaultsDto) => void,
	onModelReport?: (r: CurrentModelReport) => void
): Promise<{ path: string; charts: AppChart[] }> {
	const workspace = await loadWorkspace(folderPath);

	try {
		const report = await getCurrentModelReport(folderPath);
		onModelReport?.(report);
	} catch (e) {
		console.warn('get_current_model_report failed:', e);
	}

	try {
		const defaults = await getWorkspaceDefaults(folderPath);
		onDefaults?.(defaults);
	} catch (e) {
		console.warn('get_workspace_defaults failed:', e);
	}

	const charts: AppChart[] = [];
	for (const ch of workspace.charts) {
		try {
			const full = await getChartDetails(folderPath, ch.id);
			charts.push(chartDetailsToAppChart(full));
		} catch (err) {
			console.error(`get_chart_details failed for ${ch.id}:`, err);
			charts.push(summaryToAppChart(ch));
		}
	}

	await initStorage(workspace.path);

	for (const chart of charts) {
		try {
			const result = await computeChart(workspace.path, chart.id);
			chart.computed = normalizeComputedChartPayload(result);
		} catch (err) {
			console.error(`compute_chart failed for ${chart.id}:`, err);
		}
	}

	return { path: workspace.path, charts };
}
