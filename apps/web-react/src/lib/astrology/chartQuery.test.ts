import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { buildChartForest } from '@/lib/chartHierarchy';
import {
	chartMetadataMatches,
	chartAstrologyMatches,
	astrologyQueryActive,
	emptyAspectFilter,
	emptyChartQuery,
	filterChartTree,
	metadataQueryActive,
	toggleTagInQuery,
	type ChartQuery
} from './chartQuery';
import { chartTypeId } from '@/lib/chartTypes';
import { chartSearchMetadata } from './chartSearch';

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

describe('open metadata filters', () => {
	const matches = (patch: Partial<ChartQuery>, chart = charts[2]!) =>
		chartMetadataMatches(chart, { ...emptyChartQuery(), ...patch }, (c) => c.chartType);
	const parts = (patch: Partial<ChartQuery['date']>) => ({ ...emptyChartQuery().date, ...patch });

	it('matches any nonempty tag or location substring regardless of case', () => {
		expect(matches({ tag: 'missing, OR, , ' })).toBe(true);
		expect(matches({ tag: 'missing, injury' })).toBe(false);
		expect(matches({ location: 'Zlín, PRAG, ' })).toBe(true);
		expect(matches({ location: 'Zlín, Brno' })).toBe(false);
		expect(metadataQueryActive({ ...emptyChartQuery(), tag: ', ,', location: ',' })).toBe(false);
	});

	it('toggles tags without discarding other terms', () => {
		expect(toggleTagInQuery('WORK, personal', 'work')).toBe('personal');
		expect(toggleTagInQuery('personal', 'work')).toBe('personal, work');
	});

	it('keeps exact date-part matching in chart-local time', () => {
		const chart = { ...charts[2]!, dateTime: '2026-07-14T23:30:00Z', timezone: 'Europe/Prague' };
		expect(matches({ date: parts({ day: '15', hour: '1' }) }, chart)).toBe(true);
		expect(matches({ date: parts({ day: '14' }) }, chart)).toBe(false);
	});

	it('widens partial ranges and includes both boundaries', () => {
		const range: Partial<ChartQuery> = {
			dateMode: 'range',
			date: parts({ year: '2026', month: '2' }),
			dateEnd: parts({ year: '2026', month: '2' })
		};
		for (const dateTime of ['2026-02-01T00:00:00Z', '2026-02-28T23:59:59.999Z']) {
			expect(matches(range, { ...charts[2]!, dateTime })).toBe(true);
		}
		expect(matches(range, { ...charts[2]!, dateTime: '2026-03-01T00:00:00Z' })).toBe(false);
		expect(
			matches(
				{ ...range, dateEnd: parts({ year: '2024', month: '2' }), date: parts({}) },
				{ ...charts[2]!, dateTime: '2024-02-29T23:59:59Z' }
			)
		).toBe(true);
	});

	it('compares ranges using chart-local time and supports unbounded sides', () => {
		const chart = { ...charts[2]!, dateTime: '2026-07-14T23:30:00Z', timezone: 'Europe/Prague' };
		expect(
			matches({ dateMode: 'range', date: parts({ year: '2026', month: '7', day: '15' }) }, chart)
		).toBe(true);
		expect(
			matches({ dateMode: 'range', dateEnd: parts({ year: '2026', month: '7', day: '14' }) }, chart)
		).toBe(false);
		expect(
			matches({ dateMode: 'range', date: parts({ day: '31' }) }, { ...chart, dateTime: '' })
		).toBe(true);
		expect(emptyChartQuery().dateMode).toBe('fixed');
	});
});

describe('chart type union', () => {
	it('includes selected base types and matching derived charts under other base types', () => {
		const event = {
			...natal('event', 0),
			chartType: 'EVENT',
			definition: { kind: 'base', purpose: 'event' }
		} as AppChart;
		const result = filterChartTree(
			buildChartForest([...charts, event]),
			{ ...emptyChartQuery(), types: ['event', 'solar'] },
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
		expect(result.rows.map((row) => row.chart.id)).toEqual(['radomir', 'event']);
		expect(result.rows[0]!.children!.map((row) => row.chart.id)).toEqual(['solar2026']);
		expect(keys({ types: ['natal', 'transit'] })).toContain('orphan[]');
	});

	it.each([
		'synastry',
		'composite',
		'davison',
		'coalescent',
		'progressed-synastry',
		'progressed-composite',
		'draconic-synastry'
	])('distinguishes %s by method', (method) => {
		const chart = { ...charts[3]!, synastry: { ...charts[3]!.synastry!, method } } as AppChart;
		const type = chartTypeId(chart);
		expect(type).not.toBeNull();
		expect(type).toBe(
			{
				synastry: 'synastry',
				composite: 'synastry_composite',
				davison: 'synastry_davison',
				coalescent: 'synastry_coalescent',
				'progressed-synastry': 'synastry_progressed',
				'progressed-composite': 'synastry_progressed_composite',
				'draconic-synastry': 'synastry_draconic'
			}[method]
		);
	});
});

describe('aspect dynamics and cycle filters', () => {
	const chart = {
		...natal('aspects', 0),
		computed: {
			aspects: [
				{
					from: 'moon',
					to: 'sun',
					type: 'square',
					applying: true,
					exact: false,
					separating: false,
					phase: 'waxing'
				},
				{
					from: 'venus',
					to: 'mars',
					type: 'trine',
					applying: false,
					exact: false,
					separating: true,
					phase: 'waning'
				},
				{
					from: 'mercury',
					to: 'jupiter',
					type: 'sextile',
					applying: false,
					exact: true,
					separating: false,
					phase: 'waxing'
				},
				{ from: 'asc', to: 'saturn', type: 'square' }
			]
		}
	} as unknown as AppChart;
	const matches = (patch: Partial<ChartQuery['aspects'][number]>, source = chart) => {
		const query = { ...emptyChartQuery(), aspects: [{ ...emptyAspectFilter(1), ...patch }] };
		return chartAstrologyMatches(source, chartSearchMetadata(source), query);
	};

	it('activates the query even with no objects selected', () => {
		for (const patch of [{ dynamics: 'exact' as const }, { phase: 'waxing' as const }]) {
			expect(
				astrologyQueryActive({
					...emptyChartQuery(),
					aspects: [{ ...emptyAspectFilter(1), ...patch }]
				})
			).toBe(true);
			expect(matches(patch)).toBe(true);
		}
	});

	it('requires dynamics, cycle phase, objects and type on the same aspect', () => {
		expect(
			matches({
				left: 'sun',
				right: 'moon',
				aspect: 'square',
				dynamics: 'applying',
				phase: 'waxing'
			})
		).toBe(true);
		expect(matches({ left: 'sun', right: 'moon', dynamics: 'separating' })).toBe(false);
		expect(matches({ dynamics: 'applying', phase: 'waning' })).toBe(false);
		expect(matches({ aspect: 'trine', dynamics: 'separating', phase: 'waning' })).toBe(true);
		expect(matches({ aspect: 'sextile', dynamics: 'exact', phase: 'waxing' })).toBe(true);
		expect(matches({ aspect: 'sextile', dynamics: 'applying' })).toBe(false);
	});

	it('does not infer dynamics or phase from missing backend annotations', () => {
		expect(matches({ left: 'asc' })).toBe(true);
		expect(matches({ left: 'asc', dynamics: 'exact' })).toBe(false);
		expect(matches({ left: 'asc', phase: 'waning' })).toBe(false);
		const legacy = {
			...chart,
			computed: { aspects: [{ from: 'moon', to: 'sun', type: 'square' }] }
		} as AppChart;
		expect(matches({ dynamics: 'separating' }, legacy)).toBe(false);
		expect(matches({}, legacy)).toBe(true);
	});

	it('clears both controls on reset and when adding a condition', () => {
		expect(emptyChartQuery().aspects[0]).toMatchObject({ dynamics: '', phase: '' });
		expect(emptyAspectFilter(2)).toMatchObject({ dynamics: '', phase: '' });
	});
});
