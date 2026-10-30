/** Time-zone math for chart times: IANA zones (`Europe/Prague`) and fixed offsets
 *  (`UTC+02:00`, `GMT-3`, `UTC`). Uses the platform `Intl` time-zone database. */

/** Wall-clock fields; `month` is 0-based like `Date`. */
export interface WallTime {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

/** Offset of a fixed-offset zone name in milliseconds, or `null` if `zone` is not one. */
export function fixedUtcOffsetMilliseconds(zone: string): number | null {
	if (/^(UTC|GMT)$/i.test(zone)) return 0;
	const match = /^(?:UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(zone);
	if (!match) return null;
	const hours = Number(match[2]);
	const minutes = Number(match[3] ?? 0);
	if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
	const milliseconds = (hours * 60 + minutes) * 60_000;
	return match[1] === '+' ? milliseconds : -milliseconds;
}

function ianaParts(zone: string, instant: Date): WallTime | null {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(instant);
		const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
		return {
			year: value('year'),
			month: value('month') - 1,
			day: value('day'),
			hour: value('hour'),
			minute: value('minute'),
			second: value('second')
		};
	} catch {
		// Unknown zone name.
		return null;
	}
}

const wallTimeAsUtc = (wall: WallTime) =>
	Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);

/** UTC offset of `zone` at `instant` in milliseconds, or `null` for an unknown zone. */
export function zoneOffsetMs(zone: string, instant: Date): number | null {
	const fixed = fixedUtcOffsetMilliseconds(zone.trim());
	if (fixed !== null) return fixed;
	const parts = ianaParts(zone.trim(), instant);
	return parts ? wallTimeAsUtc(parts) - instant.getTime() : null;
}

/** Wall-clock fields of `instant` in `zone`, or `null` for an unknown zone. */
export function instantToZonedParts(instant: Date, zone: string): WallTime | null {
	const offset = zoneOffsetMs(zone, instant);
	if (offset === null) return null;
	const shifted = new Date(instant.getTime() + offset);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth(),
		day: shifted.getUTCDate(),
		hour: shifted.getUTCHours(),
		minute: shifted.getUTCMinutes(),
		second: shifted.getUTCSeconds()
	};
}

/**
 * The instant at which the clocks in `zone` show `wall`, or `null` for an unknown zone. Times in
 * a DST gap or overlap resolve to the zone's offset just before the transition, without failing
 * (strict checks for interactive input live in `wallTimeToUtcIso`).
 */
export function wallTimeToInstant(wall: WallTime, zone: string): Date | null {
	const asUtc = wallTimeAsUtc(wall);
	const first = zoneOffsetMs(zone, new Date(asUtc));
	if (first === null) return null;
	const corrected = zoneOffsetMs(zone, new Date(asUtc - first)) ?? first;
	return new Date(asUtc - corrected);
}
