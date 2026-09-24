import { houseForLongitude, normalizeLongitude } from './chartSearch';
import { elementForZodiacId, type ElementId } from './elementColors';
import { signIndexToZodiacId, type ZodiacId } from './glyphs';
import { objectIcon, objectLabel, type Translate } from './objectLabels';
import { symbolEntriesForLongitude, type SymbolEntry } from './symbolSystems';
import { aspectsTouchingBody, type ParsedAspect } from './aspectParsing';

export type MotionState = 'direct' | 'retrograde' | 'stationary';

/** Below this, a body's motion reads as effectively zero (a station) rather than direct/retrograde;
 *  loose enough to absorb the +/-1h finite-difference sampling noise from both compute backends. */
const STATIONARY_SPEED_THRESHOLD_DEG_PER_DAY = 0.005;

export function motionStateFromSpeed(speed: number | undefined): MotionState {
	if (typeof speed !== 'number' || !Number.isFinite(speed)) return 'direct';
	if (Math.abs(speed) < STATIONARY_SPEED_THRESHOLD_DEG_PER_DAY) return 'stationary';
	return speed < 0 ? 'retrograde' : 'direct';
}

const ZODIAC_UNICODE_FALLBACK = [
	'♈',
	'♉',
	'♊',
	'♋',
	'♌',
	'♍',
	'♎',
	'♏',
	'♐',
	'♑',
	'♒',
	'♓'
] as const;

/** Sign-relative degrees/minutes/seconds and zodiac sign for an absolute ecliptic longitude. */
export function positionWithinSign(longitude: number) {
	const withinSign = longitude % 30;
	const totalSeconds = Math.round(withinSign * 3600);
	const degrees = Math.floor(totalSeconds / 3600) % 30;
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const signIndex = Math.floor(longitude / 30) % 12;
	return {
		degrees,
		minutes,
		seconds,
		signZodiacId: signIndexToZodiacId(signIndex),
		signGlyphFallback: ZODIAC_UNICODE_FALLBACK[signIndex] ?? '♈'
	};
}

/** Declination/RA/altitude/azimuth arrive one of two ways depending on compute route: nested
 *  inside the raw position value (an object, on the JPL+Python route), or as sibling chart-level
 *  maps keyed by body id (on the Rust-native anise route). A bare-number position on the
 *  Swiss-ephemeris route has neither, and every field stays undefined. */
export interface ExtendedPositionMaps {
	declination?: Record<string, number>;
	rightAscension?: Record<string, number>;
	altitude?: Record<string, number>;
	azimuth?: Record<string, number>;
}

function extendedPositionFields(
	value: unknown,
	chartMaps: ExtendedPositionMaps | undefined,
	bodyId: string
) {
	const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
	const nested = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	return {
		declination: num(nested.declination) ?? chartMaps?.declination?.[bodyId],
		rightAscension: num(nested.right_ascension) ?? chartMaps?.rightAscension?.[bodyId],
		altitude: num(nested.altitude) ?? chartMaps?.altitude?.[bodyId],
		azimuth: num(nested.azimuth) ?? chartMaps?.azimuth?.[bodyId]
	};
}

export interface ObjectDetailViewModel {
	bodyId: string;
	label: string;
	icon: string;
	layerLabel: string;
	longitude: number;
	degrees: number;
	minutes: number;
	seconds: number;
	signZodiacId: ZodiacId;
	signGlyphFallback: string;
	element: ElementId;
	houseNumber: number | null;
	motionState: MotionState;
	/** Degrees/day; undefined only if the compute route never reported motion for this body. */
	speed?: number;
	rightAscension?: number;
	declination?: number;
	altitude?: number;
	azimuth?: number;
	symbols: SymbolEntry[];
	chartShapeIds: string[];
	chartConfigurationIds: string[];
	aspects: ParsedAspect[];
}

/** Raw, not-yet-normalized inputs needed to build one body's detail view — deliberately close to
 *  what each chart-computed payload already looks like, so callers barely need to reshape it. */
export interface ObjectDetailSource {
	bodyId: string;
	rawPosition: unknown;
	motion?: { speed?: number; retrograde?: boolean };
	extendedMaps?: ExtendedPositionMaps;
	houseCusps: readonly number[];
	chartShapeIds: readonly string[];
	chartConfigurationIds: readonly string[];
	/** The full aspect list for this body's layer; filtered internally to the ones touching it. */
	allAspects: readonly ParsedAspect[];
	layerLabel: string;
}

export function buildObjectDetailViewModel(
	source: ObjectDetailSource,
	language: string,
	t: Translate
): ObjectDetailViewModel | null {
	const longitude = normalizeLongitude(source.rawPosition);
	if (longitude === null) return null;
	const { degrees, minutes, seconds, signZodiacId, signGlyphFallback } =
		positionWithinSign(longitude);
	return {
		bodyId: source.bodyId,
		label: objectLabel(source.bodyId, t),
		icon: objectIcon(source.bodyId),
		layerLabel: source.layerLabel,
		longitude,
		degrees,
		minutes,
		seconds,
		signZodiacId,
		signGlyphFallback,
		element: elementForZodiacId(signZodiacId),
		houseNumber: houseForLongitude(longitude, source.houseCusps),
		motionState: motionStateFromSpeed(source.motion?.speed),
		speed:
			typeof source.motion?.speed === 'number' && Number.isFinite(source.motion.speed)
				? source.motion.speed
				: undefined,
		...extendedPositionFields(source.rawPosition, source.extendedMaps, source.bodyId),
		symbols: symbolEntriesForLongitude(longitude, language, t),
		chartShapeIds: [...source.chartShapeIds],
		chartConfigurationIds: [...source.chartConfigurationIds],
		aspects: aspectsTouchingBody(source.allAspects, source.bodyId)
	};
}
