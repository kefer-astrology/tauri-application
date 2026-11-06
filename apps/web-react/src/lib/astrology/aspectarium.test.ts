import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type { TransitOverlay } from './transits';
import { DEFAULT_OBSERVABLE_OBJECT_IDS } from './observableObjects';
import {
	aspectariumData,
	cellKey,
	formatOrb,
	matrixCell,
	maxOrbForPreset,
	type AspectariumFilters
} from './aspectarium';

const chart = {
	id: 'jan',
	name: 'Jan',
	chartType: 'NATAL',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague',
	tags: [],
	computed: {
		positions: { sun: 10, moon: 100, mars: 190, venus: 40 },
		aspects: [
			{ from: 'moon', to: 'sun', type: 'square', orb: 0.5 },
			{ from: 'sun', to: 'mars', type: 'opposition', orb: -4 },
			{ from: 'sun', to: 'venus', type: 'trine', orb: 0.2 },
			{ from: 'moon', to: 'mars', type: 'square', orb: 6 }
		]
	}
} as unknown as AppChart;

const filters = (overrides: Partial<AspectariumFilters> = {}): AspectariumFilters => ({
	bodyIds: new Set(['sun', 'moon', 'mars', 'venus']),
	aspectTypes: new Set(['square', 'opposition']),
	maxOrb: 5,
	...overrides
});

// Radix rows follow the catalog order; the catalog is loaded at runtime, so seed it.
DEFAULT_OBSERVABLE_OBJECT_IDS.push('sun', 'moon', 'mars');
const overlayFor = (bodies: string[]) =>
	({
		sourceChartId: 'jan',
		transitedBodies: bodies,
		transitingBodies: ['saturn', 'pluto'],
		transitChart: { computed: { positions: { saturn: 100, pluto: 280 } } },
		aspects: [
			{ from: 'saturn', to: 'sun', type: 'square', orb: 1 },
			{ from: 'pluto', to: 'mars', type: 'square', orb: 7 }
		]
	}) as unknown as TransitOverlay;

describe('aspectariumData', () => {
	it('filters radix aspects by bodies, aspect types and orb, in an unordered triangle', () => {
		const data = aspectariumData(chart, null, filters());
		expect(data.transit).toBe(false);
		expect(data.rowIds).toEqual(data.columnIds);
		// Venus is the trine (type filtered out); moon–mars is beyond the orb.
		expect(data.entries.map((e) => `${e.aspect.from}-${e.aspect.to}`)).toEqual([
			'moon-sun',
			'sun-mars'
		]);
		expect(data.allRadixAspects).toHaveLength(4);
	});

	it('uses transiting rows and radix columns with an overlay of this chart', () => {
		const data = aspectariumData(
			chart,
			overlayFor(['sun', 'mars']),
			filters({ bodyIds: new Set(['sun', 'mars', 'saturn', 'pluto']) })
		);
		expect(data.transit).toBe(true);
		expect(data.rowIds).toEqual(['saturn', 'pluto']);
		expect(data.columnIds).toEqual(['sun', 'mars']);
		expect(data.entries.map((e) => e.id)).toEqual(['transit::saturn::sun::square']);
		expect(data.availableBodyIds).toEqual(['sun', 'mars', 'saturn', 'pluto']);
	});

	it('maps matrix cells: blank above the diagonal, the body on it, aspects below', () => {
		// An overlay of another chart is ignored.
		const data = aspectariumData(
			chart,
			{ ...overlayFor(['sun']), sourceChartId: 'other' },
			filters()
		);
		expect(data.columnIds).toEqual(['sun', 'moon', 'mars']);
		expect(matrixCell(data, 0, 1, 'sun', 'moon')).toEqual({ kind: 'blank' });
		expect(matrixCell(data, 1, 1, 'moon', 'moon')).toEqual({ kind: 'diagonal', bodyId: 'moon' });
		expect(matrixCell(data, 1, 0, 'moon', 'sun')).toMatchObject({ kind: 'aspect' });
		expect(matrixCell(data, 2, 1, 'mars', 'moon')).toEqual({ kind: 'empty' });
	});
});

describe('helpers', () => {
	it('keys radix pairs unordered and transit pairs directional', () => {
		const order = new Map([
			['sun', 0],
			['moon', 1]
		]);
		expect(cellKey('moon', 'sun', false, order)).toBe('sun::moon');
		expect(cellKey('moon', 'sun', true, order)).toBe('moon::sun');
		expect(maxOrbForPreset('tight')).toBe(1);
		expect(maxOrbForPreset('wide')).toBe(8);
		expect(formatOrb(-4.256)).toBe('4.26°');
		expect(formatOrb(undefined)).toBeNull();
	});
});
