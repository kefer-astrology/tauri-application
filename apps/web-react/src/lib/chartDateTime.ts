import { formatDateTime } from '@/lib/time/format';
import { instantToZonedParts, wallTimeToInstant, type WallTime } from '@/lib/time/zone';

const RFC3339 =
	/^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const NAIVE_FORMATS = [
	/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
	/^(\d{4})-(\d{2})-(\d{2})$/
];

/** Wall-clock fields from matched `YYYY MM DD [hh mm [ss]]` strings, or `null` if impossible. */
function wallTime(fields: string[]): WallTime | null {
	const [year, month, day, hour = 0, minute = 0, second = 0] = fields.map(Number);
	if (hour > 23 || minute > 59 || second > 59) return null;
	const check = new Date(Date.UTC(year!, month! - 1, day!));
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month! - 1 ||
		check.getUTCDate() !== day
	)
		return null;
	return { year: year!, month: month! - 1, day: day!, hour, minute, second };
}

const utcOf = (wall: WallTime) =>
	new Date(Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second));

/** The zone a chart's wall-clock time belongs to: its manual UTC offset when the time regime is
 *  manual, otherwise its IANA zone (same rule as the New horoscope form). */
export function chartTimeZone(chart: {
	timezone?: string | null;
	utcOffset?: string | null;
	timeRegime?: 'auto' | 'manual' | null;
}): string | undefined {
	const offset = chart.utcOffset?.trim();
	if (chart.timeRegime === 'manual' && offset && offset !== 'auto') return offset;
	return chart.timezone?.trim() || undefined;
}

/**
 * A chart date-time string as an instant, or `null`, independent of the JS engine. Accepts the
 * backend's formats (shared fixture `contracts/event-time.json`): RFC 3339 keeps its offset; the
 * naive `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SS`, `YYYY-MM-DD HH:MM` and `YYYY-MM-DD` are
 * wall-clock time at the event's place (`zone`), or UTC — the backend's reading — without one.
 * Anything else, including impossible dates, is rejected.
 */
export function parseChartDateTime(value?: string | null, zone?: string): Date | null {
	const text = value?.trim();
	if (!text) return null;
	const rfc = RFC3339.exec(text);
	if (rfc) {
		const zone = rfc[8]!;
		const offset =
			zone === 'Z' || zone === 'z'
				? 0
				: (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
		const wall = wallTime(rfc.slice(1, 7));
		if (!wall) return null;
		const fraction = rfc[7] ? Math.round(Number(rfc[7]) * 1000) : 0;
		return new Date(utcOf(wall).getTime() - offset * 60_000 + fraction);
	}
	for (const format of NAIVE_FORMATS) {
		const naive = format.exec(text);
		if (!naive) continue;
		const wall = wallTime(naive.slice(1));
		if (!wall) return null;
		return (zone && wallTimeToInstant(wall, zone)) || utcOf(wall);
	}
	return null;
}

/** A chart time as the backend should receive it: an exact UTC instant (`…Z`), with naive input
 *  read in `zone`. Unparseable input is passed through for the backend to reject. */
export function toEventTimeIso(value: string | null | undefined, zone?: string): string | null {
	const text = value?.trim();
	if (!text) return null;
	const instant = parseChartDateTime(text, zone);
	return instant ? formatChartDateTimeUtc(instant) : text;
}

/** Wall-clock fields of a chart time at the event's place (or UTC without a zone). */
export function chartLocalParts(value: string | null | undefined, zone?: string): WallTime | null {
	const instant = parseChartDateTime(value, zone);
	if (!instant) return null;
	return (zone && instantToZonedParts(instant, zone)) || instantToZonedParts(instant, 'UTC');
}

/** A chart time formatted as local time at the event's place (app language), or `null` when it
 *  does not parse. `options` picks the parts, as for `Intl.DateTimeFormat`. */
export function formatChartLocal(
	value: string | null | undefined,
	zone: string | undefined,
	options: Intl.DateTimeFormatOptions
): string | null {
	const parts = chartLocalParts(value, zone);
	// Format the wall-clock fields as-is (in UTC), so the platform's own zone never shifts them.
	return parts ? formatDateTime(utcOf(parts), { ...options, timeZone: 'UTC' }) : null;
}

/** Date and time for list display — local time at the event's place, in the app language. Falls
 *  back to splitting the raw string when it does not parse. */
export function splitChartDateTime(value: string, zone?: string): { date: string; time: string } {
	if (!value) return { date: '', time: '' };
	const localDate = formatChartLocal(value, zone, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	});
	const localTime = formatChartLocal(value, zone, { hour: '2-digit', minute: '2-digit' });
	if (localDate !== null && localTime !== null) return { date: localDate, time: localTime };
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
