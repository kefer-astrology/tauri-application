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
