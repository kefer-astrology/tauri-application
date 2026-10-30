/** Time-zone choices for manual time entry: IANA zones grouped by region, and fixed UTC offsets. */

const DISCOVERED_TIME_ZONES: string[] =
	typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
		? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
				'timeZone'
			)
		: [];

/** Every IANA zone the platform knows, plus common ones it may omit, sorted. */
export const TIME_ZONES: readonly string[] = Array.from(
	new Set([
		'UTC',
		'Europe/Prague',
		'Europe/London',
		'America/New_York',
		'America/Los_Angeles',
		'Asia/Kolkata',
		'Asia/Kathmandu',
		'Australia/Sydney',
		...DISCOVERED_TIME_ZONES
	])
).sort((a, b) => a.localeCompare(b));

/** First path segment of the zones (`Europe`, `America`, `UTC`, …), sorted. */
export const TIME_ZONE_REGIONS: readonly string[] = Array.from(
	new Set(
		TIME_ZONES.map((zone) => zone.split('/')[0]).filter((region): region is string => !!region)
	)
).sort((a, b) => a.localeCompare(b));

/** `UTC±HH:MM` for an offset in minutes east of UTC. */
export function formatUtcOffset(totalMinutes: number): string {
	const sign = totalMinutes >= 0 ? '+' : '-';
	const magnitude = Math.abs(totalMinutes);
	const hours = String(Math.floor(magnitude / 60)).padStart(2, '0');
	const minutes = String(magnitude % 60).padStart(2, '0');
	return `UTC${sign}${hours}:${minutes}`;
}

/** Fixed offsets from UTC−14:00 to UTC+14:00 in 15-minute steps. */
export const UTC_OFFSET_OPTIONS: readonly string[] = Array.from({ length: 113 }, (_, index) =>
	formatUtcOffset(index * 15 - 14 * 60)
);

export function timeZoneMatchesRegion(zone: string, region: string): boolean {
	return zone === region || zone.startsWith(`${region}/`);
}

/** The region `zone` belongs to, or the first region for a zone outside the catalog. */
export function timeZoneRegion(zone: string): string {
	const region = zone.split('/')[0] ?? '';
	return TIME_ZONE_REGIONS.includes(region) ? region : (TIME_ZONE_REGIONS[0] ?? 'UTC');
}

export function timeZonesInRegion(region: string): string[] {
	return TIME_ZONES.filter((zone) => timeZoneMatchesRegion(zone, region));
}
