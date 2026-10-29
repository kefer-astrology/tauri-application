import { describe, expect, it } from 'vitest';
import { addUtcStep, formatChartDateTimeUtc, parseChartDateTimeUtc } from './chartDateTime';

describe('chart date-time helpers', () => {
	it('keeps ISO offsets and rejects empty or invalid input', () => {
		expect(parseChartDateTimeUtc('1984-07-14T15:30:00Z')?.toISOString()).toBe(
			'1984-07-14T15:30:00.000Z'
		);
		expect(parseChartDateTimeUtc('1984-07-14T15:30:00+02:00')?.toISOString()).toBe(
			'1984-07-14T13:30:00.000Z'
		);
		expect(parseChartDateTimeUtc('')).toBeNull();
		expect(parseChartDateTimeUtc('not a date')).toBeNull();
	});

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
