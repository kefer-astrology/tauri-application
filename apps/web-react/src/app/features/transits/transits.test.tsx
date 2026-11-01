import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { exactHitRows } from '@/lib/astrology/transitResults';
import type { ConfigurationMatch, TransitEventSearch } from '@/lib/tauri/types';
import type { TransitSection } from './setup/transits-setup-sidebar';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const SECTIONS: TransitSection[] = ['general', 'transiting-bodies', 'transited-bodies', 'aspects'];

const series: AspectTimelineSeries = {
	key: 'saturn-square-pluto',
	from: 'saturn',
	to: 'pluto',
	aspectType: 'square',
	kind: 'moving-fixed',
	closeness: [0.5, 1, 0.5],
	orb: [2, 0, 2],
	phase: [null, 'applying', 'separating'],
	hits: [
		{
			timestampMs: Date.UTC(2026, 0, 2),
			sampleIndex: 1,
			fromLongitude: 100,
			toLongitude: 190,
			fromSpeed: 0.05,
			hitNumber: 1,
			hitCount: 1
		}
	]
};

const match: ConfigurationMatch = {
	configuration_id: 'grand_trine',
	participants: [
		{ role: 'a', body_id: 'jupiter', is_fixed: false },
		{ role: 'b', body_id: 'pluto', is_fixed: true }
	],
	entry: '2026-01-01T00:00:00Z',
	entry_clipped: 'period_start',
	exit: null,
	exit_clipped: null,
	constituent_aspects: [],
	best_fit: { datetime: '2026-01-02T00:00:00Z', max_normalized_deviation: 0.1 }
};

const eventSearch: TransitEventSearch = {
	events: [
		{
			kind: 'aspect_hit',
			datetime: '2026-01-02T00:00:00Z',
			from: 'saturn',
			to: 'pluto',
			type: 'square',
			exact_angle: 90,
			contact: 'tangential',
			confirmed: false
		},
		{
			kind: 'station',
			datetime: '2026-01-03T00:00:00Z',
			body: 'mercury',
			direction_change: 'direct_to_retrograde',
			confirmed: true
		}
	],
	configuration_matches: [match],
	complete: false,
	warnings: ['partial search']
};

/** The app providers the transits feature runs under. */
async function withProviders(children: ReactNode) {
	const { AppearanceProvider } = await import('@/app/providers/appearance');
	const { WorkspaceProvider } = await import('@/app/providers/workspace');
	const { TransitsProvider } = await import('./transits-provider');
	return renderToString(
		<AppearanceProvider>
			<WorkspaceProvider>
				<TransitsProvider>{children}</TransitsProvider>
			</WorkspaceProvider>
		</AppearanceProvider>
	);
}

async function withTheme(children: ReactNode) {
	const { AppThemeProvider } = await import('@/app/providers/app-theme');
	return renderToString(
		<AppThemeProvider theme="noon" glyphSet="default">
			{children}
		</AppThemeProvider>
	);
}

describe('transits', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	// Server rendering runs the provider, the setup view and its sections synchronously.
	it.each(SECTIONS)(
		'renders the %s setup section',
		async (section) => {
			const { TransitsView, TransitsSidebar } = await import('./transits-view');
			const html = await withProviders(
				<>
					<TransitsSidebar dynamic={false} activeSection={section} onSectionChange={() => {}} />
					<TransitsView section={section} />
				</>
			);
			expect(html.length).toBeGreaterThan(100);
			if (section === 'general') {
				expect(html).toContain('Calculate');
				expect(html).toContain('data-tour="transits-period"');
			}
		},
		10_000
	);

	it('renders the results toolbar', async () => {
		const { ResultsToolbar } = await import('./results/results-toolbar');
		const html = await withProviders(<ResultsToolbar />);
		expect(html).toContain('Edit setup');
	});

	it('renders the results panels from their data', async () => {
		const { ExactHitsTable } = await import('./results/exact-hits-table');
		const { EventSearchPanel } = await import('./results/event-search-panel');
		const { ConfigurationMatchesPanel } = await import('./results/configuration-matches-panel');
		const { ResonancePanel } = await import('./results/resonance-panel');

		const table = await withTheme(<ExactHitsTable rows={exactHitRows([series])} />);
		expect(table).toContain('Aspect');
		expect(table).toContain('<tbody');

		const events = await withTheme(
			<EventSearchPanel eventSearch={eventSearch} onOpenInstant={() => {}} />
		);
		expect(events).toContain('Exact events');
		expect(events).toContain('partial search');
		expect(events).toContain('unconfirmed');
		expect(events).toContain('Open chart');

		const matches = await withTheme(
			<ConfigurationMatchesPanel matches={[match]} onOpenInstant={() => {}} />
		);
		expect(matches).toContain('Entry');
		expect(matches).toContain('clipped: period start');

		const empty = await withTheme(
			<EventSearchPanel
				eventSearch={{ events: [], configuration_matches: [], complete: true, warnings: [] }}
				onOpenInstant={() => {}}
			/>
		);
		expect(empty).toBe('');

		const chart = await withTheme(
			<ResonancePanel
				categories={[Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 3)]}
				series={[series]}
				fastBodyIds={['sun']}
				colorByKey={new Map([[series.key, '#ff0000']])}
				yMaxDegrees={6}
				visibleRange={null}
				onVisibleRangeChange={() => {}}
				highlightedKey={null}
				onHighlightChange={() => {}}
				onOpenSeries={() => {}}
			/>
		);
		expect(chart).toContain('<svg');
		expect(chart).toContain('Micro ticker');
		expect(chart).toMatch(/<title>sun<\/title>/i);
	});
});
