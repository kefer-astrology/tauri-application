import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { DEFAULT_WORKSPACE_DEFAULTS } from '@/lib/tauri/chartPayload';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
const toastMock = vi.hoisted(() =>
	Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() })
);
vi.mock('sonner', () => ({ toast: toastMock, Toaster: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	toastMock.mockClear();
});

function SeedChart({ chart }: { chart?: AppChart }) {
	const { addChart } = useWorkspaceCharts();
	useEffect(() => {
		if (chart) addChart(chart);
	}, [chart, addChart]);
	return null;
}

/** Render the module at a measured width (the layout goes compact below 960px). */
async function renderAt(width: number, chart?: AppChart) {
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
	const { RightPanelProvider } = await import('@/app/providers/right-panel');
	const { WidgetWorkspaceProvider } = await import('@/app/providers/widget-workspace');
	const { HoroskopView } = await import('./horoskop-view');
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<AppearanceProvider>
				<WorkspaceProvider>
					<SeedChart chart={chart} />
					<WidgetWorkspaceProvider>
						<RightPanelProvider>
							<HoroskopView
								workspaceDefaults={DEFAULT_WORKSPACE_DEFAULTS}
								elementColors={{ fire: '#f00', earth: '#0a0', air: '#ff0', water: '#00f' }}
								lightPlanetFill="#111"
								enabledSymbolSetIds={[]}
							/>
						</RightPanelProvider>
					</WidgetWorkspaceProvider>
				</WorkspaceProvider>
			</AppearanceProvider>
		)
	);
	const cleanup = async () => {
		await act(async () => root.unmount());
		container.remove();
	};
	return { container, cleanup };
}

describe('HoroskopView', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	it('lays out the profile widgets around the wheel, with the guided-tour anchors', async () => {
		const { container, cleanup } = await renderAt(1200);
		const html = container.innerHTML;
		for (const anchor of [
			'radix-workspace',
			'radix-profile',
			'radix-astrolabe',
			'radix-positions',
			'radix-wheel'
		]) {
			expect(html).toContain(`data-tour="${anchor}"`);
		}
		// Left region: profile, then astrolabe; positions on the right of the wheel.
		const [left, right] = container.querySelectorAll('aside');
		expect(left!.querySelector('[data-tour="radix-profile"]')).not.toBeNull();
		expect(left!.innerHTML.indexOf('radix-profile')).toBeLessThan(
			left!.innerHTML.indexOf('radix-astrolabe')
		);
		expect(right!.querySelector('[data-tour="radix-positions"]')).not.toBeNull();
		// Every widget header collapses from a button; the astrolabe steps have names.
		expect(container.querySelectorAll('h3 > button[aria-expanded]')).toHaveLength(3);
		expect(container.querySelector('button[aria-label="Step back"]')).not.toBeNull();
		expect(container.querySelector('button[aria-label="Step forward"]')).not.toBeNull();
		await cleanup();
	}, 10_000);

	it.each(['object', 'aspect'] as const)(
		'switches an open %s panel in place and dismisses it on empty canvas',
		async (kind) => {
			const { container, cleanup } = await renderAt(1200, {
				id: 'selection-test',
				name: 'Selection test',
				chartType: 'NATAL',
				dateTime: '2000-01-01T12:00:00Z',
				location: 'Prague',
				tags: [],
				observableObjects: ['sun', 'moon', 'mars'],
				computed: {
					positions: { sun: 10, moon: 120, mars: 280 },
					aspects: [
						{ from: 'sun', to: 'moon', type: 'trine', orb: 1 },
						{ from: 'sun', to: 'mars', type: 'square', orb: 0 }
					]
				}
			});
			try {
				const object = (id: string) => container.querySelector(`[data-handoff="Planet_${id}"]`)!;
				const first = () =>
					kind === 'object' ? object('sun') : container.querySelector('[data-wheel-aspect="0"]')!;
				const second = () =>
					kind === 'object'
						? object('moon').querySelector('circle')!
						: container.querySelector('[data-wheel-aspect="1"]')!;
				const click = async (element: Element) => {
					await act(async () => {
						element.dispatchEvent(
							new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
						);
					});
					await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
				};
				await click(first());
				expect(document.querySelector('[role="dialog"]')).toBeNull();
				await click(first());
				const panel = document.querySelector('[role="dialog"]')!;
				expect(panel).not.toBeNull();
				const sunTitle = panel.querySelector('h2')!.textContent;
				expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
				await click(second());
				expect(document.querySelector('[role="dialog"]')).toBe(panel);
				expect(panel.querySelector('h2')!.textContent).not.toBe(sunTitle);
				if (kind === 'object')
					expect(container.querySelector('[data-handoff="Trailer_moon"]')).not.toBeNull();
				await click(container.querySelector('[data-tour="radix-wheel"] svg')!);
				expect(document.querySelector('[role="dialog"]')).toBeNull();
				await click(first());
				expect(document.querySelector('[role="dialog"]')).toBeNull();
			} finally {
				await cleanup();
			}
		},
		10_000
	);

	it('keeps the positions beside the wheel and moves the left widgets behind a button when narrow', async () => {
		const { container, cleanup } = await renderAt(500);
		expect(container.querySelector('[data-tour="radix-positions"]')).not.toBeNull();
		expect(container.querySelector('[data-tour="radix-profile"]')).toBeNull();
		expect(container.querySelector('[data-chart-panel-trigger="details"]')).not.toBeNull();
		await cleanup();
	}, 10_000);

	it('removes a widget from its menu with Undo, and adds or finds widgets from the catalog', async () => {
		const { container, cleanup } = await renderAt(1200);
		const click = (element: Element | null | undefined) =>
			act(async () => (element as HTMLElement).click());
		const leftIds = () =>
			[...container.querySelectorAll('aside')[0]!.querySelectorAll('[data-widget-instance]')].map(
				(el) => el.getAttribute('data-widget-instance')
			);
		expect(leftIds()).toEqual(['chart-profile', 'astrolabe']);

		// ⋯ → Remove from workspace, then Undo from the toast.
		const astrolabe = container.querySelector('[data-widget-instance="astrolabe"]')!;
		await click(astrolabe.querySelector('button[aria-haspopup="menu"]'));
		await click(document.querySelector('[role="menuitem"]'));
		expect(leftIds()).toEqual(['chart-profile']);
		expect(toastMock).toHaveBeenCalledTimes(1);
		const [message, options] = toastMock.mock.calls[0]!;
		expect(message).toBe('Astrolabe removed from the workspace');
		await act(async () => options.action.onClick());
		expect(leftIds()).toEqual(['chart-profile', 'astrolabe']);

		// The catalog finds a unique widget on the workspace and adds a repeatable one.
		await click(container.querySelector('[data-workspace-action="catalog"]'));
		const entry = (id: string) => document.querySelector(`[data-catalog-widget="${id}"]`)!;
		expect(entry('astrolabe').textContent).toContain('On the workspace · Find');
		expect(entry('positions').textContent).toContain('+ Add');
		await click(entry('positions').querySelector('button'));
		const right = container.querySelectorAll('aside')[1]!;
		const added = right.querySelector('[data-widget-instance="positions-2"]');
		expect(added).not.toBeNull();
		expect(added!.className).toContain('ring-2');
		expect(document.querySelector('[data-catalog-widget]')).toBeNull();

		// The profile switch offers the school's profiles; the other starts unchanged.
		expect(container.querySelector('[aria-label="Profile"]')!.textContent).toBe('Basic');
		await cleanup();
	}, 10_000);
});
