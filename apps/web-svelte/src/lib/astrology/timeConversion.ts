// Wall-clock <-> UTC and calendar-system conversions for the New/Edit Radix form.
// Ported from apps/web-react/src/lib/tauri/chartPayload.ts to keep both frontends
// producing the same RFC3339-with-offset timestamps the shared Rust backend expects
// (naive timestamps without an offset are interpreted as UTC — see src-tauri/src/event_time.rs).

export type TimeSystem = 'gregorian' | 'julian_calendar' | 'julian_day';

export function supportedTimeSystem(value?: string | null): TimeSystem {
  return value === 'julian_day' || value === 'julian_calendar' ? value : 'gregorian';
}

const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;

export function utcDateToJulianDay(value: Date): number {
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
  return value.getTime() / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}

export function julianDayToUtcIso(value: string | number): string {
  const julianDay = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(julianDay)) throw new Error('Julian Day must be a finite number.');
  const result = new Date((julianDay - UNIX_EPOCH_JULIAN_DAY) * MILLISECONDS_PER_DAY);
  if (!Number.isFinite(result.getTime())) throw new Error('Julian Day is outside the supported range.');
  return result.toISOString();
}

function parseJulianCalendarDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error('Julian calendar date must use YYYY-MM-DD.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthLengths = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]!) {
    throw new Error('Invalid Julian calendar date.');
  }
  return { year, month, day };
}

function julianCalendarJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

function gregorianDateFromJdn(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10)
  };
}

export function julianCalendarDateToGregorianWallDate(value: string, time: Date): Date {
  const julian = parseJulianCalendarDate(value);
  const gregorian = gregorianDateFromJdn(julianCalendarJdn(julian.year, julian.month, julian.day));
  const result = new Date(time);
  result.setDate(1);
  result.setFullYear(gregorian.year, gregorian.month - 1, gregorian.day);
  if (!Number.isFinite(result.getTime())) throw new Error('Julian calendar date is unsupported.');
  return result;
}

export function gregorianWallDateToJulianCalendarDate(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const jm = Math.floor((5 * e + 2) / 153);
  const julianDay = e - Math.floor((153 * jm + 2) / 5) + 1;
  const julianMonth = jm + 3 - 12 * Math.floor(jm / 10);
  const julianYear = d - 4800 + Math.floor(jm / 10);
  return `${String(julianYear).padStart(4, '0')}-${String(julianMonth).padStart(2, '0')}-${String(julianDay).padStart(2, '0')}`;
}

function fixedUtcOffsetMilliseconds(timezone: string): number | null {
  if (/^(UTC|GMT)$/i.test(timezone)) return 0;
  const match = /^(?:UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(timezone);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  const milliseconds = (hours * 60 + minutes) * 60_000;
  return match[1] === '+' ? milliseconds : -milliseconds;
}

function ianaWallTimeParts(timezone: string, instant: Date): number[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  ];
}

function ianaOffsetMilliseconds(timezone: string, instant: Date): number {
  const values = ianaWallTimeParts(timezone, instant);
  const representedAsUtc = Date.UTC(values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!);
  return representedAsUtc - instant.getTime();
}

function wallTimeParts(value: Date): number[] {
  return [value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds()];
}

function sameWallTime(left: number[], right: number[]): boolean {
  return left.every((value, index) => value === right[index]);
}

/** Convert the form's wall-clock fields in `timezone` into one unambiguous UTC instant. */
export function wallTimeToUtcIso(value: Date, timezone: string, utcOffset?: string): string {
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid date or time.');
  const normalizedTimezone = timezone.trim();
  if (!normalizedTimezone) throw new Error('Timezone is required.');

  const wallTimeUtc = Date.UTC(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
    value.getSeconds()
  );
  const explicitOffset = utcOffset?.trim();
  const fixedOffset = fixedUtcOffsetMilliseconds(explicitOffset ?? normalizedTimezone);
  if (explicitOffset && fixedOffset === null) {
    throw new Error(`Invalid UTC offset: ${explicitOffset}`);
  }
  if (fixedOffset !== null) return new Date(wallTimeUtc - fixedOffset).toISOString();

  let candidate = new Date(wallTimeUtc);
  const offset = ianaOffsetMilliseconds(normalizedTimezone, candidate);
  candidate = new Date(wallTimeUtc - offset);
  const correctedOffset = ianaOffsetMilliseconds(normalizedTimezone, candidate);
  if (correctedOffset !== offset) candidate = new Date(wallTimeUtc - correctedOffset);

  const expectedWallTime = wallTimeParts(value);
  if (!sameWallTime(ianaWallTimeParts(normalizedTimezone, candidate), expectedWallTime)) {
    throw new Error(`The selected local time does not exist in ${normalizedTimezone}.`);
  }

  for (let deltaMinutes = -180; deltaMinutes <= 180; deltaMinutes += 15) {
    if (deltaMinutes === 0) continue;
    const alternative = new Date(candidate.getTime() + deltaMinutes * 60_000);
    if (sameWallTime(ianaWallTimeParts(normalizedTimezone, alternative), expectedWallTime)) {
      throw new Error(`The selected local time occurs twice in ${normalizedTimezone}; choose a UTC offset.`);
    }
  }
  return candidate.toISOString();
}

function parseUtcOffsetMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '+' ? minutes : -minutes;
}

/** Convert a stored UTC dateTime string back into wall-clock fields for `timezone`. */
export function parseDateTimeString(dateTime: string, timezone?: string, utcOffset?: string): Date {
  if (!dateTime) return new Date();
  const normalized = dateTime.includes('T') ? dateTime : dateTime.replace(' ', 'T');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return new Date();
  if (!timezone || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) return d;
  const offsetMinutes = parseUtcOffsetMinutes(utcOffset ?? timezone);
  if (offsetMinutes !== null) {
    const wallTime = new Date(d.getTime() + offsetMinutes * 60_000);
    return new Date(
      wallTime.getUTCFullYear(),
      wallTime.getUTCMonth(),
      wallTime.getUTCDate(),
      wallTime.getUTCHours(),
      wallTime.getUTCMinutes(),
      wallTime.getUTCSeconds()
    );
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(d);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
  } catch {
    return d;
  }
}

export function formatCoordinateMagnitude(value: number): string {
  return Math.abs(value).toFixed(4);
}

export type LatDir = 'north' | 'south';
export type LonDir = 'east' | 'west';

export function signedCoordinate(
  value: string,
  positiveDirection: LatDir | LonDir,
  selectedDirection: LatDir | LonDir
): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return selectedDirection === positiveDirection ? Math.abs(parsed) : -Math.abs(parsed);
}

const DISCOVERED_TIMEZONES: string[] =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
    : [];

export const TIMEZONES = Array.from(
  new Set([
    'UTC',
    'Europe/Prague',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Australia/Sydney',
    ...DISCOVERED_TIMEZONES
  ])
).sort((a, b) => a.localeCompare(b));

export const TIMEZONE_REGIONS = Array.from(
  new Set(TIMEZONES.map((timezone) => timezone.split('/')[0]).filter(Boolean))
).sort((a, b) => a.localeCompare(b));

export const UTC_OFFSETS = Array.from({ length: 113 }, (_, index) => {
  const totalMinutes = index * 15 - 14 * 60;
  const sign = totalMinutes >= 0 ? '+' : '-';
  const magnitude = Math.abs(totalMinutes);
  const hours = Math.floor(magnitude / 60);
  const minutes = magnitude % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

export function timezoneRegion(timezone: string): string {
  const region = timezone.split('/')[0] ?? '';
  return TIMEZONE_REGIONS.includes(region) ? region : (TIMEZONE_REGIONS[0] ?? 'UTC');
}

export function timezoneMatchesRegion(timezone: string, region: string): boolean {
  return timezone === region || timezone.startsWith(`${region}/`);
}
