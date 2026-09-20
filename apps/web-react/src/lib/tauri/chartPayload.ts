import type { ChartDetails, ModelOverridesDto, MoonDetails } from './types';
import { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import {
	DEFAULT_ASPECT_COLORS,
	DEFAULT_ASPECT_ORBS,
	DEFAULT_ENABLED_ASPECT_IDS
} from '@/lib/astrology/aspects';
import type { AspectLineTierStyleDto } from './types';

/** In-memory chart row used by the React shell (until views own full editor state). */
export interface AppChart {
	id: string;
	name: string;
	chartType: string;
	dateTime: string;
	location: string;
	tags: string[];
	tagColors?: Record<string, string>;
	houseSystem?: string | null;
	zodiacType?: string;
	engine?: string | null;
	model?: string | null;
	modelOverrides?: ModelOverridesDto | null;
	overrideEphemeris?: string | null;
	latitude?: number;
	longitude?: number;
	timezone?: string;
	utcOffset?: string;
	locationRegime?: 'auto' | 'manual';
	timeRegime?: 'auto' | 'manual';
	rodenRating?: string;
	observableObjects?: string[];
	aspectOrbs?: Record<string, number>;
	selectedAspects?: string[];
	includedPoints?: string[];
	displayStyle?: string;
	colorTheme?: string;
	ayanamsa?: string | null;
	timeSystem?: string | null;
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
		shapes?: string[];
		configurations?: string[];
		moonDetails?: MoonDetails | null;
	};
}

export const SUPPORTED_RUST_HOUSE_SYSTEMS = [
	'Placidus',
	'Whole Sign',
	'Campanus',
	'Koch',
	'Equal',
	'Regiomontanus',
	'Vehlow',
	'Porphyry',
	'Alcabitius'
] as const;

export type SupportedRustHouseSystem = (typeof SUPPORTED_RUST_HOUSE_SYSTEMS)[number];

export function normalizeSupportedHouseSystem(
	value?: string | null
): SupportedRustHouseSystem | null {
	const normalized = value?.trim();
	if (!normalized) return null;
	return SUPPORTED_RUST_HOUSE_SYSTEMS.find((system) => system === normalized) ?? null;
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
	shapes?: string[];
	configurations?: string[];
	moon_details?: MoonDetails | null;
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
	const moonDetails =
		'moon_details' in payload
			? (payload.moon_details as MoonDetails | null | undefined)
			: undefined;
	return {
		positions,
		motion: payload.motion ?? {},
		aspects: payload.aspects ?? [],
		axes,
		houseCusps,
		shapes: payload.shapes ?? [],
		configurations: payload.configurations ?? [],
		...(moonDetails !== undefined ? { moonDetails } : {})
	};
}

/** Stroke style for the outer (loosest) aspect-line tier only. */
export type AspectLineStyleId = 'solid' | 'dashed' | 'dotted';

function isAspectLineStyleId(value: unknown): value is AspectLineStyleId {
	return value === 'solid' || value === 'dashed' || value === 'dotted';
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
	/** Tight/medium/loose always render solid; only the outer tier uses this. */
	outerLineStyle: AspectLineStyleId;
}

export const DEFAULT_ASPECT_LINE_TIER_STYLE: AspectLineTierStyleState = {
	tightThresholdPct: 1,
	mediumThresholdPct: 2,
	looseThresholdPct: 10,
	widthTight: 5,
	widthMedium: 2,
	widthLoose: 1,
	widthOuter: 1,
	outerLineStyle: 'dotted'
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
		widthOuter: num(dto.width_outer, base.widthOuter),
		outerLineStyle: isAspectLineStyleId(dto.outer_line_style) ? dto.outer_line_style : base.outerLineStyle
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
		width_outer: style.widthOuter,
		outer_line_style: style.outerLineStyle
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
	engine: 'jpl',
	defaultBodies: [...DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS],
	defaultAspects: [...DEFAULT_ENABLED_ASPECT_IDS],
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
		utcOffset: full.subject.location.utc_offset ?? undefined,
		locationRegime: full.subject.location.location_mode ?? undefined,
		timeRegime: full.subject.location.timezone_mode ?? undefined,
		houseSystem: full.config.house_system,
		zodiacType: full.config.zodiac_type,
		engine: full.config.engine,
		model: full.config.model,
		modelOverrides: full.config.model_overrides,
		overrideEphemeris: full.config.override_ephemeris,
		tags: full.tags,
		tagColors: full.tag_colors,
		rodenRating: full.roden_rating,
		observableObjects: full.config.observable_objects,
		aspectOrbs: full.config.aspect_orbs,
		selectedAspects: full.config.selected_aspects,
		includedPoints: full.config.included_points,
		displayStyle: full.config.display_style,
		colorTheme: full.config.color_theme,
		ayanamsa: full.config.ayanamsa,
		timeSystem: full.config.time_system
	};
}

export function summaryToAppChart(s: {
	id: string;
	name: string;
	chart_type: string;
	date_time: string;
	location: string;
	tags: string[];
	tag_colors?: Record<string, string>;
}): AppChart {
	return {
		id: s.id,
		name: s.name,
		chartType: s.chart_type,
		dateTime: s.date_time,
		location: s.location,
		tags: s.tags,
		tagColors: s.tag_colors
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
	const houseSystem =
		normalizeSupportedHouseSystem(asNonEmpty(chart.houseSystem)) ??
		normalizeSupportedHouseSystem(defaults.houseSystem) ??
		'Placidus';
	const zodiacType = asNonEmpty(chart.zodiacType) ?? defaults.zodiacType;
	const mode = asNonEmpty(chart.chartType) ?? 'NATAL';
	const engine = asNonEmpty(chart.engine) ?? asNonEmpty(defaults.engine);
	const overrideEphemeris = asNonEmpty(chart.overrideEphemeris);
	const model = asNonEmpty(chart.model);
	const observableObjects =
		Array.isArray(chart.observableObjects)
			? chart.observableObjects
			: defaults.defaultBodies.length > 0
				? defaults.defaultBodies
				: undefined;
	const selectedAspects =
		Array.isArray(chart.selectedAspects)
			? chart.selectedAspects
			: [...defaults.defaultAspects];
	const aspectOrbs =
		chart.aspectOrbs && Object.keys(chart.aspectOrbs).length > 0
			? chart.aspectOrbs
			: defaults.defaultAspectOrbs;
	const tagColors =
		chart.tagColors && Object.keys(chart.tagColors).length > 0 ? chart.tagColors : undefined;

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
				...(chart.utcOffset ? { utc_offset: chart.utcOffset } : {}),
				...(chart.locationRegime ? { location_mode: chart.locationRegime } : {}),
				...(chart.timeRegime ? { timezone_mode: chart.timeRegime } : {})
			}
		},
		config: {
			mode,
			house_system: houseSystem,
			zodiac_type: zodiacType,
			engine,
			override_ephemeris: overrideEphemeris,
			model,
			model_overrides: chart.modelOverrides ?? null,
			observable_objects: observableObjects,
			included_points: chart.includedPoints ?? [],
			selected_aspects: selectedAspects,
			aspect_orbs: aspectOrbs,
			display_style: chart.displayStyle ?? '',
			color_theme: chart.colorTheme ?? '',
			...(chart.ayanamsa ? { ayanamsa: chart.ayanamsa } : {}),
			...(chart.timeSystem ? { time_system: chart.timeSystem } : {})
		},
		tags: chart.tags ?? [],
		...(tagColors ? { tag_colors: tagColors } : {}),
		...(chart.rodenRating ? { roden_rating: chart.rodenRating } : {})
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
		engine: defaults.engine ?? 'jpl',
		locationRegime: 'auto',
		timeRegime: 'auto',
		tags: ['auto']
	};
}

export type NewHoroscopeChartKind = 'radix' | 'event' | 'horary';
export type NewHoroscopeTimeSystem = 'gregorian' | 'julian_day' | 'julian_calendar';
type LatitudeDirection = 'north' | 'south';
type LongitudeDirection = 'east' | 'west';

function parseOptionalNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const n = Number(trimmed);
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
	timeSystem: NewHoroscopeTimeSystem;
	julianDay?: string;
	julianCalendarDate?: string;
	location: string;
	tags: string;
	tagColors?: Record<string, string>;
	latitude: string;
	longitude: string;
	latitudeDir: LatitudeDirection;
	longitudeDir: LongitudeDirection;
	timezone: string;
	utcOffset?: string;
	locationRegime: 'auto' | 'manual';
	timeRegime: 'auto' | 'manual';
	rodenRating?: string;
	workspaceDefaults: WorkspaceDefaultsState;
	existingIds: ReadonlySet<string>;
}): AppChart {
	const chartType =
		input.chartKind === 'radix' ? 'NATAL' : input.chartKind === 'event' ? 'EVENT' : 'HORARY';

	const name = input.locationName.trim() || input.workspaceDefaults.locationName || 'Chart';

	const baseId = normalizeChartId(name);
	const id = uniqueChartId(baseId, input.existingIds);

	const timezone = input.timezone.trim() || input.workspaceDefaults.timezone;
	const dateTime =
		input.timeSystem === 'julian_day'
			? julianDayToUtcIso(input.julianDay ?? '')
			: wallTimeToUtcIso(
					input.timeSystem === 'julian_calendar'
						? julianCalendarDateToGregorianWallDate(input.julianCalendarDate ?? '', input.dateTime)
						: input.dateTime,
					timezone,
					input.utcOffset
				);

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
		timezone,
		utcOffset: input.utcOffset,
		locationRegime: input.locationRegime,
		timeRegime: input.timeRegime,
		houseSystem: input.workspaceDefaults.houseSystem,
		zodiacType: input.workspaceDefaults.zodiacType,
		engine: input.workspaceDefaults.engine,
		tags: tagList,
		tagColors: input.tagColors,
		rodenRating: input.rodenRating || undefined,
		timeSystem: input.timeSystem
	};
}

const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;

export function utcDateToJulianDay(value: Date): number {
	if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
	return value.getTime() / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}

export function julianDayToUtcIso(value: string | number): string {
	const julianDay = typeof value === 'number' ? value : Number(value.trim());
	if (!Number.isFinite(julianDay)) throw new Error('Julian Day must be a finite number.');
	const result = new Date((julianDay - UNIX_EPOCH_JULIAN_DAY) * MILLISECONDS_PER_DAY);
	if (!Number.isFinite(result.getTime()))
		throw new Error('Julian Day is outside the supported range.');
	return result.toISOString();
}

function parseJulianCalendarDate(value: string): { year: number; month: number; day: number } {
	const match = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) throw new Error('Julian calendar date must use YYYY-MM-DD.');
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const monthLengths = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]!) {
		throw new Error('Invalid Julian calendar date.');
	}
	return { year, month, day };
}

function julianCalendarJdn(year: number, month: number, day: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

function gregorianDateFromJdn(jdn: number): { year: number; month: number; day: number } {
	const a = jdn + 32044;
	const b = Math.floor((4 * a + 3) / 146097);
	const c = a - Math.floor((146097 * b) / 4);
	const d = Math.floor((4 * c + 3) / 1461);
	const e = c - Math.floor((1461 * d) / 4);
	const m = Math.floor((5 * e + 2) / 153);
	return {
		day: e - Math.floor((153 * m + 2) / 5) + 1,
		month: m + 3 - 12 * Math.floor(m / 10),
		year: 100 * b + d - 4800 + Math.floor(m / 10)
	};
}

export function julianCalendarDateToGregorianWallDate(value: string, time: Date): Date {
	const julian = parseJulianCalendarDate(value);
	const gregorian = gregorianDateFromJdn(julianCalendarJdn(julian.year, julian.month, julian.day));
	const result = new Date(time);
	result.setDate(1);
	result.setFullYear(gregorian.year, gregorian.month - 1, gregorian.day);
	if (!Number.isFinite(result.getTime())) throw new Error('Julian calendar date is unsupported.');
	return result;
}

export function gregorianWallDateToJulianCalendarDate(value: Date): string {
	if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
	const year = value.getFullYear();
	const month = value.getMonth() + 1;
	const day = value.getDate();
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	const jdn =
		day +
		Math.floor((153 * m + 2) / 5) +
		365 * y +
		Math.floor(y / 4) -
		Math.floor(y / 100) +
		Math.floor(y / 400) -
		32045;
	const c = jdn + 32082;
	const d = Math.floor((4 * c + 3) / 1461);
	const e = c - Math.floor((1461 * d) / 4);
	const jm = Math.floor((5 * e + 2) / 153);
	const julianDay = e - Math.floor((153 * jm + 2) / 5) + 1;
	const julianMonth = jm + 3 - 12 * Math.floor(jm / 10);
	const julianYear = d - 4800 + Math.floor(jm / 10);
	return `${String(julianYear).padStart(4, '0')}-${String(julianMonth).padStart(2, '0')}-${String(julianDay).padStart(2, '0')}`;
}

function fixedUtcOffsetMilliseconds(timezone: string): number | null {
	if (/^(UTC|GMT)$/i.test(timezone)) return 0;
	const match = /^(?:UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(timezone);
	if (!match) return null;
	const hours = Number(match[2]);
	const minutes = Number(match[3] ?? 0);
	if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
	const milliseconds = (hours * 60 + minutes) * 60_000;
	return match[1] === '+' ? milliseconds : -milliseconds;
}

function ianaWallTimeParts(timezone: string, instant: Date): number[] {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(instant);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return [
		Number(values.year),
		Number(values.month) - 1,
		Number(values.day),
		Number(values.hour),
		Number(values.minute),
		Number(values.second)
	];
}

function ianaOffsetMilliseconds(timezone: string, instant: Date): number {
	const values = ianaWallTimeParts(timezone, instant);
	const representedAsUtc = Date.UTC(
		values[0]!,
		values[1]!,
		values[2]!,
		values[3]!,
		values[4]!,
		values[5]!
	);
	return representedAsUtc - instant.getTime();
}

function wallTimeParts(value: Date): number[] {
	return [
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		value.getHours(),
		value.getMinutes(),
		value.getSeconds()
	];
}

function sameWallTime(left: number[], right: number[]): boolean {
	return left.every((value, index) => value === right[index]);
}

/** Convert the form's wall-clock fields in `timezone` into one unambiguous UTC instant. */
export function wallTimeToUtcIso(value: Date, timezone: string, utcOffset?: string): string {
	if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
	const normalizedTimezone = timezone.trim();
	if (!normalizedTimezone) throw new Error('Timezone is required.');

	const wallTimeUtc = Date.UTC(
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		value.getHours(),
		value.getMinutes(),
		value.getSeconds()
	);
	const explicitOffset = utcOffset?.trim();
	const fixedOffset = fixedUtcOffsetMilliseconds(explicitOffset ?? normalizedTimezone);
	if (explicitOffset && fixedOffset === null) {
		throw new Error(`Invalid UTC offset: ${explicitOffset}`);
	}
	if (fixedOffset !== null) return new Date(wallTimeUtc - fixedOffset).toISOString();

	let candidate = new Date(wallTimeUtc);
	let offset = ianaOffsetMilliseconds(normalizedTimezone, candidate);
	candidate = new Date(wallTimeUtc - offset);
	const correctedOffset = ianaOffsetMilliseconds(normalizedTimezone, candidate);
	if (correctedOffset !== offset) candidate = new Date(wallTimeUtc - correctedOffset);

	const expectedWallTime = wallTimeParts(value);
	if (!sameWallTime(ianaWallTimeParts(normalizedTimezone, candidate), expectedWallTime)) {
		throw new Error(`The selected local time does not exist in ${normalizedTimezone}.`);
	}

	for (let deltaMinutes = -180; deltaMinutes <= 180; deltaMinutes += 15) {
		if (deltaMinutes === 0) continue;
		const alternative = new Date(candidate.getTime() + deltaMinutes * 60_000);
		if (sameWallTime(ianaWallTimeParts(normalizedTimezone, alternative), expectedWallTime)) {
			throw new Error(
				`The selected local time occurs twice in ${normalizedTimezone}; choose a UTC offset.`
			);
		}
	}
	return candidate.toISOString();
}
