import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type { TransitSetup } from '@/lib/tauri/types';
import {
	DEFAULT_TRANSITING_BODY_IDS,
	defaultTransitSetup,
	getDefaultBodyIds,
	estimateSampleCount,
	humanizePeriodPresetId,
	periodPresetRange,
	secondsToStep,
	stepToSeconds,
	transitRequestRange,
	transitSetupFromDto,
	transitSetupToDto
} from './transitSetup';

// Period bounds are edited as machine-local time, so build them from local fields.
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);

const sourceChart = {
	id: 'jan',
	aspectOrbs: { conjunction: 8 },
	model: 'modern'
} as unknown as AppChart;

describe('period presets', () => {
	it('derives fixed windows around now, none for current and custom', () => {
		const now = local(2026, 1, 31, 12);
		expect(periodPresetRange('next_3_months', now)).toEqual([now, local(2026, 4, 30, 12)]);
		expect(periodPresetRange('previous_year', now)).toEqual([local(2025, 1, 31, 12), now]);
		expect(periodPresetRange('current', now)).toBeNull();
		expect(periodPresetRange('custom', now)).toBeNull();
		expect(periodPresetRange('unknown', now)).toBeNull();
		expect(humanizePeriodPresetId('next_3_months')).toBe('Next 3 Months');
	});
});

describe('time step', () => {
	it('edits a saved step back in its largest whole unit', () => {
		expect(secondsToStep(3600)).toEqual({ value: 1, unit: 'hours' });
		expect(secondsToStep(172800)).toEqual({ value: 2, unit: 'days' });
		expect(secondsToStep(90)).toEqual({ value: 90, unit: 'seconds' });
		expect(secondsToStep(0.4)).toEqual({ value: 1, unit: 'seconds' });
		expect(stepToSeconds(2.4, 'minutes')).toBe(120);
		expect(stepToSeconds(0, 'hours')).toBe(1);
	});

	it('estimates samples only for a custom range', () => {
		const from = local(2026, 1, 1);
		const to = local(2026, 1, 2);
		expect(estimateSampleCount('custom', from, to, 3600)).toBe(25);
		expect(estimateSampleCount('custom', to, from, 3600)).toBe(1);
		expect(estimateSampleCount('next_year', from, to, 3600)).toBe(1);
	});
});

describe('defaultTransitSetup', () => {
	it('moves the slow planets against the whole natal chart', () => {
		const setup = defaultTransitSetup(new Date());
		expect(setup.transitingBodies).toEqual(DEFAULT_TRANSITING_BODY_IDS);
		expect(setup.transitedBodies).toEqual(getDefaultBodyIds());
		expect(setup.transitedBodies).toEqual(expect.arrayContaining(['sun', 'moon', 'pluto']));
	});
});

describe('saved setup', () => {
	it('round-trips through the workspace form', () => {
		const state = {
			...defaultTransitSetup(local(2026, 3, 1, 9, 15)),
			periodModeId: 'custom',
			toDateTime: local(2026, 3, 5, 18, 45),
			timeStepValue: 6,
			exactHits: true,
			configurationSearches: [{ configurationId: 'yod' as const, fixedRoles: ['apex'] }]
		};
		const dto = transitSetupToDto(state, sourceChart);
		expect(dto).toMatchObject({
			source_chart_id: 'jan',
			period_mode: 'custom',
			from_date: '2026-03-01',
			from_time: '09:15',
			to_date: '2026-03-05',
			to_time: '18:45',
			time_step_seconds: 21600,
			aspect_orbs: { conjunction: 8 },
			model: 'modern',
			model_overrides: null,
			exact_hits: true,
			sampled_series: true,
			configuration_requests: [
				{ configuration_id: 'yod', fixed_roles: ['apex'], role_candidates: {} }
			]
		});
		const back = transitSetupFromDto(dto, defaultTransitSetup(new Date()));
		expect(back).toEqual({
			...state,
			configurationSearches: [{ configurationId: 'yod', fixedRoles: ['apex'], roleCandidates: {} }]
		});
	});

	it('fills fields older setups lack and keeps unparseable bounds', () => {
		const current = defaultTransitSetup(local(2026, 3, 1));
		const dto = {
			...transitSetupToDto(current, sourceChart),
			from_date: 'bad',
			exact_hits: undefined,
			station_events: undefined,
			sampled_series: undefined,
			configuration_requests: undefined
		} as TransitSetup;
		expect(transitSetupFromDto(dto, current)).toMatchObject({
			fromDateTime: current.fromDateTime,
			exactHits: false,
			stationEvents: false,
			sampledGraphOutput: true,
			configurationSearches: []
		});
	});
});

describe('transitRequestRange', () => {
	const state = {
		periodModeId: 'custom',
		fromDateTime: new Date('2026-01-01T00:00:00Z'),
		toDateTime: new Date('2026-02-01T00:00:00Z')
	};
	const now = new Date('2026-10-31T10:00:00Z');

	it('uses an explicit range, then now for current, then the setup bounds', () => {
		const instant = new Date('2026-05-05T05:05:05Z');
		expect(transitRequestRange(state, { start: instant, end: instant }, now)).toEqual({
			startDatetime: '2026-05-05T05:05:05.000Z',
			endDatetime: '2026-05-05T05:05:05.000Z'
		});
		expect(transitRequestRange({ ...state, periodModeId: 'current' }, undefined, now)).toEqual({
			startDatetime: '2026-10-31T10:00:00.000Z',
			endDatetime: '2026-10-31T10:00:00.000Z'
		});
		expect(transitRequestRange(state, undefined, now)).toEqual({
			startDatetime: '2026-01-01T00:00:00.000Z',
			endDatetime: '2026-02-01T00:00:00.000Z'
		});
	});
});
