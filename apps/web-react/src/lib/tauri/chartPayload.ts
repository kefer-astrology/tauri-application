import type { ChartDetails } from './types';
import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import { ASPECT_ROWS, DEFAULT_ASPECT_COLORS, DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import type { AspectLineTierStyleDto } from './types';

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
		positions?: Record<string, unknown>;
		motion?: Record<
			string,
			{
				speed: number;
				retrograde: boolean;
			}
		>;
		aspects?: unknown[];
		axes?: {
			asc: number;
			desc: number;
			mc: number;
			ic: number;
		};
		houseCusps?: number[];
	};
}

export interface ComputedChartPayload {
	positions?: Record<string, unknown>;
	motion?: Record<
		string,
		{
			speed: number;
			retrograde: boolean;
		}
	>;
	aspects?: unknown[];
	axes?: {
		asc: number;
		desc: number;
		mc: number;
		ic: number;
	};
	house_cusps?: number[];
}

export function normalizeComputedChartPayload(
	payload: ComputedChartPayload
): NonNullable<AppChart['computed']> {
	const positions = { ...(payload.positions ?? {}) };
	const axes = payload.axes;
	if (axes) {
		positions.asc = axes.asc;
		positions.desc = axes.desc;
		positions.mc = axes.mc;
		positions.ic = axes.ic;
	}
	const houseCusps = payload.house_cusps ?? [];
	houseCusps.forEach((cusp, index) => {
		positions[`house_${index + 1}`] = cusp;
	});
	return {
		positions,
		motion: payload.motion ?? {},
		aspects: payload.aspects ?? [],
		axes,
		houseCusps
	};
}

/** Radix wheel aspect line weights from orb vs allowed orb (workspace default). */
export interface AspectLineTierStyleState {
	/** Orb ≤ this % of max orb → `widthTight`. */
	tightThresholdPct: number;
	mediumThresholdPct: number;
	looseThresholdPct: number;
	widthTight: number;
	widthMedium: number;
	widthLoose: number;
	/** Wider than `looseThresholdPct` but still within orb. */
	widthOuter: number;
}

export const DEFAULT_ASPECT_LINE_TIER_STYLE: AspectLineTierStyleState = {
	tightThresholdPct: 1,
	mediumThresholdPct: 2,
	looseThresholdPct: 10,
	widthTight: 5,
	widthMedium: 2,
	widthLoose: 1,
	widthOuter: 1
};

export function aspectLineTierStyleFromDto(
	dto: AspectLineTierStyleDto | null | undefined
): AspectLineTierStyleState {
	const base = DEFAULT_ASPECT_LINE_TIER_STYLE;
	if (!dto || typeof dto !== 'object') return { ...base };
	const num = (v: unknown, fallback: number) =>
		typeof v === 'number' && Number.isFinite(v) ? v : fallback;
	return {
		tightThresholdPct: num(dto.tight_threshold_pct, base.tightThresholdPct),
		mediumThresholdPct: num(dto.medium_threshold_pct, base.mediumThresholdPct),
		looseThresholdPct: num(dto.loose_threshold_pct, base.looseThresholdPct),
		widthTight: num(dto.width_tight, base.widthTight),
		widthMedium: num(dto.width_medium, base.widthMedium),
		widthLoose: num(dto.width_loose, base.widthLoose),
		widthOuter: num(dto.width_outer, base.widthOuter)
	};
}

export function aspectLineTierStyleToDto(style: AspectLineTierStyleState): AspectLineTierStyleDto {
	return {
		tight_threshold_pct: style.tightThresholdPct,
		medium_threshold_pct: style.mediumThresholdPct,
		loose_threshold_pct: style.looseThresholdPct,
		width_tight: style.widthTight,
		width_medium: style.widthMedium,
		width_loose: style.widthLoose,
		width_outer: style.widthOuter
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

export const DEFAULT_WORKSPACE_DEFAULTS: WorkspaceDefaultsState = {
	houseSystem: 'Placidus',
	zodiacType: 'Tropical',
	timezone: 'Europe/Prague',
	locationName: 'Prague',
	locationLatitude: 50.0875,
	locationLongitude: 14.4214,
	engine: 'swisseph',
	defaultBodies: [...DEFAULT_OBSERVABLE_OBJECT_IDS],
	defaultAspects: ASPECT_ROWS.map((aspect) => aspect.id),
	defaultAspectOrbs: { ...DEFAULT_ASPECT_ORBS },
	defaultAspectColors: { ...DEFAULT_ASPECT_COLORS },
	aspectLineTierStyle: { ...DEFAULT_ASPECT_LINE_TIER_STYLE }
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
	const selectedAspects = [...defaults.defaultAspects];

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
			observable_objects: observableObjects,
			selected_aspects: selectedAspects,
			aspect_orbs: defaults.defaultAspectOrbs
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
type LatitudeDirection = 'north' | 'south';
type LongitudeDirection = 'east' | 'west';

function parseOptionalNumber(value: string): number | undefined {
	const n = Number(value.trim());
	return Number.isFinite(n) ? n : undefined;
}

function applyDirection(
	value: string,
	positiveDirection: LatitudeDirection | LongitudeDirection,
	selectedDirection: LatitudeDirection | LongitudeDirection
): number | undefined {
	const parsed = parseOptionalNumber(value);
	if (parsed === undefined) return undefined;
	const magnitude = Math.abs(parsed);
	return selectedDirection === positiveDirection ? magnitude : -magnitude;
}

/** Build an in-memory chart from the New Horoscope form (before optional Tauri persist). */
export function appChartFromNewHoroscopeInput(input: {
	locationName: string;
	chartKind: NewHoroscopeChartKind;
	dateTime: Date;
	location: string;
	tags: string;
	latitude: string;
	longitude: string;
	latitudeDir: LatitudeDirection;
	longitudeDir: LongitudeDirection;
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

	const dateTime = `${formatDatePart(input.dateTime)} ${formatTimePart(input.dateTime)}`;

	const locText = input.location.trim();
	const location = locText || input.workspaceDefaults.locationName;

	const lat = applyDirection(input.latitude, 'north', input.latitudeDir);
	const lon = applyDirection(input.longitude, 'east', input.longitudeDir);

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

function formatDatePart(value: Date): string {
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatTimePart(value: Date): string {
	return [value.getHours(), value.getMinutes(), value.getSeconds()]
		.map((n) => String(n).padStart(2, '0'))
		.join(':');
}
