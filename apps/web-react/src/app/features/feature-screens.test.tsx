import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

async function withProviders(children: ReactNode) {
	const { AppearanceProvider } = await import('@/app/providers/appearance');
	const { WorkspaceProvider } = await import('@/app/providers/workspace');
	return renderToString(
		<AppearanceProvider>
			<WorkspaceProvider>{children}</WorkspaceProvider>
		</AppearanceProvider>
	);
}

// Server rendering runs each screen and its context lookups synchronously.
describe('feature screens', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	it('renders synastry', async () => {
		const { SynastryView } = await import('./synastry/synastry-view');
		const html = await withProviders(<SynastryView />);
		expect(html).toContain('id="synastry-name"');
		expect(html).toContain('person-a');
	}, 10_000);

	it('renders revolution', async () => {
		const { RevolutionView } = await import('./revolution/revolution-view');
		const html = await withProviders(<RevolutionView />);
		expect(html).toContain('role="radiogroup"');
		expect(html).toContain('name="revolution-scope"');
	}, 10_000);

	it('renders export', async () => {
		const { ExportView } = await import('./export/export-view');
		const html = await withProviders(<ExportView />);
		expect(html).toContain('id="ex-loc"');
		expect(html).toContain('id="ex-info"');
	}, 10_000);
});
