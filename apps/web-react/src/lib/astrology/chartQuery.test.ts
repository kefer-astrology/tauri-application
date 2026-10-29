import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { buildChartForest } from '@/lib/chartHierarchy';
import { emptyChartQuery, filterChartTree, type ChartQuery } from './chartQuery';

const natal = (id: string, sunSign: number) =>
	({
		id,
		name: id,
		entityKind: 'chart',
		chartType: 'NATAL',
		definition: { kind: 'base', purpose: 'natal' },
		dateTime: '1984-07-14T15:30:00Z',
		location: 'Zlín',
		tags: [],
		computed: {
			facts: {
				bodies: { sun: { sign: sunSign, degree_in_sign: 21.2, house: 10, motion: 'direct' } }
			}
		}
	}) as unknown as AppChart;

const charts = [
	natal('radomir', 4),
	natal('juan', 0),
	{
		id: 'solar2026',
		name: 'Solar 2026',
		entityKind: 'chart',
		chartType: 'SOLAR_RETURN',
		definition: { kind: 'derived', method: 'return', inputs: ['radomir'] },
		dateTime: '2026-07-14T21:14:00Z',
		location: 'Prague',
		tags: ['work']
	},
	{
		id: 'syn',
		name: 'Partners',
		entityKind: 'analysis',
		chartType: 'SYNASTRY',
		synastry: { method: 'synastry', personA: { chartId: 'radomir' }, personB: { chartId: 'juan' } },
		dateTime: '',
		location: '',
		tags: []
	},
	{
		id: 'orphan',
		name: 'Orphan',
		entityKind: 'chart',
		chartType: 'TRANSIT',
		definition: { kind: 'derived', method: 'progression', inputs: ['missing'] },
		dateTime: '2019-01-01T00:00:00Z',
		location: '',
		tags: ['injury']
	}
] as unknown as AppChart[];

const forest = buildChartForest(charts);
const run = (patch: Partial<ChartQuery>) =>
	filterChartTree(
		forest,
		{ ...emptyChartQuery(), ...patch },
		{
			metadataFor: () => ({
				aspects: [],
				houseCusps: [],
				shapes: new Set(),
				configurations: new Set()
			}),
			typeLabel: (chart) => chart.chartType
		}
	);
const keys = (patch: Partial<ChartQuery>) =>
	run(patch)
		.rows.map((row) => `${row.key}[${(row.children ?? []).map((child) => child.key).join(',')}]`)
		.join(' ');
const sunIn = (sign: string) => ({
	...emptyChartQuery().planets,
	sun: { sign, degree: '', house: '', motion: '' }
});

describe('filterChartTree', () => {
	it('lists base charts with their children, and orphans at the top level', () => {
		expect(keys({})).toBe('radomir[radomir/solar2026,radomir/syn] juan[juan/syn] orphan[]');
	});

	it('a derived type shows matching children and opens their parent', () => {
		expect(keys({ types: ['solar'] })).toBe('radomir[radomir/solar2026]');
		expect(run({ types: ['solar'] }).autoExpanded).toEqual({ radomir: true });
	});

	it('a two-parent analysis appears under both parents', () => {
		expect(keys({ types: ['synastry'] })).toBe('radomir[radomir/syn] juan[juan/syn]');
	});

	it('metadata filters match children too', () => {
		expect(keys({ tag: 'work' })).toBe('radomir[radomir/solar2026]');
		expect(keys({ tag: 'injury' })).toBe('orphan[]');
	});

	it('astrology filters select base charts only', () => {
		expect(keys({ planets: sunIn('4') })).toBe('radomir[radomir/solar2026,radomir/syn]');
		expect(keys({ planets: sunIn('0') })).toBe('juan[juan/syn]');
	});

	it('base types keep all children', () => {
		expect(keys({ types: ['natal'] })).toBe(
			'radomir[radomir/solar2026,radomir/syn] juan[juan/syn]'
		);
	});
});
