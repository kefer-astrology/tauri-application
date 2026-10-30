import { describe, expect, it } from 'vitest';
import {
	instantToWallDate,
	instantToZonedParts,
	localDateToWallTime,
	wallTimeToInstant,
	wallTimeToLocalDate,
	zoneOffsetMs
} from './zone';

const wall = (y: number, m: number, d: number, h: number, mi = 0, s = 0) => ({
	year: y,
	month: m - 1,
	day: d,
	hour: h,
	minute: mi,
	second: s
});

describe('zone', () => {
	it('knows IANA offsets including DST, and fixed offsets', () => {
		expect(zoneOffsetMs('Europe/Prague', new Date('1984-07-14T12:00:00Z'))).toBe(2 * 3_600_000);
		expect(zoneOffsetMs('Europe/Prague', new Date('1984-01-14T12:00:00Z'))).toBe(3_600_000);
		expect(zoneOffsetMs('UTC-03:30', new Date())).toBe(-3.5 * 3_600_000);
		expect(zoneOffsetMs('Not/AZone', new Date())).toBeNull();
	});

	it('converts wall time at a place to the instant and back', () => {
		const instant = wallTimeToInstant(wall(1984, 7, 14, 15, 30), 'Europe/Prague');
		expect(instant?.toISOString()).toBe('1984-07-14T13:30:00.000Z');
		expect(instantToZonedParts(instant!, 'Europe/Prague')).toEqual(wall(1984, 7, 14, 15, 30));
		expect(wallTimeToInstant(wall(2000, 1, 1, 0), 'America/Sao_Paulo')?.toISOString()).toBe(
			'2000-01-01T02:00:00.000Z'
		);
		expect(wallTimeToInstant(wall(2000, 1, 1, 0), 'UTC+05:45')?.toISOString()).toBe(
			'1999-12-31T18:15:00.000Z'
		);
	});

	it('resolves DST gaps and overlaps without failing', () => {
		// 02:30 does not exist in Prague on 2024-03-31; 02:30 on 2024-10-27 occurs twice.
		expect(wallTimeToInstant(wall(2024, 3, 31, 2, 30), 'Europe/Prague')).not.toBeNull();
		expect(wallTimeToInstant(wall(2024, 10, 27, 2, 30), 'Europe/Prague')).not.toBeNull();
	});

	it('carries wall time in a picker Date, whatever the machine zone', () => {
		const date = wallTimeToLocalDate(wall(1984, 7, 14, 15, 30, 5));
		expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
			1984, 6, 14, 15
		]);
		expect(localDateToWallTime(date)).toEqual(wall(1984, 7, 14, 15, 30, 5));
		// Two-digit years are real years, not 19xx.
		expect(localDateToWallTime(wallTimeToLocalDate(wall(45, 3, 15, 12)))).toEqual(
			wall(45, 3, 15, 12)
		);
	});

	it('shows an instant as a picker Date in the zone', () => {
		const instant = new Date('1984-07-14T13:30:00Z');
		expect(localDateToWallTime(instantToWallDate(instant, 'Europe/Prague')!)).toEqual(
			wall(1984, 7, 14, 15, 30)
		);
		expect(localDateToWallTime(instantToWallDate(instant, 'UTC-03:00')!)).toEqual(
			wall(1984, 7, 14, 10, 30)
		);
		expect(instantToWallDate(instant, 'Not/AZone')).toBeNull();
	});
});
