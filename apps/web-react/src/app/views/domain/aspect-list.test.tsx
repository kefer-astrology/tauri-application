import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { setAspectDefinitions } from '@/lib/astrology/aspects';
import type { AspectDefinitionDto } from '@/lib/tauri/types';
import { AspectList } from './aspect-list';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key
	})
}));

const definitions: AspectDefinitionDto[] = [
	{
		enabled: true,
		default_orb: 1,
		id: 'conjunction',
		angle: 0,
		harmonic: 1,
		type: 'major',
		glyph: 'Conjunction',
		i18n: { en: 'Conjunction' }
	},
	{
		enabled: true,
		default_orb: 1,
		id: 'octile',
		angle: 45,
		harmonic: 8,
		type: 'minor',
		glyph: 'Octile',
		i18n: { en: 'Octile' }
	},
	{
		enabled: true,
		default_orb: 1,
		id: 'undecile',
		angle: 360 / 11,
		harmonic: 11,
		type: 'minor',
		glyph: 'Undecile',
		i18n: { en: 'Undecile' }
	}
];

describe('aspect selection glyph column', () => {
	it.each(['default', 'modern'] as const)(
		'renders %s SVG glyphs before names after the runtime catalog loads',
		(glyphSet) => {
			setAspectDefinitions(definitions);
			const html = renderToString(
				<AppThemeProvider theme="noon" glyphSet={glyphSet}>
					<AspectList selectedIds={[]} onSelectedIdsChange={() => {}} />
				</AppThemeProvider>
			);
			expect(html).toContain(`glyphs/${glyphSet}/aspects/conjunction.svg`);
			expect(html).toContain(`glyphs/${glyphSet}/aspects/semisquare.svg`);
			expect(html).not.toContain('/aspects/octile.svg');
			expect(html).not.toContain('/aspects/undecile.svg');
			expect(html.indexOf('/aspects/conjunction.svg')).toBeLessThan(html.indexOf('Conjunction'));
			// Aspects without a bundled asset use a short symbol fallback, not a repeated name.
			expect(html).toContain('>Und<');
			expect(html.match(/>Undecile</g)).toHaveLength(1);
		}
	);
});
