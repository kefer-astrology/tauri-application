const ASSET_BASE_URL = import.meta.env.BASE_URL;

export type AstrologyGlyphSetId = 'default' | 'modern';

export const GLYPH_SET_KEY = 'glyph_set';

const fileBackedIds = new Set([
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
]);

/** Zodiac wheel order starting at 0° Aries (sign index 0). */
export const ZODIAC_IDS = [
	'aries',
	'taurus',
	'gemini',
	'cancer',
	'leo',
	'virgo',
	'libra',
	'scorpio',
	'sagittarius',
	'capricorn',
	'aquarius',
	'pisces'
] as const;

const zodiacIdSet = new Set<string>(ZODIAC_IDS);

export type ZodiacId = (typeof ZODIAC_IDS)[number];

export function signIndexToZodiacId(signIndex: number): ZodiacId {
	const i = ((Math.floor(signIndex) % 12) + 12) % 12;
	return ZODIAC_IDS[i]!;
}

const glyphAliasMap: Record<string, string> = {
	ascendant: 'asc',
	descendant: 'desc',
	truenode: 'north_node',
	meannode: 'north_node',
	mean_node: 'north_node',
	true_node: 'north_node',
	true_north_node: 'north_node',
	true_south_node: 'south_node',
	black_moon: 'lilith'
};

export function readStoredGlyphSet(): AstrologyGlyphSetId {
	try {
		const value = localStorage.getItem(GLYPH_SET_KEY);
		if (value === 'default' || value === 'modern') return value;
		if (value === 'kerykeion' || value === 'classic') return 'modern';
	} catch {
		/* ignore */
	}
	return 'default';
}

export function persistGlyphSet(value: AstrologyGlyphSetId) {
	try {
		localStorage.setItem(GLYPH_SET_KEY, value);
	} catch {
		/* ignore */
	}
}

function assetUrl(relativePath: string): string {
	const normalizedBase = ASSET_BASE_URL.endsWith('/') ? ASSET_BASE_URL : `${ASSET_BASE_URL}/`;
	return `${normalizedBase}${relativePath.replace(/^\/+/, '')}`;
}

export function normalizeGlyphId(id: string): string {
	const normalized = String(id ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_');
	return glyphAliasMap[normalized] ?? normalized;
}

export function getAstrologyGlyphSrc(
	setId: AstrologyGlyphSetId,
	id: string
): string | null {
	const normalizedId = normalizeGlyphId(id);
	if (!fileBackedIds.has(normalizedId)) return null;
	return assetUrl(`glyphs/${setId}/planets/${normalizedId}.svg`);
}

export function getZodiacGlyphSrc(
	setId: AstrologyGlyphSetId,
	zodiacId: string
): string | null {
	const normalized = String(zodiacId ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_');
	if (!zodiacIdSet.has(normalized)) return null;
	return assetUrl(`glyphs/${setId}/zodiac/${normalized}.svg`);
}
