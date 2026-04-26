export type ElementId = 'fire' | 'earth' | 'air' | 'water';

export type ElementColors = Record<ElementId, string>;

const STORAGE_KEY = 'element_wheel_colors';

/** Default wheel zodiac tones (fire / earth / air / water). */
export const DEFAULT_ELEMENT_COLORS: ElementColors = {
	fire: '#b91c1c',
	earth: '#713f12',
	air: '#1e40af',
	water: '#0f766e'
};

/** Zodiac sign id → classical element (sign index 0 = Aries = fire, …). */
export const ZODIAC_ID_ELEMENT: Record<string, ElementId> = {
	aries: 'fire',
	taurus: 'earth',
	gemini: 'air',
	cancer: 'water',
	leo: 'fire',
	virgo: 'earth',
	libra: 'air',
	scorpio: 'water',
	sagittarius: 'fire',
	capricorn: 'earth',
	aquarius: 'air',
	pisces: 'water'
};

export function elementForZodiacId(zodiacId: string): ElementId {
	return ZODIAC_ID_ELEMENT[zodiacId] ?? 'fire';
}

function isHexColor(s: string): boolean {
	return /^#[0-9A-Fa-f]{6}$/.test(s.trim());
}

function mergeWithDefaults(partial: Partial<ElementColors> | null | undefined): ElementColors {
	return {
		fire: partial?.fire && isHexColor(partial.fire) ? partial.fire : DEFAULT_ELEMENT_COLORS.fire,
		earth: partial?.earth && isHexColor(partial.earth) ? partial.earth : DEFAULT_ELEMENT_COLORS.earth,
		air: partial?.air && isHexColor(partial.air) ? partial.air : DEFAULT_ELEMENT_COLORS.air,
		water: partial?.water && isHexColor(partial.water) ? partial.water : DEFAULT_ELEMENT_COLORS.water
	};
}

export function readStoredElementColors(): ElementColors {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_ELEMENT_COLORS };
		const parsed = JSON.parse(raw) as Partial<ElementColors>;
		return mergeWithDefaults(parsed);
	} catch {
		return { ...DEFAULT_ELEMENT_COLORS };
	}
}

export function persistElementColors(colors: ElementColors) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeWithDefaults(colors)));
	} catch {
		/* ignore */
	}
}

/** Dark wheel background: mix user element color toward white for contrast. */
export function wheelZodiacFillOnDark(elementHex: string): string {
	return `color-mix(in srgb, ${elementHex} 74%, white)`;
}
