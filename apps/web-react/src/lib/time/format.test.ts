import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './format';

const instant = new Date(Date.UTC(1984, 6, 14, 13, 30, 5));

describe('time format', () => {
	it('uses the given locale', () => {
		expect(
			formatDate(
				instant,
				{ timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' },
				'en-GB'
			)
		).toBe('14/07/1984');
	});

	it('omits seconds on request', () => {
		const withSeconds = formatTime(instant, {}, 'en-GB');
		const withoutSeconds = formatTime(instant, { seconds: false }, 'en-GB');
		expect(withSeconds.split(':')).toHaveLength(3);
		expect(withoutSeconds.split(':')).toHaveLength(2);
	});

	it('returns unparseable input unchanged', () => {
		expect(formatDateTime('not a date')).toBe('not a date');
	});
});
