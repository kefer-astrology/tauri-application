import { act, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME_PALETTES } from '@/lib/themePalettes';
import { SettingsDraftContext } from '../settings-draft';
import { AppLayoutSection } from './app-layout-section';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/app/providers/appearance', () => ({
	useAppearance: () => ({ theme: 'noon', monochrome: false })
}));
vi.mock('@/app/components/form-field-theme', () => ({ useAppFormFieldTheme: () => ({}) }));
vi.mock('../settings-controls', () => ({
	SettingSelect: () => null,
	SettingsGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

function Harness({ selectedBackground }: { selectedBackground: string }) {
	const [paletteDraft, setPaletteDraft] = useState({
		...DEFAULT_THEME_PALETTES.noon,
		selectedBackground
	});
	return (
		<SettingsDraftContext.Provider
			value={{
				paletteDraft,
				setPaletteDraft,
				markChanged: () => {},
				elementDraft: {} as never,
				setElementDraft: () => {}
			}}
		>
			<AppLayoutSection />
			<output data-testid="selected-color">{paletteDraft.selectedBackground}</output>
		</SettingsDraftContext.Provider>
	);
}

describe('palette transparency controls', () => {
	it.each([
		['rgba(51,102,153,0.37)', 'rgba(51,102,153,0.37)', 2],
		['#336699', 'rgba(51,102,153,0.16)', 1]
	])('restores transparency for %s', async (initial, expected, clicks) => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		try {
			await act(async () => root.render(<Harness selectedBackground={initial} />));
			const toggle = container.querySelector<HTMLButtonElement>(
				'#settings-selectedBackground-transparency'
			)!;
			for (let click = 0; click < clicks; click++) {
				await act(async () => toggle.click());
				if (clicks === 2 && click === 0) {
					expect(container.querySelector('[data-testid="selected-color"]')?.textContent).toBe(
						'#336699'
					);
				}
			}
			expect(toggle.getAttribute('aria-checked')).toBe('true');
			expect(container.querySelector('[data-testid="selected-color"]')?.textContent).toBe(expected);
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	});
});
