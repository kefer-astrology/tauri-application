import { sabianSymbolForLongitude } from './sabianSymbols';
import type { Translate } from './objectLabels';

/** A per-degree symbolic interpretation system (Sabian, and — once their degree data exists —
 *  others such as Kefer's own or Sepharial's). Adding a system means adding one entry here; no
 *  consuming component needs to change. */
export interface SymbolSystemDefinition {
	id: string;
	labelKey: string;
	textForLongitude: (longitude: number, language: string) => string | null | undefined;
}

export const SYMBOL_SYSTEMS: readonly SymbolSystemDefinition[] = [
	{
		id: 'sabian',
		labelKey: 'detail_sabian_symbol',
		textForLongitude: (longitude, language) => sabianSymbolForLongitude(longitude, language)
	}
];

export interface SymbolEntry {
	systemId: string;
	label: string;
	text: string;
}

/** Every symbol system's text for `longitude`, skipping systems with nothing to say for it. */
export function symbolEntriesForLongitude(
	longitude: number,
	language: string,
	t: Translate
): SymbolEntry[] {
	return SYMBOL_SYSTEMS.flatMap((system) => {
		const text = system.textForLongitude(longitude, language);
		return text ? [{ systemId: system.id, label: t(system.labelKey), text }] : [];
	});
}
