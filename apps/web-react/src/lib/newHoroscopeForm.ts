/** State and pure transitions of the New horoscope form (create and edit). The date and time
 *  pickers carry wall-clock time at the event's place as a `Date`'s local fields. */

import { tagDefaultColor } from '@/lib/chartTags';
import { chartTimeZone, parseChartDateTime } from '@/lib/chartDateTime';
import {
	gregorianWallDateToJulianCalendarDate,
	julianCalendarDateToGregorianWallDate,
	julianDayToUtcIso,
	utcDateToJulianDay,
	wallTimeToUtcIso,
	type AppChart,
	type NewHoroscopeChartKind,
	type NewHoroscopeTimeSystem,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';
import { instantToWallDate } from '@/lib/time/zone';
import { timeZoneMatchesRegion, timeZoneRegion, TIME_ZONES } from '@/lib/time/zoneCatalog';

export type LatitudeDirection = 'north' | 'south';
export type LongitudeDirection = 'east' | 'west';
export type EntryRegime = 'auto' | 'manual';

export interface NewHoroscopeFormState {
	name: string;
	chartKind: NewHoroscopeChartKind;
	timeSystem: NewHoroscopeTimeSystem;
	/** Gregorian wall-clock date and time at the event's place (picker `Date`). */
	dateTime: Date;
	julianDay: string;
	/** `YYYY-MM-DD` in the Julian calendar; the time of day comes from `dateTime`. */
	julianCalendarDate: string;
	timeRegime: EntryRegime;
	timezone: string;
	timezoneRegion: string;
	/** `UTC±HH:MM`, or `'auto'` to use the time zone's own offset. */
	utcOffset: string;
	locationRegime: EntryRegime;
	location: string;
	/** The location text whose coordinates are current; differs from `location` after editing. */
	resolvedLocation: string;
	/** Coordinate magnitudes as typed; the sign comes from the direction. */
	latitude: string;
	longitude: string;
	latitudeDir: LatitudeDirection;
	longitudeDir: LongitudeDirection;
	tags: string[];
	tagColors: Record<string, string>;
	rodenRating: string;
}

export function supportedTimeSystem(value?: string | null): NewHoroscopeTimeSystem {
	return value === 'julian_day' || value === 'julian_calendar' ? value : 'gregorian';
}

export function chartTypeToKind(chartType: string): NewHoroscopeChartKind {
	if (chartType === 'EVENT') return 'event';
	if (chartType === 'HORARY') return 'horary';
	return 'radix';
}

export function formatCoordinateMagnitude(value: number): string {
	return Math.abs(value).toFixed(4);
}

/** A typed coordinate magnitude with its direction applied, or `null` when it is not a number. */
export function signedCoordinate<D extends LatitudeDirection | LongitudeDirection>(
	value: string,
	positiveDirection: D,
	selectedDirection: D
): number | null {
	const normalized = value.trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) return null;
	return selectedDirection === positiveDirection ? Math.abs(parsed) : -Math.abs(parsed);
}

/** Tags from free text separated by commas or new lines. */
export function parseTags(raw: string): string[] {
	return raw
		.split(/[,\n]/)
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

/** `existing` followed by the `incoming` tags it does not contain yet. */
export function mergeTags(existing: readonly string[], incoming: readonly string[]): string[] {
	const next = [...existing];
	for (const tag of incoming) {
		if (!next.includes(tag)) next.push(tag);
	}
	return next;
}

/** The zone the form's wall-clock time belongs to: the manual UTC offset, else the time zone. */
export function formUtcOffset(
	state: Pick<NewHoroscopeFormState, 'timeRegime' | 'utcOffset'>
): string | undefined {
	return state.timeRegime === 'manual' && state.utcOffset !== 'auto' ? state.utcOffset : undefined;
}

/** Initial form state: the chart being edited, or a new chart at the workspace default place,
 *  dated now (local time there). */
export function initialNewHoroscopeState({
	chart,
	defaults,
	workspaceTags,
	now = new Date()
}: {
	chart?: AppChart;
	defaults: WorkspaceDefaultsState;
	workspaceTags: readonly WorkspaceTagDefinition[];
	now?: Date;
}): NewHoroscopeFormState {
	const timezone = chart?.timezone ?? defaults.timezone ?? '';
	const timeRegime = chart?.timeRegime ?? (chart?.timezone ? 'manual' : 'auto');
	const utcOffset = chart?.utcOffset ?? 'auto';
	const zone = chartTimeZone({ timezone, utcOffset, timeRegime });
	const instant = (chart?.dateTime && parseChartDateTime(chart.dateTime, zone)) || now;
	const dateTime =
		(zone && instantToWallDate(instant, zone)) || instantToWallDate(instant, 'UTC') || instant;

	const latitude = chart ? chart.latitude : defaults.locationLatitude;
	const longitude = chart ? chart.longitude : defaults.locationLongitude;
	const hasDefaultCoordinates =
		Number.isFinite(defaults.locationLatitude) && Number.isFinite(defaults.locationLongitude);
	const catalogColors = Object.fromEntries(
		workspaceTags.flatMap((tag) => (tag.color ? [[tag.name, tag.color]] : []))
	);

	return {
		name: chart?.name ?? '',
		chartKind: chart ? chartTypeToKind(chart.chartType) : 'radix',
		timeSystem: supportedTimeSystem(chart?.timeSystem),
		dateTime,
		julianDay: utcDateToJulianDay(instant).toFixed(8),
		julianCalendarDate: gregorianWallDateToJulianCalendarDate(dateTime),
		timeRegime,
		timezone,
		timezoneRegion: timeZoneRegion(timezone),
		utcOffset,
		locationRegime: chart?.locationRegime ?? (chart?.latitude != null ? 'manual' : 'auto'),
		location: chart?.location ?? defaults.locationName ?? '',
		resolvedLocation: chart
			? chart.latitude != null && chart.longitude != null
				? chart.location
				: ''
			: hasDefaultCoordinates
				? defaults.locationName
				: '',
		latitude: latitude != null ? formatCoordinateMagnitude(latitude) : '',
		longitude: longitude != null ? formatCoordinateMagnitude(longitude) : '',
		latitudeDir: (latitude ?? defaults.locationLatitude) >= 0 ? 'north' : 'south',
		longitudeDir: (longitude ?? defaults.locationLongitude) >= 0 ? 'east' : 'west',
		tags: chart?.tags ?? [],
		tagColors: { ...(chart?.tagColors ?? {}), ...catalogColors },
		rodenRating: chart?.rodenRating ?? ''
	};
}

/** Replace the tag list; colors come from the workspace catalog, then the current colors, then
 *  the default palette. */
export function withTags(
	state: Pick<NewHoroscopeFormState, 'tagColors'>,
	nextTags: readonly string[],
	workspaceTags: readonly WorkspaceTagDefinition[]
): Pick<NewHoroscopeFormState, 'tags' | 'tagColors'> {
	const tags = mergeTags([], nextTags);
	const catalogColors = new Map(workspaceTags.map((tag) => [tag.name, tag.color]));
	const tagColors: Record<string, string> = {};
	tags.forEach((tag, index) => {
		tagColors[tag] = catalogColors.get(tag) ?? state.tagColors[tag] ?? tagDefaultColor(index);
	});
	return { tags, tagColors };
}

/** Rename one tag in place, keeping its color; renaming onto an existing tag merges the two. */
export function withTagRenamed(
	state: Pick<NewHoroscopeFormState, 'tags' | 'tagColors'>,
	tag: string,
	nextName: string
): Pick<NewHoroscopeFormState, 'tags' | 'tagColors'> {
	const normalized = nextName.trim();
	if (!normalized || normalized === tag) return { tags: state.tags, tagColors: state.tagColors };
	const tags = mergeTags(
		[],
		state.tags.map((current) => (current === tag ? normalized : current))
	);
	const tagColors: Record<string, string> = {};
	tags.forEach((nextTag, index) => {
		tagColors[nextTag] =
			nextTag === normalized
				? (state.tagColors[normalized] ?? state.tagColors[tag] ?? tagDefaultColor(index))
				: (state.tagColors[nextTag] ?? tagDefaultColor(index));
	});
	return { tags, tagColors };
}

/** Apply a geocoded place; its time zone replaces the current one only in the auto time regime. */
export function withResolvedLocation(
	state: Pick<NewHoroscopeFormState, 'timeRegime'>,
	place: { displayName: string; latitude: number; longitude: number; timezone?: string }
): Partial<NewHoroscopeFormState> {
	const patch: Partial<NewHoroscopeFormState> = {
		location: place.displayName,
		resolvedLocation: place.displayName,
		latitude: formatCoordinateMagnitude(place.latitude),
		longitude: formatCoordinateMagnitude(place.longitude),
		latitudeDir: place.latitude >= 0 ? 'north' : 'south',
		longitudeDir: place.longitude >= 0 ? 'east' : 'west'
	};
	if (state.timeRegime === 'auto' && place.timezone) {
		patch.timezone = place.timezone;
		patch.timezoneRegion = timeZoneRegion(place.timezone);
	}
	return patch;
}

/** Select a time-zone region; the zone moves to the region's first zone unless it is in it. */
export function withTimeZoneRegion(
	state: Pick<NewHoroscopeFormState, 'timezone'>,
	region: string
): Pick<NewHoroscopeFormState, 'timezone' | 'timezoneRegion'> {
	const timezone = timeZoneMatchesRegion(state.timezone, region)
		? state.timezone
		: (TIME_ZONES.find((candidate) => timeZoneMatchesRegion(candidate, region)) ?? state.timezone);
	return { timezone, timezoneRegion: region };
}

/** Switch the time system, carrying the same moment into the new system's field. Throws when the
 *  current entry cannot be converted (invalid input, or a wall time that is ambiguous there). */
export function withTimeSystem(
	state: NewHoroscopeFormState,
	next: NewHoroscopeTimeSystem
): Partial<NewHoroscopeFormState> {
	const current = state.timeSystem;
	const utcOffset = formUtcOffset(state);
	const gregorianWall = () =>
		current === 'julian_calendar'
			? julianCalendarDateToGregorianWallDate(state.julianCalendarDate, state.dateTime)
			: state.dateTime;

	if (next === 'julian_day') {
		const instant =
			current === 'julian_day'
				? new Date(julianDayToUtcIso(state.julianDay))
				: new Date(wallTimeToUtcIso(gregorianWall(), state.timezone, utcOffset));
		return { timeSystem: next, julianDay: utcDateToJulianDay(instant).toFixed(8) };
	}
	if (current === 'julian_day') {
		const instant = new Date(julianDayToUtcIso(state.julianDay));
		const zone = utcOffset ?? state.timezone;
		const dateTime =
			(zone && instantToWallDate(instant, zone)) || instantToWallDate(instant, 'UTC') || instant;
		return next === 'julian_calendar'
			? {
					timeSystem: next,
					dateTime,
					julianCalendarDate: gregorianWallDateToJulianCalendarDate(dateTime)
				}
			: { timeSystem: next, dateTime };
	}
	if (next === 'julian_calendar') {
		return {
			timeSystem: next,
			julianCalendarDate: gregorianWallDateToJulianCalendarDate(state.dateTime)
		};
	}
	if (current === 'julian_calendar') return { timeSystem: next, dateTime: gregorianWall() };
	return { timeSystem: next };
}
