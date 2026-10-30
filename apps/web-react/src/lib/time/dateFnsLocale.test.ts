import { describe, expect, it } from 'vitest';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { dateFnsLocale } from './dateFnsLocale';

describe('dateFnsLocale', () => {
	it('maps app languages, with English as the fallback', () => {
		expect(dateFnsLocale('cs')).toBe(cs);
		expect(dateFnsLocale('cs-CZ')).toBe(cs);
		expect(dateFnsLocale('FR')).toBe(fr);
		expect(dateFnsLocale('es')).toBe(es);
		expect(dateFnsLocale('de')).toBe(enUS);
		expect(dateFnsLocale('')).toBe(enUS);
	});
});
