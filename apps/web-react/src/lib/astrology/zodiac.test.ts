import { describe, expect, it } from 'vitest';
import { degreeOrdinalInSign, signIndexOf, signPosition } from './zodiac';

describe('zodiac', () => {
	it('maps longitudes to signs, including negative and ≥360°', () => {
		expect(signIndexOf(0)).toBe(0);
		expect(signIndexOf(29.999)).toBe(0);
		expect(signIndexOf(30)).toBe(1);
		expect(signIndexOf(-1)).toBe(11);
		expect(signIndexOf(725)).toBe(0);
	});

	it('numbers degrees within a sign from 1', () => {
		expect(degreeOrdinalInSign(0)).toBe(1);
		expect(degreeOrdinalInSign(45.5)).toBe(16);
	});

	it('carries seconds rounding into the next sign', () => {
		const position = signPosition(29 + 59 / 60 + 59.7 / 3600);
		// Sign ids come from the runtime domain catalog, so assert on the index and glyph here.
		expect(position).toMatchObject({
			signIndex: 1,
			signGlyphFallback: '♉',
			degrees: 0,
			minutes: 0
		});
	});

	it('splits degrees, minutes and seconds', () => {
		expect(signPosition(130.5 + 15 / 3600)).toMatchObject({
			signIndex: 4,
			degrees: 10,
			minutes: 30,
			seconds: 15,
			signGlyphFallback: '♌'
		});
		expect(signPosition(130.508, 'minutes')).toMatchObject({
			degrees: 10,
			minutes: 30,
			seconds: 0
		});
	});
});
