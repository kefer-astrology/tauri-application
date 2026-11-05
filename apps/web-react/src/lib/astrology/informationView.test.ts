import { describe, expect, it } from 'vitest';
import type { ChartFacts } from '@/lib/tauri/types';
import {
	aspectRows,
	dominantKeys,
	elementRows,
	focalPlanets,
	hemisphereRows,
	highlights,
	houseCounts,
	houseGroupRows,
	missingKeys,
	modalityRows,
	quadrantRows,
	retrogradeSummary,
	singletons
} from './informationView';

type Body = ChartFacts['bodies'][string];
const body = (
	element: Body['element'],
	modality: Body['modality'],
	house: number,
	motion: Body['motion'] = 'direct'
): Body => ({
	sign: 0,
	degree_in_sign: 0,
	element,
	modality,
	house,
	house_group: [1, 4, 7, 10].includes(house)
		? 'active'
		: [2, 5, 8, 11].includes(house)
			? 'reactive'
			: 'resulting',
	motion
});

// Saturn alone in the west (house 5); everything else in the east (houses 10–3).
const facts: ChartFacts = {
	version: 1,
	bodies: {
		sun: body('fire', 'cardinal', 10),
		moon: body('fire', 'fixed', 11),
		mercury: body('air', 'cardinal', 10, 'retrograde'),
		venus: body('air', 'mutable', 12),
		mars: body('fire', 'cardinal', 1),
		jupiter: body('earth', 'fixed', 2),
		saturn: body('earth', 'cardinal', 5, 'retrograde'),
		uranus: body('air', 'fixed', 3, 'retrograde'),
		neptune: body('fire', 'mutable', 1),
		pluto: body('air', 'cardinal', 2),
		chiron: body('water', 'fixed', 7)
	},
	element_counts: { fire: 4, earth: 2, air: 4, water: 0 },
	modality_counts: { cardinal: 5, fixed: 3, mutable: 2 },
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

describe('information view data', () => {
	it('counts elements, modalities and house groups of the planets, with their bodies', () => {
		const elements = elementRows(facts);
		expect(elements.map((r) => [r.key, r.count])).toEqual([
			['fire', 4],
			['earth', 2],
			['air', 4],
			['water', 0]
		]);
		// Chiron is not a planet: water has no bodies.
		expect(elements[3]!.bodies).toEqual([]);
		expect(elements[0]!.bodies).toEqual(['sun', 'moon', 'mars', 'neptune']);
		expect(elements[0]!.share).toBe(0.4);
		expect(dominantKeys(elements)).toEqual(['fire', 'air']);
		expect(missingKeys(elements)).toEqual(['water']);
		expect(dominantKeys(modalityRows(facts))).toEqual(['cardinal']);
		expect(houseGroupRows(facts).map((r) => r.count)).toEqual([4, 4, 2]);
		expect(houseCounts(facts)).toEqual([2, 2, 1, 0, 1, 0, 0, 0, 0, 2, 1, 1]);
	});

	it('splits the chart into quadrants and halves', () => {
		expect(quadrantRows(facts).map((q) => [q.quadrant, q.count, q.share])).toEqual([
			[1, 5, 0.5],
			[2, 1, 0.1],
			[3, 0, 0],
			[4, 4, 0.4]
		]);
		const halves = hemisphereRows(facts);
		expect(halves.map((h) => [h.half, h.count])).toEqual([
			['east', 9],
			['west', 1],
			['upper', 4],
			['lower', 6]
		]);
		expect(halves[1]!.bodies).toEqual(['saturn']);
		expect(singletons(facts)).toEqual([{ half: 'west', body: 'saturn' }]);
	});

	it('finds retrograde planets and halves whose planets are all retrograde', () => {
		const summary = retrogradeSummary(facts);
		expect(summary.retrograde).toEqual(['mercury', 'saturn', 'uranus']);
		expect(summary.total).toBe(10);
		expect(summary.patterns).toEqual([{ half: 'west', bodies: ['saturn'] }]);
	});

	it('lists focal planets with all their roles, in planet order', () => {
		expect(focalPlanets(facts)).toEqual([
			{
				body: 'mars',
				roles: [{ role: 'chart_ruler_traditional' }, { role: 'angular', detail: 'asc' }]
			},
			{ body: 'saturn', roles: [{ role: 'final_dispositor_traditional' }] },
			{ body: 'neptune', roles: [{ role: 'unaspected' }] }
		]);
	});

	it('counts the Ptolemaic aspects', () => {
		expect(aspectRows(facts).map((r) => r.count)).toEqual([3, 1, 4, 2, 0]);
		expect(dominantKeys(aspectRows(facts))).toEqual(['square']);
		expect(missingKeys(aspectRows(facts))).toEqual(['opposition']);
	});

	it('picks the headline facts, leaving out ties', () => {
		const chips = highlights(facts);
		expect(chips.map((c) => c.id)).toEqual([
			// Element is a tie (fire and air): left out.
			'modality',
			// House groups tie too (active and reactive).
			'aspect',
			'stellium-0',
			'singleton-west',
			'final-dispositor',
			'chart-ruler',
			'unaspected-neptune',
			'retrograde',
			'lunar-phase',
			'hemisphere',
			'quadrant'
		]);
		expect(chips.find((c) => c.id === 'singleton-west')!.focus).toEqual({
			bodies: ['saturn'],
			half: 'west'
		});
		expect(chips.find((c) => c.id === 'hemisphere')).toMatchObject({ value: 'east', share: 0.9 });
		expect(chips.find((c) => c.id === 'quadrant')).toMatchObject({ value: '1', share: 0.5 });
	});
});
