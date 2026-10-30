import type { NewHoroscopeChartKind, NewHoroscopeTimeSystem } from '@/lib/tauri/chartPayload';
import type { LatitudeDirection, LongitudeDirection } from '@/lib/newHoroscopeForm';

export const CHART_KINDS: { id: NewHoroscopeChartKind; labelKey: string }[] = [
	{ id: 'radix', labelKey: 'new_type_radix' },
	{ id: 'event', labelKey: 'new_type_event' },
	{ id: 'horary', labelKey: 'new_type_horary' }
];

export const TIME_SYSTEMS: { id: NewHoroscopeTimeSystem; labelKey: string }[] = [
	{ id: 'gregorian', labelKey: 'new_time_system_gregorian' },
	{ id: 'julian_calendar', labelKey: 'new_time_system_julian_calendar' },
	{ id: 'julian_day', labelKey: 'new_time_system_julian_day' }
];

export const RODEN_RATINGS: { id: string; labelKey: string }[] = [
	{ id: 'AA', labelKey: 'new_roden_rating_aa' },
	{ id: 'A', labelKey: 'new_roden_rating_a' },
	{ id: 'B', labelKey: 'new_roden_rating_b' },
	{ id: 'C', labelKey: 'new_roden_rating_c' },
	{ id: 'DD', labelKey: 'new_roden_rating_dd' },
	{ id: 'X', labelKey: 'new_roden_rating_x' }
];

export const LATITUDE_DIRECTIONS: { id: LatitudeDirection; labelKey: string }[] = [
	{ id: 'north', labelKey: 'new_dir_north' },
	{ id: 'south', labelKey: 'new_dir_south' }
];

export const LONGITUDE_DIRECTIONS: { id: LongitudeDirection; labelKey: string }[] = [
	{ id: 'east', labelKey: 'new_dir_east' },
	{ id: 'west', labelKey: 'new_dir_west' }
];
