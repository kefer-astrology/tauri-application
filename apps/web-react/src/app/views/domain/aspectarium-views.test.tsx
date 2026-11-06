import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { aspectariumData } from '@/lib/astrology/aspectarium';
import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type { TransitOverlay } from '@/lib/astrology/transits';
import { AspectEntryList } from './aspect-entry-list';
import { AspectMatrix } from './aspect-matrix';
import { MidpointContactTable, MidpointTable } from './midpoint-tables';

DEFAULT_OBSERVABLE_OBJECT_IDS.push('sun', 'moon', 'mars');

const chart = {
	id: 'jan',
	computed: {
		positions: { sun: 10, moon: 100, mars: 190 },
		aspects: [{ from: 'moon', to: 'sun', type: 'square', orb: 0.5 }]
	}
} as unknown as AppChart;

const filters = {
	bodyIds: new Set(['sun', 'moon', 'mars', 'saturn']),
	aspectTypes: new Set(['square']),
	maxOrb: 5
};

const render = (node: React.ReactNode) =>
	renderToString(
		<AppThemeProvider theme="noon" glyphSet="default">
			{node}
		</AppThemeProvider>
	);

const common = {
	selectedId: null,
	onSelect: () => {},
	bodyLabel: (id: string) => id.toUpperCase(),
	bodyColor: () => '#111',
	aspectColor: () => '#f00',
	cornerLabel: 'Transit → radix',
	missingPositionLabel: 'Loading'
};

describe('aspectarium views', () => {
	it('draws the radix triangle with bodies on the diagonal and one aspect cell', () => {
		const data = aspectariumData(chart, null, filters);
		const html = render(
			<AspectMatrix {...common} data={data} rowLongitude={() => 10} columnLongitude={() => 10} />
		);
		expect(html).toContain('SUN');
		expect(html).toContain('0.50°');
		expect(html).not.toContain('Transit → radix');
		expect(html.match(/<button/g)).toHaveLength(1);
	});

	it('draws transiting rows against radix columns with the corner label', () => {
		const overlay = {
			sourceChartId: 'jan',
			transitedBodies: ['sun', 'mars'],
			transitingBodies: ['saturn'],
			transitChart: { computed: { positions: { saturn: 100 } } },
			aspects: [{ from: 'saturn', to: 'sun', type: 'square', orb: 1 }]
		} as unknown as TransitOverlay;
		const data = aspectariumData(chart, overlay, filters);
		const html = render(
			<AspectMatrix {...common} data={data} rowLongitude={() => null} columnLongitude={() => 10} />
		);
		expect(html).toContain('Transit → radix');
		expect(html).toContain('SATURN');
		expect(html).toContain('Loading');
		expect(html).toContain('1.00°');
	});

	it('lists aspects, or an empty text', () => {
		const data = aspectariumData(chart, null, filters);
		const list = (entries: typeof data.entries) =>
			render(
				<AspectEntryList
					{...common}
					entries={entries}
					aspectLabel={(type) => type}
					emptyText="Nothing here"
				/>
			);
		expect(list(data.entries)).toMatch(/MOON(<!-- -->)? — (<!-- -->)?SUN/);
		expect(list([])).toContain('Nothing here');
	});

	it('shows midpoints and contacts on data tables', () => {
		const html = render(
			<>
				<MidpointTable
					midpoints={[
						{
							chart_id: 'jan',
							object_a: 'sun',
							object_b: 'moon',
							position: 55,
							opposite: 235,
							ambiguous: true
						}
					]}
					bodyLabel={(id) => id}
					labels={{
						pair: 'Pair',
						position: 'Position',
						opposite: 'Opposite',
						ambiguous: 'ambiguous',
						ambiguousHint: 'hint'
					}}
					empty="none"
				/>
				<MidpointContactTable
					contacts={[]}
					bodyLabel={(id) => id}
					aspectLabel={(type) => type}
					labels={{ object: 'Object', pair: 'Pair', aspect: 'Aspect', orb: 'Orb' }}
					empty="No contacts"
				/>
			</>
		);
		expect(html).toContain('sun / moon');
		expect(html).toContain('ambiguous');
		expect(html).toContain('No contacts');
	});
});
