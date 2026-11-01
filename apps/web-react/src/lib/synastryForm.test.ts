import { describe, expect, it } from 'vitest';
import type { AppChart } from './tauri/chartPayload';
import {
	buildSynastryChart,
	emptyPerson,
	isPersonReady,
	isProgressedCalculationType,
	isSupportedCalculationType,
	personDateTime,
	todayInputValue,
	toParticipant,
	type SynastryPerson
} from './synastryForm';

const chart = (id: string, name: string): AppChart => ({
	id,
	name,
	chartType: 'NATAL',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague',
	latitude: 50.08,
	longitude: 14.42,
	timezone: 'Europe/Prague',
	tags: []
});

const charts = [chart('jan', 'Jan'), chart('eva', 'Eva')];

const manual: SynastryPerson = {
	mode: 'manual',
	chartId: '',
	date: '1990-02-03',
	time: '04:05:06',
	location: 'Brno',
	latitude: 49.2,
	longitude: 16.6,
	timezone: 'Europe/Prague'
};

describe('synastry form', () => {
	it('starts people at the given moment as picker wall time', () => {
		const now = new Date(2026, 9, 31, 8, 7, 6);
		expect(emptyPerson(now, 'jan')).toEqual({
			mode: 'database',
			chartId: 'jan',
			date: '2026-10-31',
			time: '08:07:06',
			location: ''
		});
		expect(todayInputValue(now)).toBe('2026-10-31');
		const date = personDateTime('1990-02-03', '04:05');
		expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
			1990, 1, 3, 4
		]);
		const fallback = new Date(0);
		expect(personDateTime('bad', '04:05', fallback)).toBe(fallback);
	});

	it('needs a chosen chart, or hand-entered data with a geocoded place', () => {
		expect(isPersonReady(emptyPerson(new Date()))).toBe(false);
		expect(isPersonReady(emptyPerson(new Date(), 'jan'))).toBe(true);
		expect(isPersonReady(manual)).toBe(true);
		expect(isPersonReady({ ...manual, latitude: undefined })).toBe(false);
		expect(isPersonReady({ ...manual, timezone: undefined })).toBe(false);
	});

	it('knows which types can be saved and which need a progression date', () => {
		expect(isSupportedCalculationType('synastry')).toBe(true);
		expect(isSupportedCalculationType('composite')).toBe(false);
		expect(isProgressedCalculationType('progressed-synastry')).toBe(true);
		expect(isProgressedCalculationType('draconic-synastry')).toBe(false);
	});

	it('stores a saved chart by reference and hand-entered data as wall time with its zone', () => {
		expect(toParticipant(emptyPerson(new Date(), 'eva'), charts)).toMatchObject({
			chartId: 'eva',
			name: 'Eva',
			timezone: 'Europe/Prague'
		});
		expect(toParticipant(manual, charts)).toEqual({
			dateTime: '1990-02-03 04:05:06',
			location: 'Brno',
			latitude: 49.2,
			longitude: 16.6,
			timezone: 'Europe/Prague'
		});
	});

	it('builds the analysis chart from person A, named after both people', () => {
		const base = {
			name: '  ',
			personA: emptyPerson(new Date(), 'jan'),
			personB: manual,
			progressionDate: '2026-01-01',
			charts,
			personLabels: { a: 'Person A', b: 'Person B' }
		};
		const synastry = buildSynastryChart({ ...base, calculationType: 'synastry' });
		expect(synastry).toMatchObject({
			name: 'Jan & Person B',
			chartType: 'SYNASTRY',
			entityKind: 'analysis',
			dateTime: '1984-07-14T13:30:00Z',
			location: 'Prague',
			synastry: { method: 'synastry', progressionDate: undefined }
		});
		const progressed = buildSynastryChart({
			...base,
			name: 'Jan',
			calculationType: 'progressed-synastry'
		});
		expect(progressed.name).toBe('Jan');
		expect(progressed.id).not.toBe('jan');
		expect(progressed.synastry?.progressionDate).toBe('2026-01-01');
	});
});
