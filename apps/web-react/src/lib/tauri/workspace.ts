import { invoke } from '@tauri-apps/api/core';
import type {
	ChartDetails,
	ComputeChartResult,
	ResolvedLocation,
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

export async function openFolderDialog(): Promise<string | null> {
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

export async function getChartDetails(
	workspacePath: string,
	chartId: string
): Promise<ChartDetails> {
	return invoke<ChartDetails>('get_chart_details', { workspacePath, chartId });
}

export async function computeChart(
	workspacePath: string,
	chartId: string
): Promise<ComputeChartResult> {
	return invoke<ComputeChartResult>('compute_chart', { workspacePath, chartId });
}

export async function computeChartFromData(
	chartJson: Record<string, unknown>
): Promise<ComputeChartResult> {
	return invoke<ComputeChartResult>('compute_chart_from_data', { chartJson });
}

export async function resolveLocation(query: string): Promise<ResolvedLocation> {
	return invoke<ResolvedLocation>('resolve_location', { query });
}

export async function searchLocations(query: string): Promise<ResolvedLocation[]> {
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
	onDefaults?: (d: WorkspaceDefaultsDto) => void
): Promise<{ path: string; charts: AppChart[] }> {
	const workspace = await loadWorkspace(folderPath);

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
