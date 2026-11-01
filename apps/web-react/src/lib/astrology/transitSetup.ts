/** The transit setup: what to compute (bodies, aspects, period, sampling, event searches), its
 *  defaults, its saved form (`TransitSetup`) and the request it turns into. */

import { addMonths, addYears } from 'date-fns';
import { DEFAULT_ENABLED_ASPECT_IDS } from '@/lib/astrology/aspects';
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import type { AppChart } from '@/lib/tauri/chartPayload';
import type {
	ConfigurationSearchRequest,
	ConfigurationSearchSetup,
	TransitEventSearch,
	TransitSetup
} from '@/lib/tauri/types';

const BROWSER_TRANSIT_BODY_FALLBACK = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

/** The Rust model's default bodies (a fixed list in browser mode): the default transited (natal)
 *  selection, so transits are read against the whole chart. */
export function getDefaultBodyIds(): string[] {
	return DOMAIN_CATALOG?.model.settings?.default_bodies?.length
		? [...DOMAIN_CATALOG.model.settings.default_bodies]
		: [...BROWSER_TRANSIT_BODY_FALLBACK];
}

/** Default transiting bodies: the slow planets, whose transits last long enough to matter over a
 *  period. Only the starting selection; any object can be added. */
export const DEFAULT_TRANSITING_BODY_IDS = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** Static basic aspects; the runtime aspect catalog may still be empty at module load. */
export const DEFAULT_TRANSIT_ASPECT_IDS: readonly string[] = DEFAULT_ENABLED_ASPECT_IDS;

/** Period choices in display order. `current` computes one instant (now); `custom` uses the edited
 *  range; every other id is a fixed window around "now", set when it is chosen. */
export const PERIOD_PRESET_IDS = [
	'current',
	'next_3_months',
	'next_6_months',
	'previous_3_months',
	'previous_6_months',
	'next_year',
	'previous_year',
	'custom'
] as const;

export type PeriodPresetId = (typeof PERIOD_PRESET_IDS)[number];

const PERIOD_PRESET_RANGES: Partial<Record<PeriodPresetId, (now: Date) => [Date, Date]>> = {
	next_3_months: (now) => [now, addMonths(now, 3)],
	next_6_months: (now) => [now, addMonths(now, 6)],
	previous_3_months: (now) => [addMonths(now, -3), now],
	previous_6_months: (now) => [addMonths(now, -6), now],
	next_year: (now) => [now, addYears(now, 1)],
	previous_year: (now) => [addYears(now, -1), now]
};

/** The fixed `[from, to]` window of a period preset, or `null` for `current`, `custom` and
 *  unknown ids (their range is not derived from the preset). */
export function periodPresetRange(id: string, now: Date): [Date, Date] | null {
	return PERIOD_PRESET_RANGES[id as PeriodPresetId]?.(now) ?? null;
}

/** Fallback label for a period id without a translation (`next_3_months` → `Next 3 Months`). */
export function humanizePeriodPresetId(id: string): string {
	return id.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export type TimeStepUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export const TIME_STEP_UNITS: readonly TimeStepUnit[] = ['seconds', 'minutes', 'hours', 'days'];

export const TIME_STEP_UNIT_SECONDS: Record<TimeStepUnit, number> = {
	seconds: 1,
	minutes: 60,
	hours: 3600,
	days: 86400
};

/** Largest unit that divides `seconds` evenly, so a saved step (3600 s) edits back as 1 hour. */
export function secondsToStep(seconds: number): { value: number; unit: TimeStepUnit } {
	for (const unit of ['days', 'hours', 'minutes', 'seconds'] as const) {
		const perUnit = TIME_STEP_UNIT_SECONDS[unit];
		if (seconds % perUnit === 0 && seconds / perUnit >= 1) {
			return { value: seconds / perUnit, unit };
		}
	}
	return { value: Math.max(1, Math.round(seconds)), unit: 'seconds' };
}

/** Sampling step in whole seconds, at least 1. */
export function stepToSeconds(value: number, unit: TimeStepUnit): number {
	return Math.max(1, Math.round(value) * TIME_STEP_UNIT_SECONDS[unit]);
}

/** Expected sample count of a custom range (1 for every other period, or an empty range). */
export function estimateSampleCount(
	periodModeId: string,
	from: Date,
	to: Date,
	stepSeconds: number
): number {
	if (periodModeId !== 'custom') return 1;
	const durationSeconds = (to.getTime() - from.getTime()) / 1000;
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1;
	return Math.floor(durationSeconds / stepSeconds) + 1;
}

export interface TransitSetupState {
	/** `transit` (primary / secondary directions are not available yet). */
	selectedTypeId: string;
	periodModeId: string;
	/** Period bounds, edited as the machine's local date and time. */
	fromDateTime: Date;
	toDateTime: Date;
	/** Swept across the period and recomputed at every sample. */
	transitingBodies: string[];
	/** Held at the source chart's moment (the natal anchors). */
	transitedBodies: string[];
	selectedAspects: string[];
	timeStepValue: number;
	timeStepUnit: TimeStepUnit;
	/** Not implemented yet; shown disabled and saved as is. */
	checkboxes: {
		houseTransitions: boolean;
		signTransitions: boolean;
		transitLimits: boolean;
		precessionCorrection: boolean;
	};
	/** Root-found exact aspect hits and stations (`exact_hits` / `station_events`). */
	exactHits: boolean;
	stationEvents: boolean;
	/** Whether the sampled series (graph and hit table) is computed. */
	sampledGraphOutput: boolean;
	configurationSearches: ConfigurationSearchRequest[];
}

/** A fresh setup: transits for now (custom range now → +1 day), hourly sampling. */
export function defaultTransitSetup(now: Date): TransitSetupState {
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	return {
		selectedTypeId: 'transit',
		periodModeId: 'current',
		fromDateTime: now,
		toDateTime: tomorrow,
		transitingBodies: [...DEFAULT_TRANSITING_BODY_IDS],
		transitedBodies: getDefaultBodyIds(),
		selectedAspects: [...DEFAULT_TRANSIT_ASPECT_IDS],
		timeStepValue: 1,
		timeStepUnit: 'hours',
		checkboxes: {
			houseTransitions: false,
			signTransitions: false,
			transitLimits: false,
			precessionCorrection: false
		},
		exactHits: false,
		stationEvents: false,
		sampledGraphOutput: true,
		configurationSearches: []
	};
}

const pad = (value: number) => String(value).padStart(2, '0');

function formatDateInput(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date: Date): string {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Saved `YYYY-MM-DD` + `HH:MM` as machine-local time, or `fallback` when it does not parse. */
function parseLocalDateTime(dateValue: string, timeValue: string, fallback: Date): Date {
	const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
	return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function configurationRequestsToDto(
	searches: readonly ConfigurationSearchRequest[]
): ConfigurationSearchSetup[] {
	return searches.map((entry) => ({
		configuration_id: entry.configurationId,
		fixed_roles: entry.fixedRoles ?? [],
		role_candidates: entry.roleCandidates ?? {}
	}));
}

/** A saved setup applied over `current` (whose period bounds are kept when a saved one does not
 *  parse). Fields missing from older setups take the backend's defaults. */
export function transitSetupFromDto(
	dto: TransitSetup,
	current: TransitSetupState
): TransitSetupState {
	const step = secondsToStep(dto.time_step_seconds);
	return {
		selectedTypeId: dto.transit_type,
		periodModeId: dto.period_mode,
		fromDateTime: parseLocalDateTime(dto.from_date, dto.from_time, current.fromDateTime),
		toDateTime: parseLocalDateTime(dto.to_date, dto.to_time, current.toDateTime),
		transitingBodies: dto.transiting_bodies,
		transitedBodies: dto.transited_bodies,
		selectedAspects: dto.aspect_types,
		timeStepValue: step.value,
		timeStepUnit: step.unit,
		checkboxes: {
			houseTransitions: dto.house_transitions,
			signTransitions: dto.sign_transitions,
			transitLimits: dto.transit_limits,
			precessionCorrection: dto.precession_correction
		},
		exactHits: dto.exact_hits ?? false,
		stationEvents: dto.station_events ?? false,
		sampledGraphOutput: dto.sampled_series ?? true,
		configurationSearches: (dto.configuration_requests ?? []).map((entry) => ({
			configurationId: entry.configuration_id as ConfigurationSearchRequest['configurationId'],
			fixedRoles: entry.fixed_roles,
			roleCandidates: entry.role_candidates
		}))
	};
}

/** The setup as saved in the workspace for `sourceChart`. */
export function transitSetupToDto(state: TransitSetupState, sourceChart: AppChart): TransitSetup {
	return {
		version: 1,
		source_chart_id: sourceChart.id,
		transit_type: state.selectedTypeId,
		period_mode: state.periodModeId,
		from_date: formatDateInput(state.fromDateTime),
		from_time: formatTimeInput(state.fromDateTime),
		to_date: formatDateInput(state.toDateTime),
		to_time: formatTimeInput(state.toDateTime),
		time_step_seconds: stepToSeconds(state.timeStepValue, state.timeStepUnit),
		transiting_bodies: state.transitingBodies,
		transited_bodies: state.transitedBodies,
		aspect_types: state.selectedAspects,
		aspect_orbs: sourceChart.aspectOrbs ?? {},
		model: sourceChart.model ?? null,
		model_overrides: sourceChart.modelOverrides ?? null,
		house_transitions: state.checkboxes.houseTransitions,
		sign_transitions: state.checkboxes.signTransitions,
		exact_hits: state.exactHits,
		station_events: state.stationEvents,
		sampled_series: state.sampledGraphOutput,
		configuration_requests: configurationRequestsToDto(state.configurationSearches),
		transit_limits: state.checkboxes.transitLimits,
		precession_correction: state.checkboxes.precessionCorrection
	};
}

/** The requested time range as UTC ISO strings: an explicit range, else one instant (now) for
 *  `current`, else the setup's bounds. */
export function transitRequestRange(
	state: Pick<TransitSetupState, 'periodModeId' | 'fromDateTime' | 'toDateTime'>,
	override: { start: Date; end: Date } | undefined,
	now: Date
): { startDatetime: string; endDatetime: string } {
	if (override) {
		return { startDatetime: override.start.toISOString(), endDatetime: override.end.toISOString() };
	}
	if (state.periodModeId === 'current') {
		const instant = now.toISOString();
		return { startDatetime: instant, endDatetime: instant };
	}
	return {
		startDatetime: state.fromDateTime.toISOString(),
		endDatetime: state.toDateTime.toISOString()
	};
}

export const EMPTY_EVENT_SEARCH: TransitEventSearch = {
	events: [],
	configuration_matches: [],
	complete: true,
	warnings: []
};
