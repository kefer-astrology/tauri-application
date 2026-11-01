/** The synastry form: two people (a saved chart, or birth data entered by hand), the calculation
 *  type, and the analysis chart it creates. Hand-entered date and time are wall time at the
 *  person's place, carried in pickers as a `Date`'s local fields. */

import {
	normalizeChartId,
	uniqueChartId,
	type AppChart,
	type SynastryParticipantState
} from '@/lib/tauri/chartPayload';

export type SynastryCalculationType =
	| 'synastry'
	| 'composite'
	| 'davison'
	| 'coalescent'
	| 'progressed-synastry'
	| 'progressed-composite'
	| 'draconic-synastry';

export const SYNASTRY_CALCULATION_TYPES: readonly SynastryCalculationType[] = [
	'synastry',
	'composite',
	'davison',
	'coalescent',
	'progressed-synastry',
	'progressed-composite',
	'draconic-synastry'
];

/** Types that can be saved today: a link between two people. The others need their own
 *  midpoint / relocation computation, which does not exist yet. */
const SUPPORTED_CALCULATION_TYPES = new Set<SynastryCalculationType>([
	'synastry',
	'progressed-synastry',
	'draconic-synastry'
]);

export function isSupportedCalculationType(type: SynastryCalculationType): boolean {
	return SUPPORTED_CALCULATION_TYPES.has(type);
}

/** Types that need a progression date. */
export function isProgressedCalculationType(type: SynastryCalculationType): boolean {
	return type === 'progressed-synastry' || type === 'progressed-composite';
}

export interface SynastryPerson {
	mode: 'database' | 'manual';
	chartId: string;
	/** `YYYY-MM-DD` and `HH:MM:SS`, wall time at the person's place. */
	date: string;
	time: string;
	location: string;
	/** Set only by picking a geocoded place; typed text alone is not enough to save. */
	latitude?: number;
	longitude?: number;
	timezone?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` of a picker `Date`. */
export function localDateValue(value: Date): string {
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** `HH:MM:SS` of a picker `Date`. */
export function localTimeValue(value: Date): string {
	return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

/** A person's date and time as a picker `Date`, or `fallback` when either does not parse. */
export function personDateTime(date: string, time: string, fallback: Date = new Date()): Date {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
	if (!dateMatch || !timeMatch) return fallback;
	return new Date(
		Number(dateMatch[1]),
		Number(dateMatch[2]) - 1,
		Number(dateMatch[3]),
		Number(timeMatch[1]),
		Number(timeMatch[2]),
		Number(timeMatch[3] ?? 0)
	);
}

export function emptyPerson(now: Date, chartId = ''): SynastryPerson {
	return {
		mode: 'database',
		chartId,
		date: localDateValue(now),
		time: localTimeValue(now),
		location: ''
	};
}

/** A saved chart is chosen, or hand-entered data has a date, time and a geocoded place. */
export function isPersonReady(person: SynastryPerson): boolean {
	return person.mode === 'database'
		? Boolean(person.chartId)
		: Boolean(
				person.date &&
				person.time &&
				person.location.trim() &&
				Number.isFinite(person.latitude) &&
				Number.isFinite(person.longitude) &&
				person.timezone
			);
}

/** The person as stored on the synastry: a reference to the saved chart (with a snapshot of its
 *  data), or the hand-entered birth data. */
export function toParticipant(
	person: SynastryPerson,
	charts: readonly AppChart[]
): SynastryParticipantState {
	if (person.mode === 'database') {
		const chart = charts.find((c) => c.id === person.chartId);
		return {
			chartId: person.chartId,
			name: chart?.name,
			dateTime: chart?.dateTime,
			location: chart?.location,
			latitude: chart?.latitude,
			longitude: chart?.longitude,
			timezone: chart?.timezone
		};
	}
	return {
		dateTime: `${person.date} ${person.time}`,
		location: person.location,
		latitude: person.latitude,
		longitude: person.longitude,
		timezone: person.timezone
	};
}

/** The analysis chart for the form. Its own date and place are person A's, so it reads well in
 *  chart lists; the calculation uses both participants. Unnamed, it is called `A & B`. */
export function buildSynastryChart({
	name,
	personA,
	personB,
	calculationType,
	progressionDate,
	charts,
	personLabels
}: {
	name: string;
	personA: SynastryPerson;
	personB: SynastryPerson;
	calculationType: SynastryCalculationType;
	progressionDate: string;
	charts: readonly AppChart[];
	/** Names for people without one (hand-entered). */
	personLabels: { a: string; b: string };
}): AppChart {
	const participantA = toParticipant(personA, charts);
	const participantB = toParticipant(personB, charts);
	const chartName =
		name.trim() ||
		`${participantA.name ?? personLabels.a} & ${participantB.name ?? personLabels.b}`;
	return {
		id: uniqueChartId(normalizeChartId(chartName), new Set(charts.map((c) => c.id))),
		name: chartName,
		entityKind: 'analysis',
		entityPersisted: false,
		chartType: 'SYNASTRY',
		dateTime: participantA.dateTime ?? '',
		location: participantA.location ?? '',
		latitude: participantA.latitude,
		longitude: participantA.longitude,
		timezone: participantA.timezone,
		tags: [],
		synastry: {
			method: calculationType,
			personA: participantA,
			personB: participantB,
			progressionDate: isProgressedCalculationType(calculationType) ? progressionDate : undefined
		}
	};
}

/** Today's date (`YYYY-MM-DD`) on this machine. */
export function todayInputValue(now: Date = new Date()): string {
	return localDateValue(now);
}
