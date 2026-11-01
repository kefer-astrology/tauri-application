import { describe, expect, it } from 'vitest';
import type { AspectExactHit, AspectTimelineSeries } from './aspectTimeline';
import { DEFAULT_ASPECT_COLORS } from './aspects';
import { OBSERVABLE_OBJECTS, type ObservableObjectDefinition } from './observableObjects';
import {
	aspectColorByKey,
	fastBodies,
	clampYZoomDegrees,
	clippedOrbValues,
	exactHitRows,
	layerVisibility,
	positionsForIds,
	resonanceMarkers,
	runBoundaries,
	sampledSeriesToShow,
	seriesToTargets,
	transitingLayers,
	transitingBodyIdsInSeries,
	transitResultWarnings,
	withKeysVisible,
	xZoomWindow,
	X_ZOOM_PRESET_MS
} from './transitResults';

const hit = (timestampMs: number, sampleIndex: number): AspectExactHit => ({
	timestampMs,
	sampleIndex,
	fromLongitude: 0,
	toLongitude: 0,
	hitNumber: 1,
	hitCount: 1
});

const series = (
	from: string,
	to: string,
	aspectType: string,
	orb: Array<number | null> = [],
	hits: AspectExactHit[] = []
): AspectTimelineSeries => ({
	key: `${from}-${aspectType}-${to}`,
	from,
	to,
	aspectType,
	kind: 'moving-fixed',
	closeness: [],
	orb,
	phase: [],
	hits
});

describe('series data', () => {
	it('keeps positions of the requested ids', () => {
		expect(
			positionsForIds({ sun: 370, moon: { longitude: -10 }, mars: 'x' }, ['sun', 'moon', 'mars'])
		).toEqual({
			sun: 10,
			moon: 350
		});
	});

	it('lists transiting bodies present in the series, else the selection', () => {
		const entries = [
			{ datetime: 'a', transit_positions: { sun: 1 } },
			{ datetime: 'b', transit_positions: { moon: 2, sun: 3 } }
		];
		expect(transitingBodyIdsInSeries(entries, ['pluto'])).toEqual(['sun', 'moon']);
		expect(transitingBodyIdsInSeries([], ['pluto'])).toEqual(['pluto']);
	});

	it('shows the sampled series, a snapshot when empty, or nothing when not requested', () => {
		const snapshot = { datetime: 'now' };
		const raw = [{ datetime: 'a' }, { datetime: 'b' }];
		expect(sampledSeriesToShow(raw, true, snapshot)).toBe(raw);
		expect(sampledSeriesToShow([], true, snapshot)).toEqual([snapshot]);
		expect(sampledSeriesToShow(undefined, true, snapshot)).toEqual([snapshot]);
		expect(sampledSeriesToShow(raw, false, snapshot)).toEqual([]);
	});

	it('adds fallback and short-series warnings', () => {
		expect(
			transitResultWarnings(
				{
					warnings: ['w'],
					fallback_used: true,
					backend_used: 'swisseph',
					results: [{ datetime: 'a' }]
				},
				'custom',
				24
			)
		).toEqual([
			'w',
			'Fell back to the swisseph backend after the primary one failed.',
			'Expected ~24 samples over the selected period but received only 1. The backend may have rejected the request and returned a single snapshot instead.'
		]);
		expect(transitResultWarnings({}, 'current', 1)).toEqual([]);
	});
});

describe('resonance chart', () => {
	it('clamps the Y zoom to 0.5–6° in 0.1° steps', () => {
		expect(clampYZoomDegrees(0.1)).toBe(0.5);
		expect(clampYZoomDegrees(7)).toBe(6);
		expect(clampYZoomDegrees(2.34)).toBe(2.3);
	});

	it('zooms to a preset window inside the data', () => {
		const day = X_ZOOM_PRESET_MS.day;
		const categories = [0, 10 * day];
		expect(xZoomWindow('day', categories, null)).toEqual([9 * day, 10 * day]);
		expect(xZoomWindow('day', categories, [0, 2 * day])).toEqual([0.5 * day, 1.5 * day]);
		expect(xZoomWindow('day', categories, [0, 0])).toEqual([0, day]);
		expect(xZoomWindow('year', categories, null)).toEqual([0, 10 * day]);
		expect(xZoomWindow('day', [], null)).toBeNull();
	});

	it('picks fast transited bodies for the ticker and colors by aspect', () => {
		// The object catalog is loaded at runtime; seed the two categories involved.
		OBSERVABLE_OBJECTS.push(
			{ id: 'sun', category: 'luminaries' } as ObservableObjectDefinition,
			{ id: 'saturn', category: 'social_planets' } as ObservableObjectDefinition
		);
		const sun = series('pluto', 'sun', 'trine');
		const saturn = series('pluto', 'saturn', 'square');
		expect(fastBodies(['saturn', 'sun', 'pluto'])).toEqual(['sun']);
		expect(seriesToTargets([sun, saturn], ['sun'])).toEqual([sun]);
		const colors = aspectColorByKey([sun, saturn, series('x', 'y', 'nope')], { trine: '#123' });
		expect(colors.get(sun.key)).toBe('#123');
		expect(colors.get(saturn.key)).toBe(DEFAULT_ASPECT_COLORS.square);
		expect(colors.get('x-nope-y')).toBe('var(--theme-accent)');
	});

	it('clips orbs to the window and marks hits, entries and exits', () => {
		const s = series('saturn', 'pluto', 'square', [3, 1, 0, 1, 7, null, 2, 2], [hit(2, 2)]);
		const values = clippedOrbValues([s], 6);
		expect(values[s.key]).toEqual([3, 1, 0, 1, null, null, 2, 2]);
		expect(runBoundaries(values[s.key]!)).toEqual([
			{ start: 0, end: 3 },
			{ start: 6, end: 7 }
		]);
		expect(resonanceMarkers([s], values, () => 'Exact')).toEqual([
			{ seriesId: s.key, index: 2, kind: 'hit', title: 'Exact' },
			{ seriesId: s.key, index: 0, kind: 'entry' },
			{ seriesId: s.key, index: 3, kind: 'exit' },
			{ seriesId: s.key, index: 6, kind: 'entry' },
			{ seriesId: s.key, index: 7, kind: 'exit' }
		]);
	});

	it('lists exact hits in time order', () => {
		const a = series('saturn', 'pluto', 'square', [], [hit(30, 3), hit(10, 1)]);
		const b = series('mars', 'pluto', 'trine', [], [hit(20, 2)]);
		expect(exactHitRows([a, b]).map((row) => row.hit.timestampMs)).toEqual([10, 20, 30]);
	});
});

describe('layers', () => {
	it('groups series by transiting body in selection order and reports visibility', () => {
		const layers = transitingLayers(
			[
				series('saturn', 'sun', 'trine'),
				series('pluto', 'moon', 'square'),
				series('saturn', 'moon', 'square'),
				series('chiron', 'sun', 'trine')
			],
			['jupiter', 'saturn', 'pluto']
		);
		expect(layers).toEqual([
			{ from: 'saturn', keys: ['saturn-trine-sun', 'saturn-square-moon'] },
			{ from: 'pluto', keys: ['pluto-square-moon'] },
			{ from: 'chiron', keys: ['chiron-trine-sun'] }
		]);
		const keys = layers[0]!.keys;
		expect(layerVisibility(keys, new Set())).toBe(true);
		expect(layerVisibility(keys, new Set([keys[0]!]))).toBe('indeterminate');
		const hidden = withKeysVisible(new Set(), keys, false);
		expect(layerVisibility(keys, hidden)).toBe(false);
		expect(withKeysVisible(hidden, [keys[0]!], true)).toEqual(new Set([keys[1]]));
	});
});
