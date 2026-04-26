/**
 * Horoscope wheel SVG — single source shared with Horoskop tab (`HoroscopeDashboard`).
 * Developer handoff id: HoroscopeWheel
 */
import { useId } from 'react';
import {
	DEFAULT_ELEMENT_COLORS,
	elementForZodiacId,
	wheelZodiacFillOnDark,
	type ElementColors
} from '@/lib/astrology/elementColors';
import {
	ASPECT_ROWS,
	DEFAULT_ASPECT_COLORS,
	DEFAULT_ASPECT_ORBS
} from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS } from '@/lib/astrology/observableObjects';
import { getAstrologyGlyphSrc, getZodiacGlyphSrc, type AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import type { AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '@/lib/tauri/chartPayload';
import type { Theme } from './astrology-sidebar';

/** Dark themes: planet SVGs (no per-color filter assets). */
function WheelPlanetImageDark({ href, x, y, size }: { href: string; x: number; y: number; size: number }) {
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
				filter: 'invert(1) brightness(0.42) contrast(1.1)'
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

function strokeWidthFromOrbTiers(
	orbDeg: number,
	maxOrbDeg: number,
	tier: AspectLineTierStyleState
): number {
	const max = Math.max(maxOrbDeg, 1e-9);
	const pct = (Math.abs(orbDeg) / max) * 100;
	const t = tier.tightThresholdPct;
	const m = Math.max(tier.mediumThresholdPct, t);
	const l = Math.max(tier.looseThresholdPct, m);
	if (pct <= t) return tier.widthTight;
	if (pct <= m) return tier.widthMedium;
	if (pct <= l) return tier.widthLoose;
	return tier.widthOuter;
}

export interface RadixAspectDrawInput {
	from: string;
	to: string;
	type: string;
	orb: number;
}

export interface HoroscopeWheelProps {
	theme: Theme;
	/**
	 * When set, planet and zodiac marks use `static/glyphs/.../planets/*.svg` and `.../zodiac/*.svg`
	 * as native `<image>` with per-tint SVG filters (`elementColors` for signs; primary for light planets).
	 */
	glyphSet?: AstrologyGlyphSetId;
	/** Fire / earth / air / water colors for zodiac ring on the wheel. */
	elementColors?: ElementColors;
	/** Resolved CSS color for light-theme planet glyphs (typically `--color-primary`). */
	lightPlanetFill?: string;
	bodyLongitudes?: Partial<Record<string, number>>;
	bodyOrder?: readonly HoroscopeWheelBody[];
	axisLongitudes?: Partial<HoroscopeWheelAxis>;
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
	className?: string;
}

export function HoroscopeWheel({
	theme,
	glyphSet,
	bodyLongitudes,
	bodyOrder,
	axisLongitudes,
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
	lightPlanetFill = '#030213',
	className
}: HoroscopeWheelProps) {
	const isDark = theme === 'midnight' || theme === 'twilight';
	const wheelFilterUid = useId().replace(/:/g, '');
	const planetLightFilterId = `${wheelFilterUid}-pl`;
	const wheelSize = 800;
	const center = wheelSize / 2;
	const outerRadius = 320;
	const innerRadius = 270;
	const innerCenterRing = 184;
	const innerCenterCore = 152;
	/** Small outward nudge from the original mid-band radii (larger values crowded the layout). */
	const glyphRadialOutset = 3;
	const planetRadius = (innerRadius + innerCenterRing) / 2 - 8 + glyphRadialOutset;
	/** Aspect chords on the inner radix band (between core and inner ring), not at glyph radius. */
	const radixAspectChordRadius = (innerCenterCore + innerCenterRing) / 2;
	const zodiacRadius = (innerRadius + outerRadius) / 2 + glyphRadialOutset;
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

	const strokeMain = isDark ? 'rgba(255,255,255,0.5)' : '#000000';
	const strokeSoft = isDark ? 'rgba(255,255,255,0.4)' : '#000000';
	const fillBg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
	const wheelRotationOffset = 0;
	const displayLon = (lon: number) => normalizeDeg(lon + wheelRotationOffset);

	const bodies: { key: HoroscopeWheelBody; icon: string }[] = (bodyOrder ?? DEFAULT_WHEEL_BODY_ORDER).map(
		(key) => ({
			key,
			icon: OBSERVABLE_OBJECT_META.get(key)?.icon ?? key.slice(0, 3)
		})
	);
	const anglePoints: { key: 'asc' | 'dsc' | 'mc' | 'ic'; icon: string; longitude: number }[] = [
		typeof axisAsc === 'number' ? { key: 'asc', icon: OBSERVABLE_OBJECT_META.get('asc')?.icon ?? 'Asc', longitude: axisAsc } : null,
		typeof axisDsc === 'number' ? { key: 'dsc', icon: OBSERVABLE_OBJECT_META.get('desc')?.icon ?? 'Dsc', longitude: axisDsc } : null,
		typeof axisMc === 'number' ? { key: 'mc', icon: OBSERVABLE_OBJECT_META.get('mc')?.icon ?? 'MC', longitude: axisMc } : null,
		typeof axisIc === 'number' ? { key: 'ic', icon: OBSERVABLE_OBJECT_META.get('ic')?.icon ?? 'IC', longitude: axisIc } : null
	].filter((item): item is { key: 'asc' | 'dsc' | 'mc' | 'ic'; icon: string; longitude: number } => item !== null);
	const planetGlyphColor = isDark ? '#cbd5e1' : lightPlanetFill;
	const elementColors = elementColorsProp;
	const angleMarkerRadius = outerRadius + 22;

	const pAsc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisAsc)) : null;
	const pDsc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisDsc)) : null;
	const pMc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisMc)) : null;
	const pIc = hasAxisGeometry ? polar(center, center, outerRadius + 4, displayLon(axisIc)) : null;

	const overlayTint = isDark ? 'rgba(59, 130, 246, 0.14)' : 'rgba(37, 99, 235, 0.12)';
	const overlayTintAlt = isDark ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.1)';

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
	const colorTable = { ...DEFAULT_ASPECT_COLORS, ...(aspectColorsForRadix ?? {}) };
	const aspectList = radixAspects ?? [];

	return (
		<svg
			data-handoff="HoroscopeWheel"
			width="100%"
			height="100%"
			viewBox={`0 0 ${wheelSize} ${wheelSize}`}
			className={className}
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				<filter id="hw-planet-halo" x="-100%" y="-100%" width="300%" height="300%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				{!isDark && glyphSet ? (
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
				) : null}
				{glyphSet
					? zodiacSigns.map((sign) => {
							const href = getZodiacGlyphSrc(glyphSet, sign.id);
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
			</defs>

			<circle cx={center} cy={center} r={outerRadius + 60} fill={fillBg} />

			<circle cx={center} cy={center} r={outerRadius} fill="none" stroke={strokeMain} strokeWidth="1.5" />
			<circle cx={center} cy={center} r={innerRadius} fill="none" stroke={strokeMain} strokeWidth="1.5" />

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
						strokeWidth="1.5"
					/>
				);
			})}

			<g>
			{Array.from({ length: 360 }, (_, i) => {
					const rad = longitudeToScreenRadians(displayLon(i));
					const is10Degree = i % 10 === 0;
					const is5Degree = i % 5 === 0;
					let tickLength: number;
					let tickWidth: number;
					if (is10Degree) {
						tickLength = 20;
						tickWidth = 1.5;
					} else if (is5Degree) {
						tickLength = 12;
						tickWidth = 1.2;
					} else {
						tickLength = 8;
						tickWidth = 0.5;
					}
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

			{zodiacSigns.map((sign) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle + 15));
				const x = center + zodiacRadius * Math.cos(rad);
				const y = center + zodiacRadius * Math.sin(rad);
				const el = elementForZodiacId(sign.id);
				const base = elementColors[el];
				const fill = isDark ? wheelZodiacFillOnDark(base) : base;
				const zHref = glyphSet ? getZodiacGlyphSrc(glyphSet, sign.id) : null;
				return zHref ? (
					<WheelTintedGlyphImage
						key={sign.name}
						href={zHref}
						x={x}
						y={y}
						size={20}
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
				r={innerCenterRing}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>
			<circle
				cx={center}
				cy={center}
				r={innerCenterCore}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>

			{/* Axis lines for hemisphere boundaries */}
			{showAxisLines && hasAxisGeometry && pAsc && pDsc && pMc && pIc && (
				<g data-handoff="Layer_AxisLines" stroke={isDark ? 'rgba(96,165,250,0.85)' : 'rgba(37,99,235,0.75)'}>
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
						const angleHref = glyphSet ? getAstrologyGlyphSrc(glyphSet, key) : null;
						return (
							<g key={key} data-handoff={`Angle_${key}`}>
								{angleHref ? (
									isDark ? (
										<WheelPlanetImageDark href={angleHref} x={p.x} y={p.y} size={18} />
									) : (
										<WheelTintedGlyphImage
											href={angleHref}
											x={p.x}
											y={p.y}
											size={18}
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
			<g
				data-handoff="Layer_AspectLines"
				opacity={aspectList.length > 0 ? 0.5 : 0}
				style={{ pointerEvents: 'none' }}
			>
				{aspectList.flatMap((aspect, idx) => {
					const aLon = longitudeForAspectPoint(aspect.from, wheelBodyLongitudes, wheelAxisLongitudes);
					const bLon = longitudeForAspectPoint(aspect.to, wheelBodyLongitudes, wheelAxisLongitudes);
					if (aLon === null || bLon === null) return [];
					const pa = polar(center, center, radixAspectChordRadius, displayLon(aLon));
					const pb = polar(center, center, radixAspectChordRadius, displayLon(bLon));
					const maxOrb = maxOrbForAspectType(aspect.type, orbTable);
					const sw = strokeWidthFromOrbTiers(aspect.orb, maxOrb, tierStyle);
					const baseHex = colorTable[aspect.type] ?? '#64748b';
					const stroke =
						baseHex.length === 7 && baseHex.startsWith('#')
							? `${baseHex}${isDark ? '99' : 'cc'}`
							: baseHex;
					const key = `${aspect.from}-${aspect.to}-${aspect.type}-${idx}`;
					return [
						<line
							key={key}
							x1={pa.x}
							y1={pa.y}
							x2={pb.x}
							y2={pb.y}
							stroke={stroke}
							strokeWidth={sw}
							strokeLinecap="round"
						/>
					];
				})}
			</g>

			{/* Planets */}
			{showPlanetGlyphs && (
				<g data-handoff="Layer_PlanetGlyphs">
					{bodies.flatMap(({ key, icon }) => {
						const lon = wheelBodyLongitudes[key];
						if (typeof lon !== 'number') return [];
						const p = polar(center, center, planetRadius, displayLon(lon));
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
						const planetHref = glyphSet ? getAstrologyGlyphSrc(glyphSet, key) : null;
						return [(
							<g
								key={key}
								data-handoff={`Planet_${key}`}
								opacity={dim}
								style={{ transition: 'opacity 0.2s ease' }}
							>
								{hi && (
									<circle
										cx={p.x}
										cy={p.y}
										r="22"
										fill={isDark ? 'rgba(250,204,21,0.2)' : 'rgba(250,204,21,0.35)'}
										filter="url(#hw-planet-halo)"
									/>
								)}
								{planetHref ? (
									isDark ? (
										<WheelPlanetImageDark href={planetHref} x={p.x} y={p.y} size={18} />
									) : (
										<WheelTintedGlyphImage
											href={planetHref}
											x={p.x}
											y={p.y}
											size={18}
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
						)];
					})}
				</g>
			)}
		</svg>
	);
}
