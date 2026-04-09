import type { ChartDetails } from './types';

/** In-memory chart row used by the React shell (until views own full editor state). */
export interface AppChart {
	id: string;
	name: string;
	chartType: string;
	dateTime: string;
	location: string;
	tags: string[];
	houseSystem?: string | null;
	zodiacType?: string;
	engine?: string | null;
	model?: string | null;
	overrideEphemeris?: string | null;
	latitude?: number;
	longitude?: number;
	timezone?: string;
	computed?: {
		positions?: Record<string, number>;
		aspects?: unknown[];
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
}

export const DEFAULT_WORKSPACE_DEFAULTS: WorkspaceDefaultsState = {
	houseSystem: 'Placidus',
	zodiacType: 'Tropical',
	timezone: 'Europe/Prague',
	locationName: 'Prague',
	locationLatitude: 50.0875,
	locationLongitude: 14.4214,
	engine: null,
	defaultBodies: [],
	defaultAspects: []
};

export function chartDetailsToAppChart(full: ChartDetails): AppChart {
	return {
		id: full.id,
		name: full.subject.name,
		chartType: full.config.mode,
		dateTime: full.subject.event_time || '',
		location: full.subject.location.name,
		latitude: full.subject.location.latitude,
		longitude: full.subject.location.longitude,
		timezone: full.subject.location.timezone,
		houseSystem: full.config.house_system,
		zodiacType: full.config.zodiac_type,
		engine: full.config.engine,
		model: full.config.model,
		overrideEphemeris: full.config.override_ephemeris,
		tags: full.tags
	};
}

export function summaryToAppChart(s: {
	id: string;
	name: string;
	chart_type: string;
	date_time: string;
	location: string;
	tags: string[];
}): AppChart {
	return {
		id: s.id,
		name: s.name,
		chartType: s.chart_type,
		dateTime: s.date_time,
		location: s.location,
		tags: s.tags
	};
}

/** JSON payload for `save_workspace` / chart YAML. */
export function chartDataToComputePayload(
	chart: AppChart,
	defaults: WorkspaceDefaultsState
): Record<string, unknown> {
	const asNonEmpty = (value?: string | null): string | null => {
		const normalized = value?.trim();
		return normalized ? normalized : null;
	};

	const dateTime = asNonEmpty(chart.dateTime);
	const locationName = asNonEmpty(chart.location) ?? defaults.locationName;
	const timezone = asNonEmpty(chart.timezone) ?? defaults.timezone;
	const houseSystem = asNonEmpty(chart.houseSystem) ?? defaults.houseSystem;
	const zodiacType = asNonEmpty(chart.zodiacType) ?? defaults.zodiacType;
	const mode = asNonEmpty(chart.chartType) ?? 'NATAL';
	const engine = asNonEmpty(chart.engine) ?? asNonEmpty(defaults.engine);
	const overrideEphemeris = asNonEmpty(chart.overrideEphemeris);
	const model = asNonEmpty(chart.model);
	const observableObjects = defaults.defaultBodies.length > 0 ? defaults.defaultBodies : undefined;

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
				timezone
			}
		},
		config: {
			mode,
			house_system: houseSystem,
			zodiac_type: zodiacType,
			engine,
			override_ephemeris: overrideEphemeris,
			model,
			observable_objects: observableObjects
		},
		tags: chart.tags ?? []
	};
}

/** Default “current sky” chart id for first-run bootstrap. */
export const BOOTSTRAP_CHART_ID = 'current-sky';

export function normalizeChartId(name: string): string {
	const trimmed = name.trim().toLowerCase();
	const slug = trimmed.replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '_');
	return slug.length > 0 ? slug : 'chart';
}

export function uniqueChartId(baseId: string, existingIds: ReadonlySet<string>): string {
	if (!existingIds.has(baseId)) return baseId;
	let n = 2;
	while (existingIds.has(`${baseId}-${n}`)) n += 1;
	return `${baseId}-${n}`;
}

/** One real chart on first launch when no workspace is open. */
export function createBootstrapChart(defaults: WorkspaceDefaultsState): AppChart {
	const now = new Date();
	const dateTime = now.toISOString().slice(0, 19) + 'Z';
	const defaultLat = Number.isFinite(defaults.locationLatitude) ? defaults.locationLatitude : 0;
	const defaultLon = Number.isFinite(defaults.locationLongitude) ? defaults.locationLongitude : 0;
	const defaultLocationName = defaults.locationName || 'Unknown';
	return {
		id: BOOTSTRAP_CHART_ID,
		name: 'Current Sky',
		chartType: 'EVENT',
		dateTime,
		location: `${defaultLocationName} (${defaultLat.toFixed(4)}, ${defaultLon.toFixed(4)})`,
		latitude: defaultLat,
		longitude: defaultLon,
		timezone: defaults.timezone,
		houseSystem: defaults.houseSystem,
		zodiacType: defaults.zodiacType,
		engine: defaults.engine ?? 'swisseph',
		tags: ['auto']
	};
}

export type NewHoroscopeChartKind = 'radix' | 'event' | 'horary';

function parseOptionalNumber(value: string): number | undefined {
	const n = Number(value.trim());
	return Number.isFinite(n) ? n : undefined;
}

/** Build an in-memory chart from the New Horoscope form (before optional Tauri persist). */
export function appChartFromNewHoroscopeInput(input: {
	locationName: string;
	chartKind: NewHoroscopeChartKind;
	date: string;
	time: string;
	location: string;
	advancedLocation: string;
	tags: string;
	latitude: string;
	longitude: string;
	timezone: string;
	advancedMode: boolean;
	workspaceDefaults: WorkspaceDefaultsState;
	existingIds: ReadonlySet<string>;
}): AppChart {
	const chartType =
		input.chartKind === 'radix' ? 'NATAL' : input.chartKind === 'event' ? 'EVENT' : 'HORARY';

	const name = input.locationName.trim() || input.workspaceDefaults.locationName || 'Chart';

	const baseId = normalizeChartId(name);
	const id = uniqueChartId(baseId, input.existingIds);

	const dateTime = [input.date.trim(), input.time.trim()].filter(Boolean).join(' ');

	const locText = input.advancedMode ? input.advancedLocation.trim() : input.location.trim();
	const location = locText || input.workspaceDefaults.locationName;

	const lat = parseOptionalNumber(input.latitude);
	const lon = parseOptionalNumber(input.longitude);

	const tagList = input.tags
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	return {
		id,
		name,
		chartType,
		dateTime,
		location,
		latitude: lat ?? input.workspaceDefaults.locationLatitude,
		longitude: lon ?? input.workspaceDefaults.locationLongitude,
		timezone: input.timezone.trim() || input.workspaceDefaults.timezone,
		houseSystem: input.workspaceDefaults.houseSystem,
		zodiacType: input.workspaceDefaults.zodiacType,
		engine: input.workspaceDefaults.engine,
		tags: tagList
	};
}
