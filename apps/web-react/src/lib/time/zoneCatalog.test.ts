import { describe, expect, it } from 'vitest';
import { fixedUtcOffsetMilliseconds } from './zone';
import {
	formatUtcOffset,
	TIME_ZONE_REGIONS,
	TIME_ZONES,
	timeZoneMatchesRegion,
	timeZoneRegion,
	timeZonesInRegion,
	UTC_OFFSET_OPTIONS
} from './zoneCatalog';

describe('zoneCatalog', () => {
	it('lists zones and their regions', () => {
		expect(TIME_ZONES).toContain('Europe/Prague');
		expect(TIME_ZONES).toContain('UTC');
		expect(TIME_ZONE_REGIONS).toEqual(expect.arrayContaining(['America', 'Europe', 'UTC']));
		expect(timeZoneRegion('Europe/Prague')).toBe('Europe');
		expect(timeZoneRegion('')).toBe(TIME_ZONE_REGIONS[0]);
		expect(timeZoneMatchesRegion('UTC', 'UTC')).toBe(true);
		expect(timeZoneMatchesRegion('Europe/Prague', 'Euro')).toBe(false);
		const europe = timeZonesInRegion('Europe');
		expect(europe).toContain('Europe/Prague');
		expect(europe.every((zone) => zone.startsWith('Europe/'))).toBe(true);
	});

	it('offers fixed offsets in 15-minute steps that the zone math accepts', () => {
		expect(formatUtcOffset(345)).toBe('UTC+05:45');
		expect(formatUtcOffset(-210)).toBe('UTC-03:30');
		expect(formatUtcOffset(0)).toBe('UTC+00:00');
		expect(UTC_OFFSET_OPTIONS).toHaveLength(113);
		expect(UTC_OFFSET_OPTIONS[0]).toBe('UTC-14:00');
		expect(UTC_OFFSET_OPTIONS.at(-1)).toBe('UTC+14:00');
		for (const offset of UTC_OFFSET_OPTIONS) {
			expect(fixedUtcOffsetMilliseconds(offset)).not.toBeNull();
		}
	});
});
