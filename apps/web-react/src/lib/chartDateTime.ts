import { formatDate, formatTime } from '@/lib/time/format';

/** A chart's stored date-time string as a `Date`, or `null` when it does not parse. */
export function parsedChartDate(value: string): Date | null {
	const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** App-language date and time parts for list display; falls back to splitting the raw string. */
export function splitChartDateTime(value: string): { date: string; time: string } {
	if (!value) return { date: '', time: '' };
	const parsed = new Date(value);
	if (!Number.isNaN(parsed.getTime())) {
		return { date: formatDate(parsed), time: formatTime(parsed, { seconds: false }) };
	}
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

/**
 * A chart date-time string as a `Date`, or `null`. ISO strings keep their offset. A bare
 * `YYYY-MM-DD HH:MM[:SS]` is parsed by the JS engine first (local time where supported) and only
 * read as UTC when the engine rejects it, so that form is engine-dependent; stored charts use ISO.
 */
export function parseChartDateTimeUtc(value?: string): Date | null {
	if (!value?.trim()) return null;
	const direct = new Date(value);
	if (!Number.isNaN(direct.getTime())) return direct;

	const normalized = value.includes('T')
		? value
		: /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/.test(value)
			? value.replace(' ', 'T') + 'Z'
			: value;
	const normalizedDate = new Date(normalized);
	if (!Number.isNaN(normalizedDate.getTime())) return normalizedDate;

	return null;
}

/** `YYYY-MM-DDTHH:MM:SSZ`, the stored chart date-time format. */
export function formatChartDateTimeUtc(value: Date): string {
	return value.toISOString().slice(0, 19) + 'Z';
}
