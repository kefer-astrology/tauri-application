import { DEGREE_SYMBOL_SET_CATALOG, degreeSymbolText } from './degreeSymbolSets';
import type { Translate } from './objectLabels';

/** A per-degree symbolic interpretation system (Sabian, Sepharial, Charubel, Kefer's own — every
 *  catalogued, available set in `static/astrology-symbols/catalog.json`). Adding a system means
 *  dropping its `<id>.json` files and a catalog entry; no consuming component needs to change. */
export interface SymbolSystemDefinition {
	id: string;
	labelKey: string;
	textForLongitude: (longitude: number, language: string) => string | null | undefined;
}

export const SYMBOL_SYSTEMS: readonly SymbolSystemDefinition[] = DEGREE_SYMBOL_SET_CATALOG.filter(
	(entry) => entry.available
).map(
	(entry): SymbolSystemDefinition => ({
		id: entry.id,
		labelKey: entry.labelKey,
		textForLongitude: (longitude, language) => degreeSymbolText(entry.id, longitude, language)
	})
);

export interface SymbolEntry {
	systemId: string;
	label: string;
	text: string;
}

/** Every enabled symbol system's text for `longitude`, skipping systems with nothing to say for
 *  it. `enabledSetIds` is the user's setting (see `readStoredEnabledSymbolSetIds`) — a system not
 *  in that list is omitted even if registered above (this is how a user can turn off an available
 *  set in settings without it being ripped out of the registry). */
export function symbolEntriesForLongitude(
	longitude: number,
	language: string,
	t: Translate,
	enabledSetIds: readonly string[]
): SymbolEntry[] {
	return SYMBOL_SYSTEMS.filter((system) => enabledSetIds.includes(system.id)).flatMap((system) => {
		const text = system.textForLongitude(longitude, language);
		return text ? [{ systemId: system.id, label: t(system.labelKey), text }] : [];
	});
}

const ENABLED_SYMBOL_SETS_KEY = 'degree_symbol_sets_enabled';

/** Every catalogued set that currently has bundled data — the sensible default until the user
 *  picks their own selection in settings. */
export function defaultEnabledSymbolSetIds(): string[] {
	return DEGREE_SYMBOL_SET_CATALOG.filter((entry) => entry.available).map((entry) => entry.id);
}

export function readStoredEnabledSymbolSetIds(): string[] {
	try {
		const raw = localStorage.getItem(ENABLED_SYMBOL_SETS_KEY);
		if (!raw) return defaultEnabledSymbolSetIds();
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) return parsed;
	} catch {
		/* ignore */
	}
	return defaultEnabledSymbolSetIds();
}

export function persistEnabledSymbolSetIds(ids: readonly string[]) {
	try {
		localStorage.setItem(ENABLED_SYMBOL_SETS_KEY, JSON.stringify(ids));
	} catch {
		/* ignore */
	}
}
