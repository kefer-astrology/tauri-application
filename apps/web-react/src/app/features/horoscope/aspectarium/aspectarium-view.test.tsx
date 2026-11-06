import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import { DEFAULT_WORKSPACE_DEFAULTS } from '@/lib/tauri/chartPayload';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('sonner', () => ({
	toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }),
	Toaster: () => null
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function renderAt(width: number) {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ width }) as DOMRect
	);
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	const { AppearanceProvider } = await import('@/app/providers/appearance');
	const { WorkspaceProvider } = await import('@/app/providers/workspace');
	const { WidgetWorkspaceProvider } = await import('@/app/providers/widget-workspace');
	const { RightPanelProvider } = await import('@/app/providers/right-panel');
	const { AspectariumView } = await import('./aspectarium-view');
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<AppearanceProvider>
				<WorkspaceProvider>
					<WidgetWorkspaceProvider>
						<RightPanelProvider>
							<AspectariumView
								workspaceDefaults={DEFAULT_WORKSPACE_DEFAULTS}
								enabledSymbolSetIds={[]}
							/>
						</RightPanelProvider>
					</WidgetWorkspaceProvider>
				</WorkspaceProvider>
			</AppearanceProvider>
		)
	);
	return {
		container,
		cleanup: async () => {
			await act(async () => root.unmount());
			container.remove();
		}
	};
}

const instances = (container: HTMLElement) =>
	[...container.querySelectorAll('[data-widget-instance]')].map((el) =>
		el.getAttribute('data-widget-instance')
	);

describe('AspectariumView', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	it('shows the grid, list and midpoints widgets on a desktop grid, with the shared filters', async () => {
		const { container, cleanup } = await renderAt(1300);
		expect(container.querySelector('[data-grid-breakpoint="desktop"]')).not.toBeNull();
		expect(instances(container)).toEqual(['aspect-matrix', 'aspect-list', 'midpoints']);
		expect(container.textContent).toContain('Aspect grid');
		expect(container.textContent).toContain('Aspect list');
		expect(container.querySelector('[aria-label="Profile"]')).not.toBeNull();
		await cleanup();
	}, 10_000);

	it('removes a widget from its menu and offers it again in the catalog', async () => {
		const { container, cleanup } = await renderAt(1300);
		const click = (element: Element | null | undefined) =>
			act(async () => (element as HTMLElement).click());
		const midpoints = container.querySelector('[data-widget-instance="midpoints"]')!;
		await click(midpoints.querySelector('button[aria-haspopup="menu"]'));
		await click(document.querySelector('[role="menuitem"]'));
		expect(instances(container)).toEqual(['aspect-matrix', 'aspect-list']);

		await click(container.querySelector('[data-workspace-action="catalog"]'));
		const entry = (id: string) => document.querySelector(`[data-catalog-widget="${id}"]`)!;
		expect(entry('aspect-matrix').textContent).toContain('On the workspace · Find');
		expect(entry('midpoints').textContent).toContain('+ Add');
		// Horoskop widgets are not offered here.
		expect(document.querySelector('[data-catalog-widget="astrolabe"]')).toBeNull();
		await click(entry('midpoints').querySelector('button'));
		expect(instances(container)).toEqual(['aspect-matrix', 'aspect-list', 'midpoints']);
		await cleanup();
	}, 10_000);

	it('stacks the widgets in one column on a narrow area', async () => {
		const { container, cleanup } = await renderAt(400);
		expect(container.querySelector('[data-grid-breakpoint="mobile"]')).not.toBeNull();
		await cleanup();
	}, 10_000);
});
