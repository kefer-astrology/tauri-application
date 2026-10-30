import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsSectionId } from './settings-secondary-sidebar';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const SECTIONS: SettingsSectionId[] = [
	'jazyk_lokace',
	'system_domu',
	'pozorovane_objekty',
	'nastaveni_aspektu',
	'rozlozeni_symbolu',
	'rozlozeni_aplikace',
	'jan_kefer',
	'manual'
];

describe('SettingsView', () => {
	// Server rendering runs each section and its context lookups synchronously.
	it.each(SECTIONS)(
		'renders the %s section',
		async (section) => {
			const { AppearanceProvider } = await import('@/app/providers/appearance');
			const { WorkspaceProvider } = await import('@/app/providers/workspace');
			const { SettingsView } = await import('./settings-view');
			const html = renderToString(
				<AppearanceProvider>
					<WorkspaceProvider>
						<SettingsView section={section} />
					</WorkspaceProvider>
				</AppearanceProvider>
			);
			expect(html.length).toBeGreaterThan(100);
		},
		10_000
	);
});
