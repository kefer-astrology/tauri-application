import { describe, expect, it } from 'vitest';
import eventTimeContract from '../../../../contracts/event-time.json';
import { addUtcStep, formatChartDateTimeUtc, parseChartDateTime } from './chartDateTime';

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
