import type { Locale } from 'date-fns';
import { cs, enUS, es, fr } from 'date-fns/locale';

/** The `date-fns` locale for an app language (`cs`, `cs-CZ`, …); English when unsupported. */
export function dateFnsLocale(language: string): Locale {
	const base = language.split('-')[0]?.toLowerCase();
	if (base === 'cs') return cs;
	if (base === 'fr') return fr;
	if (base === 'es') return es;
	return enUS;
}
