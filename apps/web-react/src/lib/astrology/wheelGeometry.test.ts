import { describe, expect, it } from 'vitest';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '@/lib/tauri/chartPayload';
import {
	aspectOrbTier,
	horizonHalf,
	isInChartHalf,
	meridianHalf,
	longitudeForAspectPoint,
	maxOrbForAspectType,
	midpointLongitude,
	normalizeHouseCusps,
	polar,
	resolveDeclutteredPlacements,
	strokeDasharrayForAspectTier,
	strokeWidthForAspectTier
} from './wheelGeometry';

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 9);

describe('wheel geometry', () => {
	it('puts 0° at the left edge and runs counter-clockwise', () => {
		const left = polar(100, 100, 50, 0);
		close(left.x, 50);
		close(left.y, 100);
		const bottom = polar(100, 100, 50, 90);
		close(bottom.x, 100);
		close(bottom.y, 150);
	});

	it('finds midpoints across 0° and validates cusps', () => {
		expect(midpointLongitude(350, 10)).toBe(0);
		expect(midpointLongitude(10, 40)).toBe(25);
		const cusps = Array.from({ length: 12 }, (_, i) => i * 30 - 360);
		expect(normalizeHouseCusps(cusps)).toEqual(Array.from({ length: 12 }, (_, i) => i * 30));
		expect(normalizeHouseCusps(cusps.slice(1))).toEqual([]);
		expect(normalizeHouseCusps([...cusps.slice(1), Number.NaN])).toEqual([]);
	});

	it('names chart halves as the chart facts do', () => {
		// ASC 100°, MC 10°: houses 1–6 run 100° → 280°, houses 10–3 run 10° → 190°.
		const axis = { asc: 100, mc: 10 };
		expect(horizonHalf(150, axis.asc)).toBe('lower');
		expect(horizonHalf(50, axis.asc)).toBe('upper');
		expect(meridianHalf(100, axis.mc)).toBe('east');
		expect(meridianHalf(250, axis.mc)).toBe('west');
		expect(isInChartHalf(150, 'lower', axis)).toBe(true);
		expect(isInChartHalf(150, 'upper', axis)).toBe(false);
		expect(isInChartHalf(100.5, 'east', axis)).toBe(true);
		expect(isInChartHalf(300, 'west', axis)).toBe(true);
		// Same planet, another chart: the half depends on that chart's axes.
		expect(horizonHalf(100, 120)).toBe('upper');
	});

	it('fans out conjunctions and leaves lone bodies in place', () => {
		const placements = resolveDeclutteredPlacements(
			[
				{ key: 'sun', lon: 10 },
				{ key: 'mercury', lon: 12 },
				{ key: 'venus', lon: 14 },
				{ key: 'mars', lon: 200 }
			],
			300,
			200
		);
		expect(placements.get('mars')).toEqual({ radius: 300, renderLon: 200 });
		expect(placements.get('mercury')?.radius).toBe(300);
		expect(placements.get('sun')?.radius).toBe(278);
		expect(placements.get('venus')?.radius).toBe(278);
		expect(placements.get('sun')!.renderLon).toBeLessThan(10);
		expect(placements.get('venus')!.renderLon).toBeGreaterThan(14);
		// A cluster across 0° is still one cluster.
		const wrapped = resolveDeclutteredPlacements(
			[
				{ key: 'a', lon: 358 },
				{ key: 'b', lon: 1 }
			],
			300,
			200
		);
		expect(wrapped.get('a')!.radius).toBe(289);
		expect(wrapped.get('b')!.radius).toBe(289);
		expect(wrapped.get('a')!.renderLon).toBeLessThan(358);
		expect(wrapped.get('b')!.renderLon).toBeGreaterThan(1);
		expect(resolveDeclutteredPlacements([], 300, 200).size).toBe(0);
	});

	it('resolves aspect endpoints to bodies or axes', () => {
		const bodies = { sun: 10 };
		const axes = { asc: 100, dsc: 280 };
		expect(longitudeForAspectPoint('Sun', bodies, axes)).toBe(10);
		expect(longitudeForAspectPoint('desc', bodies, axes)).toBe(280);
		expect(longitudeForAspectPoint('mc', bodies, axes)).toBeNull();
		expect(longitudeForAspectPoint('pluto', bodies, axes)).toBeNull();
	});

	it('weights aspect lines by orb tier', () => {
		const style = {
			...DEFAULT_ASPECT_LINE_TIER_STYLE,
			tightThresholdPct: 25,
			mediumThresholdPct: 50,
			looseThresholdPct: 75
		};
		expect(maxOrbForAspectType('trine', { trine: 6 })).toBe(6);
		expect(maxOrbForAspectType('no-such-aspect', {})).toBe(8);
		expect(aspectOrbTier(1, 8, style)).toBe('tight');
		expect(aspectOrbTier(-3, 8, style)).toBe('medium');
		expect(aspectOrbTier(5, 8, style)).toBe('loose');
		expect(aspectOrbTier(7, 8, style)).toBe('outer');
		expect(strokeWidthForAspectTier('tight', style)).toBe(style.widthTight);
		expect(strokeWidthForAspectTier('outer', style)).toBe(style.widthOuter);
		expect(strokeDasharrayForAspectTier('tight', 'dashed', 2)).toBeUndefined();
		expect(strokeDasharrayForAspectTier('outer', 'solid', 2)).toBeUndefined();
		expect(strokeDasharrayForAspectTier('outer', 'dashed', 2)).toBe('6.00 4.00');
		expect(strokeDasharrayForAspectTier('outer', 'dotted', 2)).toBe('0.1 4.80');
	});
});
