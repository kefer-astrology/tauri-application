import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type { TransitOverlay } from './transits';
import { OBSERVABLE_OBJECTS, type ObservableObjectDefinition } from './observableObjects';
import { astrolabeMaxAmount, chartViewData, formatCoordinates } from './chartView';

// The object catalog is loaded at runtime; seed the angles.
for (const id of ['asc', 'desc', 'mc', 'ic'])
	OBSERVABLE_OBJECTS.push({ id, category: 'angles' } as ObservableObjectDefinition);

const chart = (overrides: Partial<AppChart> = {}): AppChart => ({
	id: 'jan',
	name: 'Jan',
	chartType: 'NATAL',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague',
	tags: [],
	observableObjects: ['sun', 'moon', 'asc', 'mc'],
	computed: {
		positions: { sun: 112, moon: { longitude: 370 }, mars: 50, asc: 200, mc: 110 },
		motion: { moon: { speed: -1, retrograde: true } },
		axes: { asc: 201, desc: 21, mc: 111, ic: 291 },
		aspects: [{ from: 'sun', to: 'moon', type: 'square', orb: 1.5 }]
	},
	...overrides
});

describe('chartViewData', () => {
	it('draws the chart’s own objects, angles on the axes', () => {
		const data = chartViewData(chart(), ['mars'], null);
		expect(data.positionOrder).toEqual(['sun', 'moon', 'asc', 'mc']);
		expect(data.wheelBodyOrder).toEqual(['sun', 'moon']);
		expect(data.wheelBodyLongitudes).toEqual({ sun: 112, moon: 10 });
		// Axes come from the computed axes; DSC and IC are not shown by this chart.
		expect(data.axisLongitudes).toEqual({ asc: 201, dsc: undefined, mc: 111, ic: undefined });
		expect(data.ascLongitude).toBe(201);
		expect(data.showAxisLines).toBe(true);
		expect(data.positionRows).toEqual([
			{ id: 'sun', longitude: 112, retrograde: false },
			{ id: 'moon', longitude: 10, retrograde: true },
			{ id: 'asc', longitude: 200, retrograde: false },
			{ id: 'mc', longitude: 110, retrograde: false }
		]);
		expect(data.radixAspects).toHaveLength(1);
	});

	it('falls back to the default bodies, and is empty without a chart', () => {
		expect(
			chartViewData(chart({ observableObjects: undefined }), ['mars'], null).positionOrder
		).toEqual(['mars']);
		const empty = chartViewData(null, ['mars'], null);
		expect(empty.positionRows).toEqual([]);
		expect(empty.showAxisLines).toBe(false);
		expect(empty.ascLongitude).toBeUndefined();
	});

	it('takes transit bodies only from an overlay of this chart', () => {
		const overlay = {
			sourceChartId: 'jan',
			transitingBodies: ['saturn', 'pluto'],
			transitChart: { computed: { positions: { saturn: 400 } } }
		} as unknown as TransitOverlay;
		expect(chartViewData(chart(), [], overlay)).toMatchObject({
			transitBodyOrder: ['saturn', 'pluto'],
			transitBodyLongitudes: { saturn: 40 }
		});
		const other = { ...overlay, sourceChartId: 'eva' } as TransitOverlay;
		expect(chartViewData(chart(), [], other).transitBodyOrder).toEqual([]);
	});
});

describe('astrolabe and labels', () => {
	it('offers step amounts per unit and formats coordinates', () => {
		expect(astrolabeMaxAmount('day')).toBe(30);
		expect(astrolabeMaxAmount('hr')).toBe(12);
		expect(astrolabeMaxAmount('month')).toBe(12);
		expect(astrolabeMaxAmount('yr')).toBe(10);
		expect(formatCoordinates(50.08754, 14.42139)).toBe('50.0875, 14.4214');
		expect(formatCoordinates(undefined, 14)).toBeNull();
	});
});
