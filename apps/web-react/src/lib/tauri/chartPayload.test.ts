import { describe, expect, it } from 'vitest';
import { wallTimeToUtcIso } from './chartPayload';

// The form's wall-clock fields arrive as a `Date` whose local fields are the entered time.
const entered = (y: number, m: number, d: number, h: number, mi = 0) =>
	new Date(y, m - 1, d, h, mi, 0);

describe('wallTimeToUtcIso', () => {
	it('converts entered wall time at the place to UTC', () => {
		expect(wallTimeToUtcIso(entered(1984, 7, 14, 15, 30), 'Europe/Prague')).toBe(
			'1984-07-14T13:30:00.000Z'
		);
		expect(wallTimeToUtcIso(entered(1984, 7, 14, 15, 30), 'Europe/Prague', 'UTC+03:00')).toBe(
			'1984-07-14T12:30:00.000Z'
		);
	});

	it('rejects local times that do not exist or occur twice', () => {
		const gap = entered(2024, 3, 31, 2, 30);
		if (gap.getHours() === 2) {
			expect(() => wallTimeToUtcIso(gap, 'Europe/Prague')).toThrow(/does not exist/);
		} else {
			// On a machine in a zone with the same gap, `Date` itself already moved 02:30 to 03:30.
			expect(wallTimeToUtcIso(gap, 'Europe/Prague')).toBe('2024-03-31T01:30:00.000Z');
		}
		expect(() => wallTimeToUtcIso(entered(2024, 10, 27, 2, 30), 'Europe/Prague')).toThrow(/twice/);
		expect(() => wallTimeToUtcIso(entered(2024, 1, 1, 0), 'Europe/Prague', 'UTC+99')).toThrow(
			/offset/
		);
	});
});
