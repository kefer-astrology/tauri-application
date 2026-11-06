import { describe, expect, it } from 'vitest';
import { ASTROLOGY_SCHOOLS, DEFAULT_SCHOOL, effectiveSchool, isSchoolEnabled } from './schools';

describe('astrological schools', () => {
	it('offers modern western and medieval / traditional, the rest disabled', () => {
		expect(ASTROLOGY_SCHOOLS.filter((s) => s.enabled).map((s) => s.id)).toEqual([
			'modern_western',
			'medieval_traditional'
		]);
		expect(ASTROLOGY_SCHOOLS).toHaveLength(7);
		expect(isSchoolEnabled('hellenistic')).toBe(false);
	});

	it('falls back to the default school without an available one', () => {
		expect(DEFAULT_SCHOOL).toBe('modern_western');
		expect(effectiveSchool('medieval_traditional')).toBe('medieval_traditional');
		expect(effectiveSchool('cosmobiology')).toBe('modern_western');
		expect(effectiveSchool(null)).toBe('modern_western');
		expect(effectiveSchool(undefined)).toBe('modern_western');
	});
});
