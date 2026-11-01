import { describe, expect, it } from 'vitest';
import type { ChartFacts } from '@/lib/tauri/types';
import { countMatches, emptyFactFilters, factFiltersMatch, type FactFilters } from './factFilters';

const facts = {
	bodies: {
		mercury: { motion: 'retrograde', sign: 0, house: 1 },
		mars: { sign: 4, house: 5 }
	},
	element_counts: { fire: 5, earth: 2, air: 2, water: 1 },
	modality_counts: { cardinal: 4, fixed: 3, mutable: 3 },
	house_group_counts: { active: 6, reactive: 2, resulting: 2 },
	distribution: { east: 10, west: 0, upper: 3, lower: 7, quadrants: [4, 3, 1, 2], placed: 10 },
	orientation: { extroverted: 7, introverted: 3, balance: 'extroversion' },
	aspect_counts: { conjunction: 6, opposition: 1, trine: 3, square: 2, sextile: 0 },
	unaspected: ['neptune'],
	stelliums: [{ kind: 'chain', members: ['sun', 'mercury', 'venus', 'mars'] }],
	angular_planets: [
		{ body: 'mars', axis: 'asc', orb: 2 },
		{ body: 'sun', axis: 'asc', orb: 3 }
	],
	lunar_cycle_phase: 'balsamic',
	mercury_phase: 'prometheus',
	venus_phase: 'evening_star',
	sun_horizon: 'above',
	moon_horizon: 'below',
	chart_ruler: { traditional: 'mars', modern: 'mars' },
	final_dispositors: { traditional: { status: 'none' }, modern: { status: 'single', body: 'sun' } }
} as unknown as ChartFacts;

const matches = (patch: Partial<FactFilters>) =>
	factFiltersMatch(facts, { ...emptyFactFilters(), ...patch });

describe('factFiltersMatch', () => {
	it('passes everything without active filters, and needs facts once one is active', () => {
		expect(matches({})).toBe(true);
		expect(factFiltersMatch(null, { ...emptyFactFilters(), orientation: 'balanced' })).toBe(false);
	});

	it('stellium size, kind and required planets', () => {
		const stellium = { id: 1, kind: 'chain' as const, sign: '', house: '', required: ['sun'] };
		expect(matches({ stelliums: [{ ...stellium, size: '4' }] })).toBe(true);
		expect(matches({ stelliums: [{ ...stellium, size: '5' }] })).toBe(false);
	});

	it('hemispheres require every placed planet', () => {
		expect(matches({ hemispheres: ['east'] })).toBe(true);
		expect(matches({ hemispheres: ['lower'] })).toBe(false);
	});

	it('counts: exact, or more, dominant', () => {
		const fire = (value: string, orMore: boolean) => ({
			...emptyFactFilters().elements,
			fire: { value, orMore }
		});
		expect(matches({ elements: fire('4', true) })).toBe(true);
		expect(matches({ elements: fire('4', false) })).toBe(false);
		const aspect = (id: 'conjunction' | 'trine') => ({
			...emptyFactFilters().aspects,
			[id]: { value: 'dominant', orMore: false }
		});
		expect(matches({ aspects: aspect('conjunction') })).toBe(true);
		expect(matches({ aspects: aspect('trine') })).toBe(false);
		expect(countMatches(0, { value: '0', orMore: false })).toBe(true);
	});

	it('Mercury phase with motion, horizon, lunar phase, unaspected', () => {
		expect(matches({ mercury: { phase: 'prometheus', motion: 'retrograde' } })).toBe(true);
		expect(matches({ horizon: 'sun_above_moon_below' })).toBe(true);
		expect(matches({ lunarPhases: ['balsamic', 'new_moon'] })).toBe(true);
		expect(matches({ unaspected: ['neptune'] })).toBe(true);
	});

	it('angular planets, chart ruler, dispositors', () => {
		expect(matches({ angular: { planet: 'mars', axis: '', multiple: true } })).toBe(true);
		expect(matches({ angular: { planet: '', axis: 'mc', multiple: false } })).toBe(false);
		expect(matches({ ruler: { system: 'modern', planet: 'mars', sign: '4', house: '5' } })).toBe(
			true
		);
		expect(matches({ dispositorTraditional: 'none', dispositorModern: 'sun' })).toBe(true);
	});
});
