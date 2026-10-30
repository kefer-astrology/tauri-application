import { describe, expect, it } from 'vitest';
import { tagDefaultColor } from './chartTags';
import {
	chartTypeToKind,
	formUtcOffset,
	initialNewHoroscopeState,
	mergeTags,
	parseTags,
	signedCoordinate,
	supportedTimeSystem,
	withResolvedLocation,
	withTagRenamed,
	withTags,
	withTimeSystem,
	withTimeZoneRegion,
	type NewHoroscopeFormState
} from './newHoroscopeForm';
import { DEFAULT_WORKSPACE_DEFAULTS, type AppChart } from './tauri/chartPayload';
import { localDateToWallTime } from './time/zone';

const defaults = DEFAULT_WORKSPACE_DEFAULTS;

const chart = (overrides: Partial<AppChart> = {}): AppChart => ({
	id: 'jan',
	name: 'Jan',
	chartType: 'NATAL',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague, Czech Republic',
	latitude: 50.0875,
	longitude: -14.4214,
	timezone: 'Europe/Prague',
	timeRegime: 'auto',
	locationRegime: 'auto',
	tags: ['family'],
	tagColors: { family: '#111111' },
	...overrides
});

/** Wall-clock fields shown by a picker `Date`, `[y, m, d, h, min]` with a 1-based month. */
const shown = (date: Date) => {
	const wall = localDateToWallTime(date);
	return [wall.year, wall.month + 1, wall.day, wall.hour, wall.minute];
};

const editState = (overrides: Partial<AppChart> = {}) =>
	initialNewHoroscopeState({ chart: chart(overrides), defaults, workspaceTags: [] });

describe('initialNewHoroscopeState', () => {
	it('shows an edited chart in local time at its place', () => {
		const state = editState();
		expect(shown(state.dateTime)).toEqual([1984, 7, 14, 15, 30]);
		expect(state.julianDay).toBe('2445896.06250000');
		expect(state.julianCalendarDate).toBe('1984-07-01');
		expect(state).toMatchObject({
			name: 'Jan',
			chartKind: 'radix',
			timeSystem: 'gregorian',
			timezone: 'Europe/Prague',
			timezoneRegion: 'Europe',
			utcOffset: 'auto',
			location: 'Prague, Czech Republic',
			resolvedLocation: 'Prague, Czech Republic',
			latitude: '50.0875',
			longitude: '14.4214',
			latitudeDir: 'north',
			longitudeDir: 'west',
			tags: ['family'],
			rodenRating: ''
		});
	});

	it('uses the manual UTC offset as the chart zone', () => {
		const state = editState({ timeRegime: 'manual', utcOffset: 'UTC+03:00' });
		expect(shown(state.dateTime)).toEqual([1984, 7, 14, 16, 30]);
		expect(formUtcOffset(state)).toBe('UTC+03:00');
		expect(formUtcOffset({ ...state, timeRegime: 'auto' })).toBeUndefined();
	});

	it('infers regimes for charts that do not store them', () => {
		const state = editState({ timeRegime: undefined, locationRegime: undefined });
		expect(state.timeRegime).toBe('manual');
		expect(state.locationRegime).toBe('manual');
		const bare = editState({
			timeRegime: undefined,
			locationRegime: undefined,
			timezone: undefined,
			latitude: undefined
		});
		expect(bare).toMatchObject({
			timeRegime: 'auto',
			locationRegime: 'auto',
			timezone: 'Europe/Prague',
			latitude: '',
			resolvedLocation: ''
		});
	});

	it('starts a new chart now, in local time at the default place', () => {
		const state = initialNewHoroscopeState({
			defaults: { ...defaults, timezone: 'America/New_York' },
			workspaceTags: [{ name: 'family', color: '#222222' }],
			now: new Date('2026-01-10T17:00:00Z')
		});
		expect(shown(state.dateTime)).toEqual([2026, 1, 10, 12, 0]);
		expect(state).toMatchObject({
			name: '',
			chartKind: 'radix',
			timeRegime: 'auto',
			location: 'Prague',
			resolvedLocation: 'Prague',
			latitude: '50.0875',
			longitude: '14.4214',
			tags: [],
			tagColors: { family: '#222222' }
		});
	});

	it('takes catalog tag colors over the chart’s own', () => {
		const state = initialNewHoroscopeState({
			chart: chart(),
			defaults,
			workspaceTags: [{ name: 'family', color: '#333333' }, { name: 'plain' }]
		});
		expect(state.tagColors).toEqual({ family: '#333333' });
	});
});

describe('form helpers', () => {
	it('maps stored values to form choices', () => {
		expect(chartTypeToKind('EVENT')).toBe('event');
		expect(chartTypeToKind('HORARY')).toBe('horary');
		expect(chartTypeToKind('NATAL')).toBe('radix');
		expect(chartTypeToKind('SYNASTRY')).toBe('radix');
		expect(supportedTimeSystem('julian_day')).toBe('julian_day');
		expect(supportedTimeSystem('julian_calendar')).toBe('julian_calendar');
		expect(supportedTimeSystem(null)).toBe('gregorian');
	});

	it('signs coordinates by direction', () => {
		expect(signedCoordinate('-50.5', 'north', 'north')).toBe(50.5);
		expect(signedCoordinate('50.5', 'north', 'south')).toBe(-50.5);
		expect(signedCoordinate('14', 'east', 'west')).toBe(-14);
		expect(signedCoordinate(' ', 'east', 'east')).toBeNull();
		expect(signedCoordinate('abc', 'east', 'east')).toBeNull();
	});

	it('parses and merges tags', () => {
		expect(parseTags(' a, b\nc,, ')).toEqual(['a', 'b', 'c']);
		expect(mergeTags(['a', 'b'], ['b', 'c', 'c'])).toEqual(['a', 'b', 'c']);
	});
});

describe('tag transitions', () => {
	it('colors tags from the catalog, then current colors, then the palette', () => {
		const next = withTags(
			{ tagColors: { kept: '#444444', gone: '#555555' } },
			['kept', 'catalog', 'new', 'kept'],
			[{ name: 'catalog', color: '#666666' }]
		);
		expect(next).toEqual({
			tags: ['kept', 'catalog', 'new'],
			tagColors: { kept: '#444444', catalog: '#666666', new: tagDefaultColor(2) }
		});
	});

	it('renames a tag in place, keeping its color, and merges duplicates', () => {
		const state = { tags: ['a', 'b', 'c'], tagColors: { a: '#a', b: '#b', c: '#c' } };
		expect(withTagRenamed(state, 'b', ' x ')).toEqual({
			tags: ['a', 'x', 'c'],
			tagColors: { a: '#a', x: '#b', c: '#c' }
		});
		expect(withTagRenamed(state, 'b', 'c')).toEqual({
			tags: ['a', 'c'],
			tagColors: { a: '#a', c: '#c' }
		});
		expect(withTagRenamed(state, 'b', '  ')).toEqual(state);
	});
});

describe('location and zone transitions', () => {
	const place = { displayName: 'Lima, Peru', latitude: -12.0464, longitude: -77.0428 };

	it('applies a geocoded place, taking its zone only in the auto time regime', () => {
		expect(
			withResolvedLocation({ timeRegime: 'auto' }, { ...place, timezone: 'America/Lima' })
		).toEqual({
			location: 'Lima, Peru',
			resolvedLocation: 'Lima, Peru',
			latitude: '12.0464',
			longitude: '77.0428',
			latitudeDir: 'south',
			longitudeDir: 'west',
			timezone: 'America/Lima',
			timezoneRegion: 'America'
		});
		expect(
			withResolvedLocation({ timeRegime: 'manual' }, { ...place, timezone: 'America/Lima' })
		).not.toHaveProperty('timezone');
	});

	it('keeps the zone when it is in the chosen region, else takes the region’s first', () => {
		expect(withTimeZoneRegion({ timezone: 'Europe/Prague' }, 'Europe')).toEqual({
			timezone: 'Europe/Prague',
			timezoneRegion: 'Europe'
		});
		const moved = withTimeZoneRegion({ timezone: 'Europe/Prague' }, 'Asia');
		expect(moved.timezone.startsWith('Asia/')).toBe(true);
	});
});

describe('withTimeSystem', () => {
	const base = (): NewHoroscopeFormState => editState();
	const apply = (state: NewHoroscopeFormState, next: NewHoroscopeFormState['timeSystem']) => ({
		...state,
		...withTimeSystem(state, next)
	});

	it('carries the same moment through Julian Day and back', () => {
		const jd = apply(base(), 'julian_day');
		expect(jd.julianDay).toBe('2445896.06250000');
		const gregorian = apply({ ...jd, julianDay: '2451545.0' }, 'gregorian');
		// JD 2451545.0 is 2000-01-01 12:00 UTC, 13:00 in Prague.
		expect(shown(gregorian.dateTime)).toEqual([2000, 1, 1, 13, 0]);
		expect(gregorian.timeSystem).toBe('gregorian');
	});

	it('reads Julian Day in the manual UTC offset', () => {
		const state = { ...base(), timeRegime: 'manual' as const, utcOffset: 'UTC-05:00' };
		const back = apply(
			{ ...apply(state, 'julian_day'), julianDay: '2451545.0' },
			'julian_calendar'
		);
		expect(shown(back.dateTime)).toEqual([2000, 1, 1, 7, 0]);
		expect(back.julianCalendarDate).toBe('1999-12-19');
	});

	it('converts between the Gregorian and Julian calendars, keeping the time of day', () => {
		const julian = apply(base(), 'julian_calendar');
		expect(julian.julianCalendarDate).toBe('1984-07-01');
		const gregorian = apply({ ...julian, julianCalendarDate: '1582-10-05' }, 'gregorian');
		expect(shown(gregorian.dateTime)).toEqual([1582, 10, 15, 15, 30]);
	});

	it('rejects input it cannot convert', () => {
		expect(() =>
			withTimeSystem({ ...base(), timeSystem: 'julian_day', julianDay: 'x' }, 'gregorian')
		).toThrow(/finite/);
		expect(() =>
			withTimeSystem(
				{ ...base(), timeSystem: 'julian_calendar', julianCalendarDate: '1984-02-30' },
				'gregorian'
			)
		).toThrow(/Invalid/);
	});
});
