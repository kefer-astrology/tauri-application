import { signIndexToZodiacId, type ZodiacId } from './glyphs';

/** Text fallbacks for the twelve sign glyphs, Aries … Pisces. */
export const ZODIAC_UNICODE_GLYPHS = [
	'♈',
	'♉',
	'♊',
	'♋',
	'♌',
	'♍',
	'♎',
	'♏',
	'♐',
	'♑',
	'♒',
	'♓'
] as const;

export function normalizeDegrees(longitude: number): number {
	return ((longitude % 360) + 360) % 360;
}

/** 0 = Aries … 11 = Pisces. */
export function signIndexOf(longitude: number): number {
	return Math.floor(normalizeDegrees(longitude) / 30) % 12;
}

/** 1-based degree within the sign (1st … 30th degree), as used by degree filters. */
export function degreeOrdinalInSign(longitude: number): number {
	return Math.floor(normalizeDegrees(longitude) % 30) + 1;
}

export interface SignPosition {
	signIndex: number;
	signZodiacId: ZodiacId;
	signGlyphFallback: string;
	degrees: number;
	minutes: number;
	/** Always 0 at `precision: 'minutes'`. */
	seconds: number;
}

/**
 * Sign and degrees/minutes(/seconds) within the sign. Rounding happens on the whole longitude,
 * so 29°59′59.7″ Aries reads as 0°00′00″ Taurus rather than 0° Aries.
 */
export function signPosition(
	longitude: number,
	precision: 'seconds' | 'minutes' = 'seconds'
): SignPosition {
	const unitsPerDegree = precision === 'seconds' ? 3600 : 60;
	const total = Math.round(normalizeDegrees(longitude) * unitsPerDegree) % (360 * unitsPerDegree);
	const signIndex = Math.floor(total / (30 * unitsPerDegree));
	const withinSign = total % (30 * unitsPerDegree);
	const degrees = Math.floor(withinSign / unitsPerDegree);
	const remainder = withinSign % unitsPerDegree;
	return {
		signIndex,
		signZodiacId: signIndexToZodiacId(signIndex),
		signGlyphFallback: ZODIAC_UNICODE_GLYPHS[signIndex]!,
		degrees,
		minutes: precision === 'seconds' ? Math.floor(remainder / 60) : remainder,
		seconds: precision === 'seconds' ? remainder % 60 : 0
	};
}
