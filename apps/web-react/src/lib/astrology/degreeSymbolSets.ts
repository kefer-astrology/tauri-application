import catalogJson from '@static/astrology-symbols/catalog.json';
import charubelJson from '@static/astrology-symbols/charubel.json';
import sepharialJson from '@static/astrology-symbols/sepharial.json';

/** One entry in the shared `static/astrology-symbols/catalog.json` — see that folder's README
 *  for sourcing/attribution/license notes per set. `available` is false for sets that are
 *  catalogued (so they can appear, disabled, in settings) but have no bundled text yet, either
 *  because the content doesn't exist (Kefer) or its license isn't resolved (Sabian). */
export interface DegreeSymbolSetCatalogEntry {
	id: string;
	labelKey: string;
	available: boolean;
	source?: string;
	license?: string;
	licenseNote?: string;
}

export const DEGREE_SYMBOL_SET_CATALOG: readonly DegreeSymbolSetCatalogEntry[] = catalogJson.sets;

/** Sets with bundled 360-entry data, keyed by catalog id. Add a new set by dropping its JSON
 *  file in `static/astrology-symbols/`, adding a catalog entry, and registering it here. */
const DEGREE_SYMBOL_DATA: Readonly<Record<string, readonly string[]>> = {
	sepharial: sepharialJson,
	charubel: charubelJson
};

function normalizeLongitude(longitude: number): number {
	return ((longitude % 360) + 360) % 360;
}

/** `setId`'s text for the zodiacal degree currently occupied by `longitude`, or `undefined` if
 *  that set has no bundled data (not yet available, or an unknown id). */
export function degreeSymbolText(setId: string, longitude: number): string | undefined {
	const degree = Math.floor(normalizeLongitude(longitude));
	return DEGREE_SYMBOL_DATA[setId]?.[degree];
}
