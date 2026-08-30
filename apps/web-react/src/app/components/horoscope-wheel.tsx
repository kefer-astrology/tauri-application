/**
 * Horoscope wheel SVG — single source shared with Horoskop tab (`HoroscopeDashboard`).
 * Developer handoff id: HoroscopeWheel
 */
import { useId, type MouseEvent } from 'react';
import {
	DEFAULT_ELEMENT_COLORS,
	elementForZodiacId,
	wheelZodiacFillOnDark,
	type ElementColors
} from '@/lib/astrology/elementColors';
import { ASPECT_ROWS, DEFAULT_ASPECT_COLORS, DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS } from '@/lib/astrology/observableObjects';
import {
	getAstrologyGlyphSrc,
	getZodiacGlyphSrc,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import { resolveCustomGlyphSrc, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import type { AspectLineStyleId, AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '@/lib/tauri/chartPayload';
import type { Theme } from './astrology-sidebar';

/** Dark themes: planet SVGs (no per-color filter assets). */
function WheelPlanetImageDark({
	href,
	x,
	y,
	size
}: {
	href: string;
	x: number;
	y: number;
	size: number;
}) {
	const half = size / 2;
	return (
		<image
			href={href}
			x={x - half}
			y={y - half}
			width={size}
			height={size}
			preserveAspectRatio="xMidYMid meet"
			style={{
				pointerEvents: 'none',
				filter: 'grayscale(1) invert(1) brightness(0.9) contrast(1.1)'
			}}
		/>
	);
}

/** Tint a raster SVG glyph to a solid color via `url(#filterId)` (`feFlood` + `feComposite` in defs). */
function WheelTintedGlyphImage({
	href,
	x,
	y,
	size,
	filterId
}: {
	href: string;
	x: number;
	y: number;
	size: number;
	filterId: string;
}) {
	const half = size / 2;
	return (
		<image
			href={href}
			x={x - half}
			y={y - half}
			width={size}
			height={size}
			preserveAspectRatio="xMidYMid meet"
			style={{
				pointerEvents: 'none',
				filter: `url(#${filterId})`
			}}
		/>
	);
}

export type HoroscopeWheelBody = string;

const DEFAULT_WHEEL_BODY_ORDER: readonly HoroscopeWheelBody[] = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

const OBSERVABLE_OBJECT_META = new Map(
	OBSERVABLE_OBJECTS.map((item) => [item.id, { icon: item.icon }] as const)
);

export type HemisphereOverlayKind =
	| 'off'
	| 'asc-dsc-east'
	| 'asc-dsc-west'
	| 'mc-ic-north'
	| 'mc-ic-south';

const zodiacSigns = [
	{ name: 'Aries', id: 'aries', icon: '♈', angle: 0 },
	{ name: 'Taurus', id: 'taurus', icon: '♉', angle: 30 },
	{ name: 'Gemini', id: 'gemini', icon: '♊', angle: 60 },
	{ name: 'Cancer', id: 'cancer', icon: '♋', angle: 90 },
	{ name: 'Leo', id: 'leo', icon: '♌', angle: 120 },
	{ name: 'Virgo', id: 'virgo', icon: '♍', angle: 150 },
	{ name: 'Libra', id: 'libra', icon: '♎', angle: 180 },
	{ name: 'Scorpio', id: 'scorpio', icon: '♏', angle: 210 },
	{ name: 'Sagittarius', id: 'sagittarius', icon: '♐', angle: 240 },
	{ name: 'Capricorn', id: 'capricorn', icon: '♑', angle: 270 },
	{ name: 'Aquarius', id: 'aquarius', icon: '♒', angle: 300 },
	{ name: 'Pisces', id: 'pisces', icon: '♓', angle: 330 }
] as const;

/** Ecliptic longitudes (°) — aligned with `horoscope-dashboard` mock radix for handoff */
const DEFAULT_BODY_LONGITUDE: Record<string, number> = {
	sun: 240 + 9 + 47 / 60,
	moon: 30 + 18 + 23 / 60,
	mercury: 240 + 2 + 15 / 60,
	venus: 210 + 26 + 8 / 60,
	mars: 0 + 14 + 42 / 60,
	jupiter: 330 + 21 + 56 / 60,
	saturn: 270 + 28 + 31 / 60,
	uranus: 60 + 11 + 19 / 60,
	neptune: 270 + 7 + 4 / 60,
	pluto: 210 + 8 + 51 / 60
};

/** Axis longitudes (°) from same mock: ASC Scorpio 14°28', MC Cancer 29°13', etc. */
export const HOROSCOPE_WHEEL_AXIS = {
	asc: 210 + 14 + 28 / 60,
	dsc: 30 + 14 + 28 / 60,
	mc: 90 + 29 + 13 / 60,
	ic: 270 + 29 + 13 / 60
};

type HoroscopeWheelAxis = typeof HOROSCOPE_WHEEL_AXIS;

/** Which side of ASC–DSC (only planets; same lon math as wheel). */
export function planetEastWestHemisphere(eclipticDeg: number): 'east' | 'west' {
	const rA = ((HOROSCOPE_WHEEL_AXIS.asc - 90) * Math.PI) / 180;
	const rP = ((eclipticDeg - 90) * Math.PI) / 180;
	const cross = Math.cos(rA) * Math.sin(rP) - Math.sin(rA) * Math.cos(rP);
	return cross > 0 ? 'east' : 'west';
}

/** Which side of MC–IC (“above/below” in wheel plane; prototype). */
export function planetNorthSouthHemisphere(eclipticDeg: number): 'north' | 'south' {
	const rM = ((HOROSCOPE_WHEEL_AXIS.mc - 90) * Math.PI) / 180;
	const rP = ((eclipticDeg - 90) * Math.PI) / 180;
	const cross = Math.cos(rM) * Math.sin(rP) - Math.sin(rM) * Math.cos(rP);
	return cross > 0 ? 'north' : 'south';
}

function polar(cx: number, cy: number, r: number, eclipticDeg: number) {
	const rad = ((180 - eclipticDeg) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function longitudeToScreenRadians(eclipticDeg: number) {
	return ((180 - eclipticDeg) * Math.PI) / 180;
}

function normalizeDeg(value: number) {
	return ((value % 360) + 360) % 360;
}

function midpointLongitude(startLon: number, endLon: number) {
	return normalizeDeg(startLon + normalizeDeg(endLon - startLon) / 2);
}

function normalizeHouseCusps(cusps?: readonly number[]) {
	if (!cusps || cusps.length !== 12) return [];
	const normalized = cusps.map((cusp) => (Number.isFinite(cusp) ? normalizeDeg(cusp) : null));
	return normalized.every((cusp): cusp is number => cusp !== null) ? normalized : [];
}

/** Longitude gap below which two glyphs are treated as overlapping and fanned apart. */
const PLANET_STACK_CONFLICT_DEG = 6;
/** Preferred radial gap between fan tiers; compressed when a cluster is larger than the band allows. */
const PLANET_FAN_RADIAL_STEP = 22;
/** Target on-screen arc length between adjacent fanned glyphs, a bit more than the ~22px glyph itself. */
const PLANET_FAN_PIXEL_GAP = 26;

export interface PlanetPlacement {
	radius: number;
	/** Longitude used only for on-wheel placement; the body's true longitude is untouched elsewhere (aspects, hemisphere, trailers). */
	renderLon: number;
}

/**
 * Bodies whose longitudes cluster within `PLANET_STACK_CONFLICT_DEG` of each other fan into a
 * triangle instead of rendering on top of one another: the middle (by longitude) member of the
 * cluster stays at `outerRadius` as the apex, and each step away from that middle rank moves one
 * tier inward *and* one notch further around — so a tight conjunction reads as a small triangle,
 * not a straight radial stack that can still collide once its own longitude gap shrinks at a
 * smaller radius. The angular step is sized from the tightest (innermost) radius in the cluster so
 * on-screen spacing stays roughly constant no matter how close to center the fan is pushed.
 */
function resolveDeclutteredPlacements(
	entries: readonly { key: string; lon: number }[],
	outerRadius: number,
	floorRadius: number
): Map<string, PlanetPlacement> {
	const placements = new Map<string, PlanetPlacement>();
	const n = entries.length;
	if (n === 0) return placements;
	const sorted = [...entries].sort((a, b) => a.lon - b.lon);
	const visited = new Array<boolean>(n).fill(false);
	for (let i = 0; i < n; i++) {
		if (visited[i]) continue;
		const cluster = [i];
		visited[i] = true;
		for (let step = 1; step < n; step++) {
			const cur = (i + step) % n;
			if (visited[cur]) break;
			const prev = cluster[cluster.length - 1]!;
			const gap = normalizeDeg(sorted[cur]!.lon - sorted[prev]!.lon);
			if (gap > PLANET_STACK_CONFLICT_DEG) break;
			cluster.push(cur);
			visited[cur] = true;
		}
		const size = cluster.length;
		if (size === 1) {
			placements.set(sorted[cluster[0]!]!.key, {
				radius: outerRadius,
				renderLon: sorted[cluster[0]!]!.lon
			});
			continue;
		}
		const midRank = (size - 1) / 2;
		const maxAbsRank = Math.max(...cluster.map((_, k) => Math.abs(k - midRank)));
		const radialStep =
			maxAbsRank > 0 ? Math.min(PLANET_FAN_RADIAL_STEP, (outerRadius - floorRadius) / maxAbsRank) : 0;
		const innermostRadius = outerRadius - maxAbsRank * radialStep;
		const angleStepDeg = (PLANET_FAN_PIXEL_GAP / (2 * Math.PI * Math.max(innermostRadius, 1))) * 360;
		cluster.forEach((idx, k) => {
			const rank = k - midRank;
			placements.set(sorted[idx]!.key, {
				radius: outerRadius - Math.abs(rank) * radialStep,
				renderLon: normalizeDeg(sorted[idx]!.lon + rank * angleStepDeg)
			});
		});
	}
	return placements;
}

function normalizeAspectPointId(id: string): string {
	const s = id.trim().toLowerCase();
	return s === 'desc' ? 'dsc' : s;
}

function longitudeForAspectPoint(
	id: string,
	bodyLongitudes: Partial<Record<string, number>>,
	axisLongitudes: Partial<HoroscopeWheelAxis>
): number | null {
	const norm = normalizeAspectPointId(id);
	if (Object.prototype.hasOwnProperty.call(bodyLongitudes, norm)) {
		const lon = bodyLongitudes[norm];
		return typeof lon === 'number' ? lon : null;
	}
	if (norm === 'asc' || norm === 'dsc' || norm === 'mc' || norm === 'ic') {
		const lon = axisLongitudes[norm];
		return typeof lon === 'number' ? lon : null;
	}
	return null;
}

function maxOrbForAspectType(aspectType: string, aspectOrbs: Record<string, number>): number {
	const configured = aspectOrbs[aspectType];
	if (typeof configured === 'number' && Number.isFinite(configured)) {
		return Math.max(configured, 1e-9);
	}
	const row = ASPECT_ROWS.find((r) => r.id === aspectType);
	if (row) return Math.max(row.defaultOrb, 1e-9);
	return 8;
}

type AspectOrbTier = 'tight' | 'medium' | 'loose' | 'outer';

function aspectOrbTier(orbDeg: number, maxOrbDeg: number, tier: AspectLineTierStyleState): AspectOrbTier {
	const max = Math.max(maxOrbDeg, 1e-9);
	const pct = (Math.abs(orbDeg) / max) * 100;
	const t = tier.tightThresholdPct;
	const m = Math.max(tier.mediumThresholdPct, t);
	const l = Math.max(tier.looseThresholdPct, m);
	if (pct <= t) return 'tight';
	if (pct <= m) return 'medium';
	if (pct <= l) return 'loose';
	return 'outer';
}

function strokeWidthForAspectTier(orbTier: AspectOrbTier, tier: AspectLineTierStyleState): number {
	if (orbTier === 'tight') return tier.widthTight;
	if (orbTier === 'medium') return tier.widthMedium;
	if (orbTier === 'loose') return tier.widthLoose;
	return tier.widthOuter;
}

/** Tight/medium/loose aspects always render solid; only the outer (loosest) tier follows `outerLineStyle`. */
function strokeDasharrayForAspectTier(
	orbTier: AspectOrbTier,
	outerLineStyle: AspectLineStyleId,
	strokeWidthPx: number
): string | undefined {
	if (orbTier !== 'outer' || outerLineStyle === 'solid') return undefined;
	if (outerLineStyle === 'dotted') return `0.1 ${(strokeWidthPx * 2.4).toFixed(2)}`;
	return `${(strokeWidthPx * 3).toFixed(2)} ${(strokeWidthPx * 2).toFixed(2)}`;
}

export interface RadixAspectDrawInput {
	from: string;
	to: string;
	type: string;
	orb: number;
}

export type HoroscopeWheelObjectLayer = 'radix' | 'transit';

export interface HoroscopeWheelObjectInteraction {
	bodyId: string;
	layer: HoroscopeWheelObjectLayer;
}

export interface HoroscopeWheelAspectInteraction {
	aspect: RadixAspectDrawInput;
	index: number;
}

export interface HoroscopeWheelProps {
	theme: Theme;
	/**
	 * When set, planet and zodiac marks use `static/glyphs/.../planets/*.svg` and `.../zodiac/*.svg`
	 * as native `<image>` with per-tint SVG filters (`elementColors` for signs; primary for light planets).
	 */
	glyphSet?: AstrologyGlyphSetId;
	/** Outer ring rendering: `minimalist` is sign dividers only, `technical` adds a 360° degree scale. */
	wheelStyle?: WheelStyleId;
	/** Fire / earth / air / water colors for zodiac ring on the wheel. */
	elementColors?: ElementColors;
	/** Resolved CSS color for light-theme planet glyphs (typically `--color-primary`). */
	lightPlanetFill?: string;
	bodyLongitudes?: Partial<Record<string, number>>;
	bodyOrder?: readonly HoroscopeWheelBody[];
	/** Optional event/transit positions rendered as an outer extension of the radix wheel. */
	transitBodyLongitudes?: Partial<Record<string, number>>;
	transitBodyOrder?: readonly HoroscopeWheelBody[];
	axisLongitudes?: Partial<HoroscopeWheelAxis>;
	/** House cusps 1-12 in ecliptic longitude, from backend/Swiss/JPL. */
	houseCusps?: readonly number[];
	/** Longitude that should be pinned to the left edge; normally the computed ASC. */
	ascRotationLongitude?: number;
	useFallbackData?: boolean;
	/** Bodies that receive a soft halo (badge hover, singleton, focal planets, …) */
	highlightBodies?: ReadonlySet<HoroscopeWheelBody>;
	/** When true, non-highlighted planets/icons are dimmed (hemisphere / focus preview) */
	dimNonHighlighted?: boolean;
	hemisphereOverlay?: HemisphereOverlayKind;
	/** Computed radix aspects (backend); lines drawn when both endpoints resolve on the wheel. */
	radixAspects?: RadixAspectDrawInput[];
	/** Max orbs per aspect type (typically workspace defaults) for line weight vs tightness. */
	aspectOrbsForRadix?: Record<string, number>;
	/** Stroke color per aspect type (workspace defaults). */
	aspectColorsForRadix?: Record<string, string>;
	/** Thresholds (% of max orb) and stroke widths for tight / medium / loose bands. */
	aspectLineTierStyle?: AspectLineTierStyleState;
	/** Horoskop tab uses radix-only wheel; Informace view enables glyphs + axes */
	showPlanetGlyphs?: boolean;
	showAxisLines?: boolean;
	selectedObject?: Pick<HoroscopeWheelObjectInteraction, 'bodyId' | 'layer'> | null;
	selectedAspectIndex?: number | null;
	/** Aspect indices (into `radixAspects`) to keep at full opacity; the rest dim. Driven by clicking a body. */
	highlightAspectIndices?: ReadonlySet<number>;
	onObjectClick?: (interaction: HoroscopeWheelObjectInteraction) => void;
	onAspectClick?: (interaction: HoroscopeWheelAspectInteraction) => void;
	onWheelBackgroundClick?: () => void;
	className?: string;
}

export function HoroscopeWheel({
	theme,
	glyphSet,
	wheelStyle = 'technical',
	bodyLongitudes,
	bodyOrder,
	transitBodyLongitudes,
	transitBodyOrder,
	axisLongitudes,
	houseCusps,
	ascRotationLongitude,
	useFallbackData = true,
	highlightBodies = new Set(),
	dimNonHighlighted = false,
	hemisphereOverlay = 'off',
	radixAspects,
	aspectOrbsForRadix,
	aspectColorsForRadix,
	aspectLineTierStyle: aspectLineTierStyleProp,
	showPlanetGlyphs = false,
	showAxisLines = false,
	elementColors: elementColorsProp = DEFAULT_ELEMENT_COLORS,
	lightPlanetFill = 'var(--theme-content-primary)',
	selectedObject,
	selectedAspectIndex,
	highlightAspectIndices = new Set(),
	onObjectClick,
	onAspectClick,
	onWheelBackgroundClick,
	className
}: HoroscopeWheelProps) {
	const isDark = theme === 'midnight' || theme === 'twilight';
	const customGlyphOverrides = useCustomGlyphOverrides();
	const astrologyGlyphSrc = (id: string) =>
		resolveCustomGlyphSrc(customGlyphOverrides, id) ??
		(glyphSet ? getAstrologyGlyphSrc(glyphSet, id) : null);
	const zodiacGlyphSrc = (id: string) =>
		resolveCustomGlyphSrc(customGlyphOverrides, id) ??
		(glyphSet ? getZodiacGlyphSrc(glyphSet, id) : null);
	const wheelFilterUid = useId().replace(/:/g, '');
	const planetLightFilterId = `${wheelFilterUid}-pl`;
	const planetDarkFilterId = `${wheelFilterUid}-pd`;
	const transitFilterId = `${wheelFilterUid}-tr`;
	const wheelSize = 800;
	const center = wheelSize / 2;
	const outerRadius = 320;
	const innerRadius = 270;
	/** Outer boundary, inner boundary, sign dividers, and bold degree ticks share one weight. */
	const zodiacRingStrokeWidth = 2;
	const innerCenterRing = 184;
	const innerCenterCore = 152;
	/** House band sits flush against the innermost circle instead of the zodiac ring, so its own boundary doesn't read as a near-duplicate of `innerRadius`. */
	const houseBandWidth = 20;
	const houseInnerRadius = innerCenterCore;
	const houseOuterRadius = houseInnerRadius + houseBandWidth;
	/** Small outward nudge from the original mid-band radii (larger values crowded the layout). */
	const glyphRadialOutset = 3;
	/** Fraction of the way from `houseOuterRadius` to `innerRadius`; above 0.5 biases glyphs outward, closer to the zodiac ring, so they're easier to find and click. */
	const planetBandOuterBias = 0.62;
	const planetRadius =
		houseOuterRadius + (innerRadius - houseOuterRadius) * planetBandOuterBias - 8 + glyphRadialOutset;
	const houseLabelRadius = (houseInnerRadius + houseOuterRadius) / 2;
	/** Aspect chords stop at the first inner circle, keeping the band to the second circle clear. */
	const radixAspectChordRadius = innerCenterCore;
	const zodiacRadius = (innerRadius + outerRadius) / 2 + glyphRadialOutset;
	const transitRingInnerRadius = outerRadius + 18;
	const transitRingOuterRadius = outerRadius + 58;
	const transitGlyphRadius = outerRadius + 38;
	const wheelBodyLongitudes = useFallbackData
		? { ...DEFAULT_BODY_LONGITUDE, ...bodyLongitudes }
		: (bodyLongitudes ?? {});
	const wheelAxisLongitudes = useFallbackData
		? { ...HOROSCOPE_WHEEL_AXIS, ...axisLongitudes }
		: (axisLongitudes ?? {});
	const axisAsc = wheelAxisLongitudes.asc;
	const axisDsc = wheelAxisLongitudes.dsc;
	const axisMc = wheelAxisLongitudes.mc;
	const axisIc = wheelAxisLongitudes.ic;
	const hasAxisGeometry =
		typeof axisAsc === 'number' &&
		typeof axisDsc === 'number' &&
		typeof axisMc === 'number' &&
		typeof axisIc === 'number';

	const strokeMain = 'var(--token-wheel-stroke-main)';
	const strokeSoft = 'var(--token-wheel-stroke-soft)';
	const fillBg = 'var(--token-wheel-bg)';
	const wheelRotationOffset =
		typeof ascRotationLongitude === 'number' && Number.isFinite(ascRotationLongitude)
			? -normalizeDeg(ascRotationLongitude)
			: 0;
	const displayLon = (lon: number) => normalizeDeg(lon + wheelRotationOffset);
	const wheelHouseCusps = normalizeHouseCusps(houseCusps);

	const bodies: { key: HoroscopeWheelBody; icon: string }[] = (
		bodyOrder ?? DEFAULT_WHEEL_BODY_ORDER
	).map((key) => ({
		key,
		icon: OBSERVABLE_OBJECT_META.get(key)?.icon ?? key.slice(0, 3)
	}));
	/** Bodies in the same conjunction fan into a triangle inward from `planetRadius`; true longitude is untouched elsewhere. */
	const bodyPlacementByKey = resolveDeclutteredPlacements(
		bodies
			.map(({ key }) => ({ key, lon: wheelBodyLongitudes[key] }))
			.filter((entry): entry is { key: string; lon: number } => typeof entry.lon === 'number'),
		planetRadius,
		houseOuterRadius + 14
	);
	const transitBodies: { key: HoroscopeWheelBody; icon: string }[] = (transitBodyOrder ?? []).map(
		(key) => ({
			key,
			icon: OBSERVABLE_OBJECT_META.get(key)?.icon ?? key.slice(0, 3)
		})
	);
	const hasTransitBodies = transitBodies.some(
		({ key }) => typeof transitBodyLongitudes?.[key] === 'number'
	);
	const anglePoints: { key: 'asc' | 'dsc' | 'mc' | 'ic'; icon: string; longitude: number }[] = [
		typeof axisAsc === 'number'
			? { key: 'asc', icon: OBSERVABLE_OBJECT_META.get('asc')?.icon ?? 'Asc', longitude: axisAsc }
			: null,
		typeof axisDsc === 'number'
			? { key: 'dsc', icon: OBSERVABLE_OBJECT_META.get('desc')?.icon ?? 'Dsc', longitude: axisDsc }
			: null,
		typeof axisMc === 'number'
			? { key: 'mc', icon: OBSERVABLE_OBJECT_META.get('mc')?.icon ?? 'MC', longitude: axisMc }
			: null,
		typeof axisIc === 'number'
			? { key: 'ic', icon: OBSERVABLE_OBJECT_META.get('ic')?.icon ?? 'IC', longitude: axisIc }
			: null
	].filter(
		(item): item is { key: 'asc' | 'dsc' | 'mc' | 'ic'; icon: string; longitude: number } =>
			item !== null
	);
	const planetGlyphColor = isDark ? 'var(--token-wheel-glyph)' : lightPlanetFill;
	const elementColors = elementColorsProp;
	const angleMarkerRadius = outerRadius + 22;

	const pAsc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisAsc)) : null;
	const pDsc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisDsc)) : null;
	const pMc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisMc)) : null;
	const pIc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisIc)) : null;

	const overlayTint = 'var(--token-wheel-overlay-primary)';
	const overlayTintAlt = 'var(--token-wheel-overlay-secondary)';

	/** Wedge from center to outer arc [startLon → endLon] (ecliptic °). */
	function arcWedge(startLon: number, endLon: number, sweepFlag: 0 | 1): string {
		const p1 = polar(center, center, outerRadius, displayLon(startLon));
		const p2 = polar(center, center, outerRadius, displayLon(endLon));
		return `M ${center} ${center} L ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 0 ${sweepFlag} ${p2.x} ${p2.y} Z`;
	}

	/**
	 * Complementary semicircles along ASC–DSC and MC–IC. Sweep flags are tuned so
	 * “east / north” match prototype overlays (handoff — refine with real cusps later).
	 */
	const pathEastWestEast = hasAxisGeometry ? arcWedge(axisDsc, axisAsc, 1) : null;
	const pathEastWestWest = hasAxisGeometry ? arcWedge(axisDsc, axisAsc, 0) : null;
	const pathMcIcNorth = hasAxisGeometry ? arcWedge(axisIc, axisMc, 1) : null;
	const pathMcIcSouth = hasAxisGeometry ? arcWedge(axisIc, axisMc, 0) : null;

	const overlayPath =
		hemisphereOverlay === 'asc-dsc-east'
			? pathEastWestEast
			: hemisphereOverlay === 'asc-dsc-west'
				? pathEastWestWest
				: hemisphereOverlay === 'mc-ic-north'
					? pathMcIcNorth
					: hemisphereOverlay === 'mc-ic-south'
						? pathMcIcSouth
						: null;

	const tierStyle = aspectLineTierStyleProp ?? DEFAULT_ASPECT_LINE_TIER_STYLE;
	const orbTable = { ...DEFAULT_ASPECT_ORBS, ...(aspectOrbsForRadix ?? {}) };
	const colorTable: Record<string, string> = {
		...DEFAULT_ASPECT_COLORS,
		...(aspectColorsForRadix ?? {})
	};
	const aspectList = radixAspects ?? [];
	const emitObjectClick = (
		event: MouseEvent<SVGElement>,
		bodyId: string,
		layer: HoroscopeWheelObjectLayer
	) => {
		event.stopPropagation();
		onObjectClick?.({ bodyId, layer });
	};

	return (
		<svg
			data-handoff="HoroscopeWheel"
			width="100%"
			height="100%"
			viewBox={`0 0 ${wheelSize} ${wheelSize}`}
			className={className}
			preserveAspectRatio="xMidYMid meet"
			onClick={onWheelBackgroundClick}
		>
			<defs>
				<filter id="hw-planet-halo" x="-100%" y="-100%" width="300%" height="300%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				{glyphSet ? (
					<>
						{!isDark && (
							<filter
								id={planetLightFilterId}
								colorInterpolationFilters="sRGB"
								x="-50%"
								y="-50%"
								width="200%"
								height="200%"
							>
								<feFlood floodColor={lightPlanetFill} floodOpacity="1" result="c" />
								<feComposite in="c" in2="SourceGraphic" operator="in" result="r" />
								<feMerge>
									<feMergeNode in="r" />
								</feMerge>
							</filter>
						)}
						{isDark && (
							<filter
								id={planetDarkFilterId}
								colorInterpolationFilters="sRGB"
								x="-50%"
								y="-50%"
								width="200%"
								height="200%"
							>
								<feFlood floodColor={lightPlanetFill} floodOpacity="1" result="c" />
								<feComposite in="c" in2="SourceGraphic" operator="in" result="r" />
								<feMerge>
									<feMergeNode in="r" />
								</feMerge>
							</filter>
						)}
					</>
				) : null}
				{glyphSet
					? zodiacSigns.map((sign) => {
							const href = zodiacGlyphSrc(sign.id);
							if (!href) return null;
							const el = elementForZodiacId(sign.id);
							const base = elementColors[el];
							const tint = isDark ? wheelZodiacFillOnDark(base) : base;
							return (
								<filter
									key={`zf-${sign.id}`}
									id={`${wheelFilterUid}-z-${sign.id}`}
									colorInterpolationFilters="sRGB"
									x="-50%"
									y="-50%"
									width="200%"
									height="200%"
								>
									<feFlood floodColor={tint} floodOpacity="1" result="zc" />
									<feComposite in="zc" in2="SourceGraphic" operator="in" result="zr" />
									<feMerge>
										<feMergeNode in="zr" />
									</feMerge>
								</filter>
							);
						})
					: null}
				<filter
					id={transitFilterId}
					colorInterpolationFilters="sRGB"
					x="-50%"
					y="-50%"
					width="200%"
					height="200%"
				>
					<feFlood floodColor="var(--theme-accent)" floodOpacity="1" result="tc" />
					<feComposite in="tc" in2="SourceGraphic" operator="in" result="tr" />
					<feMerge>
						<feMergeNode in="tr" />
					</feMerge>
				</filter>
			</defs>

			<circle cx={center} cy={center} r={outerRadius + 72} fill={fillBg} />

			{hasTransitBodies && (
				<g data-handoff="Layer_TransitRing">
					<circle
						cx={center}
						cy={center}
						r={transitRingOuterRadius}
						fill="none"
						stroke="var(--theme-accent)"
						strokeWidth="1.1"
						opacity={0.52}
					/>
					<circle
						cx={center}
						cy={center}
						r={transitRingInnerRadius}
						fill="none"
						stroke="var(--theme-accent)"
						strokeWidth="0.9"
						opacity={0.28}
					/>
					{transitBodies.flatMap(({ key, icon }) => {
						const lon = transitBodyLongitudes?.[key];
						if (typeof lon !== 'number') return [];
						const p = polar(center, center, transitGlyphRadius, displayLon(lon));
						const planetHref = astrologyGlyphSrc(key);
						return [
							<g
								key={`transit-${key}`}
								data-handoff={`TransitPlanet_${key}`}
								style={{ cursor: 'pointer' }}
								onClick={(event) => emitObjectClick(event, key, 'transit')}
							>
								<circle cx={p.x} cy={p.y} r="20" fill="transparent" />
								<circle
									cx={p.x}
									cy={p.y}
									r="14"
									fill="var(--theme-panel-bg)"
									stroke="var(--theme-accent)"
									strokeWidth={
										selectedObject?.layer === 'transit' && selectedObject.bodyId === key ? 2.5 : 1
									}
									opacity={0.92}
								/>
								{planetHref ? (
									<WheelTintedGlyphImage
										href={planetHref}
										x={p.x}
										y={p.y}
										size={18}
										filterId={transitFilterId}
									/>
								) : (
									<text
										x={p.x}
										y={p.y}
										textAnchor="middle"
										dominantBaseline="middle"
										fontSize={icon.length > 2 ? 8 : 14}
										fontWeight="700"
										fill="var(--theme-accent)"
									>
										{icon}
									</text>
								)}
							</g>
						];
					})}
				</g>
			)}

			<circle
				cx={center}
				cy={center}
				r={outerRadius}
				fill="none"
				stroke={strokeMain}
				strokeWidth={zodiacRingStrokeWidth}
			/>
			<circle
				cx={center}
				cy={center}
				r={innerRadius}
				fill="none"
				stroke={strokeMain}
				strokeWidth={zodiacRingStrokeWidth}
			/>

			{zodiacSigns.map((sign, idx) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle));
				const x1 = center + innerRadius * Math.cos(rad);
				const y1 = center + innerRadius * Math.sin(rad);
				const x2 = center + outerRadius * Math.cos(rad);
				const y2 = center + outerRadius * Math.sin(rad);
				return (
					<line
						key={`cusp-${idx}`}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke={strokeSoft}
						strokeWidth={zodiacRingStrokeWidth}
					/>
				);
			})}

			{wheelStyle === 'technical' && (
				<g>
					{Array.from({ length: 360 }, (_, i) => {
						const rad = longitudeToScreenRadians(displayLon(i));
						const is10Degree = i % 10 === 0;
						const is5Degree = i % 5 === 0 && !is10Degree;
						const ringWidth = outerRadius - innerRadius;
						/** 10° ticks read longer; 5° ticks stay 1°-length but bolder — mirrors the Technical ring spec. */
						const tickLength = is10Degree ? ringWidth * 0.48 * 0.6 : ringWidth * 0.14;
						const tickWidth = is10Degree || is5Degree ? zodiacRingStrokeWidth : 0.6;
						const x1 = center + innerRadius * Math.cos(rad);
						const y1 = center + innerRadius * Math.sin(rad);
						const x2 = center + (innerRadius + tickLength) * Math.cos(rad);
						const y2 = center + (innerRadius + tickLength) * Math.sin(rad);
						return (
							<line
								key={`inner-tick-${i}`}
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke={strokeSoft}
								strokeWidth={tickWidth}
							/>
						);
					})}
				</g>
			)}

			{zodiacSigns.map((sign) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle + 15));
				const x = center + zodiacRadius * Math.cos(rad);
				const y = center + zodiacRadius * Math.sin(rad);
				const el = elementForZodiacId(sign.id);
				const base = elementColors[el];
				const fill = isDark ? wheelZodiacFillOnDark(base) : base;
				const zHref = zodiacGlyphSrc(sign.id);
				return zHref ? (
					<WheelTintedGlyphImage
						key={sign.name}
						href={zHref}
						x={x}
						y={y}
						size={24}
						filterId={`${wheelFilterUid}-z-${sign.id}`}
					/>
				) : (
					<text
						key={sign.name}
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="20"
						fontWeight="500"
						fill={fill}
					>
						{sign.icon}
					</text>
				);
			})}

			{/* Layer: Hemispheric Overlay — above zodiac ring, under inner radix (Informace) */}
			{showAxisLines && hasAxisGeometry && (
				<g data-handoff="Layer_HemisphericOverlay" style={{ pointerEvents: 'none' }}>
					{overlayPath && (
						<path
							d={overlayPath}
							fill={hemisphereOverlay.startsWith('mc-ic') ? overlayTintAlt : overlayTint}
							opacity={1}
						/>
					)}
				</g>
			)}

			<circle
				cx={center}
				cy={center}
				r={houseOuterRadius}
				fill="none"
				stroke={strokeMain}
				strokeWidth="1.25"
				opacity={0.72}
			/>

			<circle
				cx={center}
				cy={center}
				r={innerCenterRing}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>

			{/* houseInnerRadius === innerCenterCore by design — the house band sits flush against it, so its inner edge is this circle, not a separate one. */}
			<circle
				cx={center}
				cy={center}
				r={innerCenterCore}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>

			{/* House cusps from the computed house system; projected after ASC rotation. */}
			{wheelHouseCusps.length === 12 && (
				<g data-handoff="Layer_HouseCusps" style={{ pointerEvents: 'none' }}>
					{wheelHouseCusps.map((cusp, idx) => {
						const p1 = polar(center, center, houseInnerRadius, displayLon(cusp));
						const p2 = polar(center, center, houseOuterRadius, displayLon(cusp));
						const next = wheelHouseCusps[(idx + 1) % wheelHouseCusps.length]!;
						const labelLon = midpointLongitude(cusp, next);
						const label = polar(center, center, houseLabelRadius, displayLon(labelLon));
						const isAngular = idx === 0 || idx === 3 || idx === 6 || idx === 9;
						return (
							<g key={`house-cusp-${idx + 1}`}>
								<line
									x1={p1.x}
									y1={p1.y}
									x2={p2.x}
									y2={p2.y}
									stroke={strokeMain}
									strokeWidth={isAngular ? 1.25 : 0.9}
									opacity={isAngular ? 0.85 : 0.64}
								/>
								<text
									x={label.x}
									y={label.y}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize="13"
									fontWeight={isAngular ? 700 : 600}
									fill={planetGlyphColor}
									opacity={0.86}
								>
									{idx + 1}
								</text>
							</g>
						);
					})}
				</g>
			)}

			{/* Axis lines for hemisphere boundaries */}
			{showAxisLines && hasAxisGeometry && pAsc && pDsc && pMc && pIc && (
				<g data-handoff="Layer_AxisLines" stroke="var(--token-wheel-axis)">
					<line
						x1={pAsc.x}
						y1={pAsc.y}
						x2={pDsc.x}
						y2={pDsc.y}
						strokeWidth="1.25"
						strokeDasharray="4 3"
					/>
					<line
						x1={pMc.x}
						y1={pMc.y}
						x2={pIc.x}
						y2={pIc.y}
						strokeWidth="1.25"
						strokeDasharray="2 2"
						opacity={0.85}
					/>
				</g>
			)}

			{/* Selected angle points from observable objects */}
			{showPlanetGlyphs && anglePoints.length > 0 && (
				<g data-handoff="Layer_AngleGlyphs">
					{anglePoints.map(({ key, icon, longitude }) => {
						const p = polar(center, center, angleMarkerRadius, displayLon(longitude));
						const angleHref = astrologyGlyphSrc(key);
						return (
							<g
								key={key}
								data-handoff={`Angle_${key}`}
								style={{ cursor: 'pointer' }}
								onClick={(event) => emitObjectClick(event, key === 'dsc' ? 'desc' : key, 'radix')}
							>
								<circle cx={p.x} cy={p.y} r="18" fill="transparent" />
								{selectedObject?.layer === 'radix' &&
									selectedObject.bodyId === (key === 'dsc' ? 'desc' : key) && (
										<circle cx={p.x} cy={p.y} r="18" fill="var(--token-wheel-highlight)" />
									)}
								{angleHref ? (
									isDark ? (
										<WheelTintedGlyphImage
											key="dark"
											href={angleHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={planetDarkFilterId}
										/>
									) : (
										<WheelTintedGlyphImage
											key="light"
											href={angleHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={planetLightFilterId}
										/>
									)
								) : (
									<text
										x={p.x}
										y={p.y}
										textAnchor="middle"
										dominantBaseline="middle"
										fontSize="11"
										fontWeight="700"
										fill={planetGlyphColor}
									>
										{icon}
									</text>
								)}
							</g>
						);
					})}
				</g>
			)}

			{/* Layer: radix aspect lines (from computed aspects) */}
			<g data-handoff="Layer_AspectLines" opacity={aspectList.length > 0 ? 1 : 0}>
				{aspectList.flatMap((aspect, idx) => {
					const aLon = longitudeForAspectPoint(
						aspect.from,
						wheelBodyLongitudes,
						wheelAxisLongitudes
					);
					const bLon = longitudeForAspectPoint(aspect.to, wheelBodyLongitudes, wheelAxisLongitudes);
					if (aLon === null || bLon === null) return [];
					const pa = polar(center, center, radixAspectChordRadius, displayLon(aLon));
					const pb = polar(center, center, radixAspectChordRadius, displayLon(bLon));
					const maxOrb = maxOrbForAspectType(aspect.type, orbTable);
					const orbTier = aspectOrbTier(aspect.orb, maxOrb, tierStyle);
					const sw = strokeWidthForAspectTier(orbTier, tierStyle);
					const dasharray = strokeDasharrayForAspectTier(orbTier, tierStyle.outerLineStyle, sw);
					const baseHex = colorTable[aspect.type] ?? 'var(--token-viz-2)';
					const stroke =
						baseHex.length === 7 && baseHex.startsWith('#')
							? `${baseHex}${isDark ? '99' : 'cc'}`
							: baseHex;
					const key = `${aspect.from}-${aspect.to}-${aspect.type}-${idx}`;
					const isSelected = selectedAspectIndex === idx;
					const selectionActive = selectedAspectIndex != null;
					const isHighlighted = highlightAspectIndices.has(idx);
					const highlightActive = highlightAspectIndices.size > 0;
					const emphasized = isSelected || isHighlighted;
					const dimActive = selectionActive || highlightActive;
					return [
						<g key={key}>
							<line
								x1={pa.x}
								y1={pa.y}
								x2={pb.x}
								y2={pb.y}
								stroke={stroke}
								strokeWidth={sw}
								strokeLinecap="round"
								strokeDasharray={dasharray}
								opacity={dimActive ? (emphasized ? 1 : 0.15) : 0.5}
								style={{ transition: 'opacity 0.16s ease' }}
							/>
							<line
								x1={pa.x}
								y1={pa.y}
								x2={pb.x}
								y2={pb.y}
								stroke="transparent"
								strokeWidth={Math.max(12, sw + 8)}
								strokeLinecap="round"
								style={{
									cursor: 'pointer',
									pointerEvents: 'stroke'
								}}
								onClick={(event) => {
									event.stopPropagation();
									onAspectClick?.({ aspect, index: idx });
								}}
							/>
						</g>
					];
				})}
			</g>

			{/* Planets */}
			{showPlanetGlyphs && (
				<g data-handoff="Layer_PlanetGlyphs">
					{bodies.flatMap(({ key, icon }) => {
						const lon = wheelBodyLongitudes[key];
						if (typeof lon !== 'number') return [];
						const placement = bodyPlacementByKey.get(key);
						const p = polar(
							center,
							center,
							placement?.radius ?? planetRadius,
							displayLon(placement?.renderLon ?? lon)
						);
						const isSelected =
							selectedObject?.layer === 'radix' && selectedObject.bodyId === key;
						const hi = highlightBodies.has(key);
						let hemiDim = 1;
						if (hemisphereOverlay !== 'off') {
							if (hemisphereOverlay === 'asc-dsc-east') {
								hemiDim = planetEastWestHemisphere(lon) === 'east' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'asc-dsc-west') {
								hemiDim = planetEastWestHemisphere(lon) === 'west' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'mc-ic-north') {
								hemiDim = planetNorthSouthHemisphere(lon) === 'north' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'mc-ic-south') {
								hemiDim = planetNorthSouthHemisphere(lon) === 'south' ? 1 : 0.42;
							}
						}
						const dim =
							(dimNonHighlighted && highlightBodies.size > 0 && !hi
								? 0.38
								: hi
									? 1
									: dimNonHighlighted
										? 0.62
										: 1) * hemiDim;
						const planetHref = astrologyGlyphSrc(key);
						/** Selected glyph's exact longitude on the ring, terminating at `innerRadius` — the side opposite the outward-facing degree ticks. */
						const boundaryPoint = polar(center, center, innerRadius, displayLon(lon));
						return [
							...(isSelected
								? [
										<g key={`${key}-trailer`} data-handoff={`Trailer_${key}`} pointerEvents="none">
											<line
												x1={p.x}
												y1={p.y}
												x2={boundaryPoint.x}
												y2={boundaryPoint.y}
												stroke="var(--theme-accent)"
												strokeWidth={1}
												strokeDasharray="2 2"
												opacity={0.85}
											/>
											<circle
												cx={boundaryPoint.x}
												cy={boundaryPoint.y}
												r={2.5}
												fill="var(--theme-accent)"
												opacity={0.9}
											/>
										</g>
									]
								: []),
							<g
								key={key}
								data-handoff={`Planet_${key}`}
								opacity={dim}
								style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
								onClick={(event) => emitObjectClick(event, key, 'radix')}
							>
								<circle cx={p.x} cy={p.y} r="22" fill="transparent" />
								{(hi || isSelected) && (
									<circle
										cx={p.x}
										cy={p.y}
										r="22"
										fill="var(--token-wheel-highlight)"
										filter="url(#hw-planet-halo)"
									/>
								)}
								{planetHref ? (
									isDark ? (
										<WheelTintedGlyphImage
											key="dark"
											href={planetHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={planetDarkFilterId}
										/>
									) : (
										<WheelTintedGlyphImage
											key="light"
											href={planetHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={planetLightFilterId}
										/>
									)
								) : (
									<text
										x={p.x}
										y={p.y}
										textAnchor="middle"
										dominantBaseline="middle"
										fontSize="18"
										fontWeight="600"
										fill={planetGlyphColor}
									>
										{icon}
									</text>
								)}
							</g>
						];
					})}
				</g>
			)}
		</svg>
	);
}
