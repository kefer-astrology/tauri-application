import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type { ChartFacts } from '@/lib/tauri/types';
import type { WorkspaceChartsValue } from '@/app/providers/workspace-charts';

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

type Body = ChartFacts['bodies'][string];
const body = (
	element: Body['element'],
	house: number,
	motion: Body['motion'] = 'direct'
): Body => ({
	sign: 0,
	degree_in_sign: 0,
	element,
	modality: 'cardinal',
	house,
	house_group: [1, 4, 7, 10].includes(house)
		? 'active'
		: [2, 5, 8, 11].includes(house)
			? 'reactive'
			: 'resulting',
	motion
});

const facts: ChartFacts = {
	version: 1,
	bodies: {
		sun: body('fire', 10),
		moon: body('fire', 11),
		mercury: body('air', 10, 'retrograde'),
		venus: body('air', 12),
		mars: body('fire', 1),
		jupiter: body('earth', 2),
		saturn: body('earth', 5, 'retrograde'),
		uranus: body('air', 3),
		neptune: body('fire', 1),
		pluto: body('air', 2)
	},
	element_counts: { fire: 4, earth: 2, air: 4, water: 0 },
	modality_counts: { cardinal: 10, fixed: 0, mutable: 0 },
	house_group_counts: { active: 4, reactive: 4, resulting: 2 },
	distribution: { east: 9, west: 1, upper: 4, lower: 6, quadrants: [5, 1, 0, 4], placed: 10 },
	orientation: { extroverted: 8, introverted: 2, balance: 'extroversion' },
	aspect_counts: { conjunction: 3, sextile: 1, square: 4, trine: 2, opposition: 0 },
	unaspected: ['neptune'],
	stelliums: [{ kind: 'house', members: ['sun', 'mercury', 'moon'], house: 10 }],
	angular_planets: [{ body: 'mars', axis: 'asc', orb: 1.2 }],
	lunar_cycle_phase: 'crescent',
	mercury_phase: 'prometheus',
	venus_phase: 'evening_star',
	sun_horizon: 'above',
	moon_horizon: 'above',
	chart_ruler: { traditional: 'mars', modern: 'mars' },
	final_dispositors: {
		traditional: { status: 'single', body: 'saturn' },
		modern: { status: 'none' }
	}
};

const chart = {
	id: 'jan',
	name: 'Jan',
	chartType: 'NATAL',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague',
	tags: [],
	observableObjects: [
		'sun',
		'moon',
		'mercury',
		'venus',
		'mars',
		'jupiter',
		'saturn',
		'uranus',
		'neptune',
		'pluto',
		'asc',
		'desc',
		'mc',
		'ic'
	],
	computed: {
		positions: {
			sun: 112,
			moon: 130,
			mercury: 115,
			venus: 150,
			mars: 200,
			jupiter: 220,
			saturn: 290,
			uranus: 240,
			neptune: 205,
			pluto: 225
		},
		axes: { asc: 190, desc: 10, mc: 100, ic: 280 },
		houseCusps: Array.from({ length: 12 }, (_, i) => 190 + i * 30),
		aspects: [],
		shapes: ['bucket'],
		configurations: ['t_square'],
		facts
	}
} as unknown as AppChart;

async function renderPage(selected: AppChart | undefined) {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ width: 1300 }) as DOMRect
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
	const { WorkspaceChartsProvider } = await import('@/app/providers/workspace-charts');
	const { WidgetWorkspaceProvider } = await import('@/app/providers/widget-workspace');
	const { RightPanelProvider } = await import('@/app/providers/right-panel');
	const { SpektrumView } = await import('./spektrum-view');
	const charts = {
		selectedChart: selected,
		charts: selected ? [selected] : [],
		transitOverlay: null
	} as unknown as WorkspaceChartsValue;
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<AppearanceProvider>
				<WorkspaceProvider>
					<WorkspaceChartsProvider value={charts}>
						<WidgetWorkspaceProvider>
							<RightPanelProvider>
								<SpektrumView
									elementColors={{ fire: '#f00', earth: '#0a0', air: '#ff0', water: '#00f' }}
									lightPlanetFill="#111"
								/>
							</RightPanelProvider>
						</WidgetWorkspaceProvider>
					</WorkspaceChartsProvider>
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

const widget = (container: HTMLElement, id: string) =>
	container.querySelector(`[data-widget-instance="${id}"]`) as HTMLElement;
const halos = (container: HTMLElement) =>
	container.querySelectorAll('circle[filter="url(#hw-planet-halo)"]').length;

describe('SpektrumView', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	it('shows an empty state in every card without chart facts', async () => {
		const { container, cleanup } = await renderPage(undefined);
		expect(container.querySelectorAll('[data-widget-instance]')).toHaveLength(14);
		expect(widget(container, 'element-balance').textContent).toContain(
			'Compute the chart to see its facts.'
		);
		expect(widget(container, 'focal-planets').textContent).toContain(
			'Compute the chart to see its facts.'
		);
		await cleanup();
	}, 10_000);

	it('draws the chart facts in the cards', async () => {
		const { container, cleanup } = await renderPage(chart);
		// The body registry is not loaded in tests: bodies show their ids, so compare in lower case.
		const text = (id: string) => (widget(container, id).textContent ?? '').toLowerCase();
		expect(text('element-balance')).toContain('fire');
		expect(text('element-balance')).toContain('missing: water');
		expect(text('aspect-balance')).toContain('missing: opposition');
		expect(text('stelliums')).toContain('house 10 (3)');
		expect(text('singletons')).toContain('saturn alone in the western hemisphere');
		expect(text('retrograde')).toContain('retrograde planets: 2 of 10');
		expect(text('focal-planets')).toContain('mars');
		expect(text('focal-planets')).toContain('unaspected');
		expect(text('configurations')).toContain('t-square');
		expect(text('spektrum-wheel')).toContain('prometheus');
		expect(text('highlights')).toContain('final dispositor: saturn');
		await cleanup();
	}, 10_000);

	it('previews a row on the wheel while hovered, and keeps it after a click', async () => {
		const { container, cleanup } = await renderPage(chart);
		const row = container.querySelector('[data-focus-row="singleton:west"]') as HTMLElement;
		expect(halos(container)).toBe(0);
		await act(async () => {
			row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		});
		expect(halos(container)).toBe(1);
		expect(
			container
				.querySelector('[data-handoff="Layer_HemisphericOverlay"] path')
				?.getAttribute('fill')
		).toBe('var(--token-wheel-overlay-secondary)');
		await act(async () => {
			row.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
		});
		expect(halos(container)).toBe(0);

		await act(async () => row.click());
		await act(async () => {
			row.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
		});
		expect(row.getAttribute('aria-pressed')).toBe('true');
		expect(halos(container)).toBe(1);
		await act(async () => row.click());
		expect(halos(container)).toBe(0);
		await cleanup();
	}, 10_000);
});
