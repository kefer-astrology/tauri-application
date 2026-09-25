import catalogJson from '@static/astrology-symbols/catalog.json';
import charubelEn from '@static/astrology-symbols/charubel.json';
import charubelCs from '@static/astrology-symbols/charubel.cs.json';
import charubelFr from '@static/astrology-symbols/charubel.fr.json';
import charubelEs from '@static/astrology-symbols/charubel.es.json';
import sepharialEn from '@static/astrology-symbols/sepharial.json';
import sepharialCs from '@static/astrology-symbols/sepharial.cs.json';
import sepharialFr from '@static/astrology-symbols/sepharial.fr.json';
import sepharialEs from '@static/astrology-symbols/sepharial.es.json';
import type { AppLanguage } from '@/lib/i18n';

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

/** Sets with bundled 360-entry data, keyed by catalog id then by UI language. Add a new set by
 *  dropping its `<id>.json` (English) and `<id>.<lang>.json` files in `static/astrology-symbols/`,
 *  adding a catalog entry, and registering it here. A language with no file for a set falls back
 *  to that set's English text. */
const DEGREE_SYMBOL_DATA: Readonly<
	Record<string, Partial<Record<AppLanguage, readonly string[]>>>
> = {
	sepharial: { en: sepharialEn, cs: sepharialCs, fr: sepharialFr, es: sepharialEs },
	charubel: { en: charubelEn, cs: charubelCs, fr: charubelFr, es: charubelEs }
};

function normalizeLongitude(longitude: number): number {
	return ((longitude % 360) + 360) % 360;
}

/** `setId`'s text for the zodiacal degree currently occupied by `longitude`, in `language`
 *  (falling back to English), or `undefined` if that set has no bundled data at all (not yet
 *  available, or an unknown id). */
export function degreeSymbolText(
	setId: string,
	longitude: number,
	language: string
): string | undefined {
	const degree = Math.floor(normalizeLongitude(longitude));
	const bySet = DEGREE_SYMBOL_DATA[setId];
	if (!bySet) return undefined;
	const lang = language.split('-')[0] as AppLanguage;
	return (bySet[lang] ?? bySet.en)?.[degree];
}
