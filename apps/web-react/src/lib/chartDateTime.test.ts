import { describe, expect, it } from 'vitest';
import eventTimeContract from '../../../../contracts/event-time.json';
import {
	addUtcStep,
	chartLocalParts,
	chartTimeZone,
	formatChartDateTimeUtc,
	parseChartDateTime,
	splitChartDateTime,
	toEventTimeIso
} from './chartDateTime';

describe('parseChartDateTime', () => {
	// The same fixture the Rust `parse_event_time` tests run against, so both stay identical.
	it.each(eventTimeContract.accepted)('accepts $input as $utc', ({ input, utc }) => {
		expect(parseChartDateTime(input)?.getTime()).toBe(new Date(utc).getTime());
	});

	it.each(eventTimeContract.rejected)('rejects %j', (input) => {
		expect(parseChartDateTime(input)).toBeNull();
	});

	it('reads every naive form as UTC, whatever the engine or local zone', () => {
		expect(parseChartDateTime('1984-07-14 15:30')?.toISOString()).toBe('1984-07-14T15:30:00.000Z');
		expect(parseChartDateTime('1984-07-14T15:30:00')?.toISOString()).toBe(
			'1984-07-14T15:30:00.000Z'
		);
		// Not a backend format (seconds are required with `T`).
		expect(parseChartDateTime('1984-07-14T15:30')).toBeNull();
	});

	it('keeps fractional seconds and negative offsets', () => {
		expect(parseChartDateTime('1984-07-14T15:30:00.250-03:30')?.toISOString()).toBe(
			'1984-07-14T19:00:00.250Z'
		);
	});
});

describe('local time at the event place', () => {
	it('reads naive times as wall time in the chart zone; offsets still win', () => {
		expect(parseChartDateTime('1984-07-14 15:30', 'Europe/Prague')?.toISOString()).toBe(
			'1984-07-14T13:30:00.000Z'
		);
		expect(parseChartDateTime('1984-07-14T15:30:00Z', 'Europe/Prague')?.toISOString()).toBe(
			'1984-07-14T15:30:00.000Z'
		);
		// An unknown zone falls back to the backend reading (UTC).
		expect(parseChartDateTime('1984-07-14 15:30', 'Not/AZone')?.toISOString()).toBe(
			'1984-07-14T15:30:00.000Z'
		);
	});

	it('sends exact instants to the backend', () => {
		expect(toEventTimeIso('1984-07-14 15:30:00', 'Europe/Prague')).toBe('1984-07-14T13:30:00Z');
		expect(toEventTimeIso('2026-10-30T10:00:00+01:00', 'Asia/Tokyo')).toBe('2026-10-30T09:00:00Z');
		expect(toEventTimeIso('', 'Europe/Prague')).toBeNull();
		expect(toEventTimeIso('01/02/2024', 'Europe/Prague')).toBe('01/02/2024');
	});

	it('shows and compares times in the chart zone, whatever the platform zone', () => {
		const tokyo = chartLocalParts('1984-07-14T16:30:00Z', 'Asia/Tokyo');
		expect(tokyo).toMatchObject({ year: 1984, month: 6, day: 15, hour: 1, minute: 30 });
		expect(splitChartDateTime('1984-07-14T13:30:00Z', 'Europe/Prague').time).toMatch(/15.30/);
	});

	it('uses a manual UTC offset only in the manual time regime', () => {
		expect(
			chartTimeZone({ timezone: 'Europe/Prague', utcOffset: 'UTC+03:00', timeRegime: 'manual' })
		).toBe('UTC+03:00');
		expect(
			chartTimeZone({ timezone: 'Europe/Prague', utcOffset: 'UTC+03:00', timeRegime: 'auto' })
		).toBe('Europe/Prague');
		expect(
			chartTimeZone({ timezone: '', utcOffset: 'auto', timeRegime: 'manual' })
		).toBeUndefined();
	});
});

describe('addUtcStep', () => {
	it('steps in UTC calendar units, including month ends', () => {
		const base = new Date('2024-01-31T12:00:00Z');
		expect(formatChartDateTimeUtc(addUtcStep(base, { unit: 'hr', amount: 13 }))).toBe(
			'2024-02-01T01:00:00Z'
		);
		expect(formatChartDateTimeUtc(addUtcStep(base, { unit: 'yr', amount: -1 }))).toBe(
			'2023-01-31T12:00:00Z'
		);
		expect(formatChartDateTimeUtc(addUtcStep(base, { unit: 'sec', amount: 61 }))).toBe(
			'2024-01-31T12:01:01Z'
		);
	});
});
