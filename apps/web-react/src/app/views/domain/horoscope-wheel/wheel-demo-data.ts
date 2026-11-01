/** Demo radix shown when a wheel has no computed data (`useFallbackData`). */

export const DEFAULT_WHEEL_BODY_ORDER: readonly string[] = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

/** Demo body longitudes (°). */
export const DEFAULT_BODY_LONGITUDE: Record<string, number> = {
	sun: 240 + 9 + 47 / 60,
	moon: 30 + 18 + 23 / 60,
	mercury: 240 + 2 + 15 / 60,
	venus: 210 + 26 + 8 / 60,
	mars: 0 + 14 + 42 / 60,
	jupiter: 330 + 21 + 56 / 60,
	saturn: 270 + 28 + 31 / 60,
	uranus: 60 + 11 + 19 / 60,
	neptune: 270 + 7 + 4 / 60,
	pluto: 210 + 8 + 51 / 60
};

/** Demo axes (°): ASC Scorpio 14°28', MC Cancer 29°13'. */
export const HOROSCOPE_WHEEL_AXIS = {
	asc: 210 + 14 + 28 / 60,
	dsc: 30 + 14 + 28 / 60,
	mc: 90 + 29 + 13 / 60,
	ic: 270 + 29 + 13 / 60
};
