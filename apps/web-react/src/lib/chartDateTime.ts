import { formatDate, formatTime } from '@/lib/time/format';

const RFC3339 =
	/^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const NAIVE_FORMATS = [
	/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2})$/
];

/** UTC instant of the given wall-clock fields, or `null` for an impossible date or time. */
function utcInstant(fields: string[], offsetMinutes = 0): Date | null {
	const [year, month, day, hour = 0, minute = 0, second = 0] = fields.map(Number);
	if (hour > 23 || minute > 59 || second > 59) return null;
	const date = new Date(Date.UTC(year!, month! - 1, day!, hour, minute, second));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month! - 1 ||
		date.getUTCDate() !== day
	)
		return null;
	return new Date(date.getTime() - offsetMinutes * 60_000);
}

/**
 * A chart date-time string as an instant, or `null` — the same rules as the backend's
 * `parse_event_time` (shared fixture `contracts/event-time.json`), independent of the JS engine:
 * RFC 3339 with an offset; naive `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SS`, `YYYY-MM-DD HH:MM`
 * and `YYYY-MM-DD` read as UTC. Anything else (including impossible dates) is rejected.
 */
export function parseChartDateTime(value?: string | null): Date | null {
	const text = value?.trim();
	if (!text) return null;
	const rfc = RFC3339.exec(text);
	if (rfc) {
		const zone = rfc[8]!;
		const offset =
			zone === 'Z' || zone === 'z'
				? 0
				: (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
		const instant = utcInstant(rfc.slice(1, 7), offset);
		if (instant && rfc[7]) instant.setTime(instant.getTime() + Math.round(Number(rfc[7]) * 1000));
		return instant;
	}
	for (const format of NAIVE_FORMATS) {
		const naive = format.exec(text);
		if (naive) return utcInstant(naive.slice(1));
	}
	return null;
}

/** App-language date and time parts for list display; falls back to splitting the raw string. */
export function splitChartDateTime(value: string): { date: string; time: string } {
	if (!value) return { date: '', time: '' };
	const parsed = parseChartDateTime(value);
	if (parsed) return { date: formatDate(parsed), time: formatTime(parsed, { seconds: false }) };
	const [date = '', time = ''] = value.trim().replace('T', ' ').split(/\s+/, 2);
	return { date, time: time.replace(/Z$/, '') };
}

export type TimeStep = { unit: 'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr'; amount: number };

/** `base` moved by `step` in UTC calendar units. */
export function addUtcStep(base: Date, step: TimeStep): Date {
	const next = new Date(base);
	switch (step.unit) {
		case 'sec':
			next.setUTCSeconds(next.getUTCSeconds() + step.amount);
			break;
		case 'min':
			next.setUTCMinutes(next.getUTCMinutes() + step.amount);
			break;
		case 'hr':
			next.setUTCHours(next.getUTCHours() + step.amount);
			break;
		case 'day':
			next.setUTCDate(next.getUTCDate() + step.amount);
			break;
		case 'month':
			next.setUTCMonth(next.getUTCMonth() + step.amount);
			break;
		case 'yr':
			next.setUTCFullYear(next.getUTCFullYear() + step.amount);
			break;
	}
	return next;
}

/** `YYYY-MM-DDTHH:MM:SSZ`, the stored chart date-time format. */
export function formatChartDateTimeUtc(value: Date): string {
	return value.toISOString().slice(0, 19) + 'Z';
}
