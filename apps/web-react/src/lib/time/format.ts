import i18n from '@/lib/i18n/i18n';

/** Date/time display shared by every view, in the app language (not the OS locale), so the same
 *  instant reads the same everywhere. Inputs that do not parse are returned as given. */

export type DateInput = Date | number | string;

function toDate(value: DateInput): Date | null {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions, locale?: string): string {
	const date = toDate(value);
	if (!date) return String(value);
	return date.toLocaleString(locale ?? i18n.language, options);
}

/** Numeric date, e.g. `14. 7. 1984`. Pass `options` to change the parts (e.g. `month: 'short'`). */
export function formatDate(
	value: DateInput,
	options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' },
	locale?: string
): string {
	return format(value, options, locale);
}

/** Time of day; seconds are shown unless `seconds: false`. `timeZone` defaults to the platform's. */
export function formatTime(
	value: DateInput,
	{ seconds = true, timeZone }: { seconds?: boolean; timeZone?: string } = {},
	locale?: string
): string {
	return format(
		value,
		{
			hour: '2-digit',
			minute: '2-digit',
			...(seconds ? { second: '2-digit' } : {}),
			...(timeZone ? { timeZone } : {})
		},
		locale
	);
}

/** Date and time together, e.g. for event lists, tooltips and chart axes. */
export function formatDateTime(
	value: DateInput,
	options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	},
	locale?: string
): string {
	return format(value, options, locale);
}

export function formatDateTimeRange(from: DateInput, to: DateInput, locale?: string): string {
	return `${formatDateTime(from, undefined, locale)} → ${formatDateTime(to, undefined, locale)}`;
}
