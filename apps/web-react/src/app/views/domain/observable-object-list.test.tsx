import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { ObservableObjectList } from './observable-object-list';
import { setObservableObjectCatalog } from '@/lib/astrology/observableObjects';
import type { DomainCatalogDto } from '@/lib/tauri/types';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key
	})
}));

it('allows supported fixed stars to be selected from the star catalog', async () => {
	setObservableObjectCatalog({
		model: {
			body_definitions: [
				{
					id: 'star_sirius',
					enabled: true,
					glyph: '✦',
					formula: 'star_sirius',
					i18n: { en: 'Sirius' },
					object_type: 'fixed_star',
					computation_map: { jpl: 'star_sirius' }
				}
			]
		}
	} as unknown as DomainCatalogDto);
	const selected = vi.fn();
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<AppThemeProvider theme="midnight" glyphSet="default">
					<ObservableObjectList selectedIds={[]} onSelectedIdsChange={selected} />
				</AppThemeProvider>
			)
		);
		const group = [...container.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Fixed Stars')
		)!;
		await act(async () => group.click());
		const checkbox = container.querySelector<HTMLButtonElement>(
			'[role="checkbox"][aria-label="Sirius"]'
		)!;
		expect(checkbox).not.toBeNull();
		expect(checkbox.disabled).toBe(false);
		await act(async () => checkbox.click());
		expect(selected).toHaveBeenCalledWith(['star_sirius']);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
