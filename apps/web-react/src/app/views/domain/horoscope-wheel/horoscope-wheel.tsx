/**
 * The radix wheel (SVG): zodiac ring, houses, axes, aspect lines, bodies and an optional transit
 * ring. Render rules: `docs/content/developer/radix-render-contract.md`.
 */
import { useId, type MouseEvent } from 'react';
import {
	DEFAULT_ELEMENT_COLORS,
	elementForZodiacId,
	wheelZodiacFillOnDark,
	type ElementColors
} from '@/lib/astrology/elementColors';
import { DEFAULT_ASPECT_COLORS, DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS } from '@/lib/astrology/observableObjects';
import { catalogSigns } from '@/lib/astrology/domainCatalog';
import { getAstrologyGlyphSrc, getZodiacGlyphSrc } from '@/lib/astrology/glyphs';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import { resolveCustomGlyphSrc, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import type { AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '@/lib/tauri/chartPayload';
import { normalizeDegrees } from '@/lib/astrology/foldedAngle';
import {
	aspectOrbTier,
	eastWestHemisphere,
	longitudeForAspectPoint,
	longitudeToScreenRadians,
	maxOrbForAspectType,
	midpointLongitude,
	normalizeHouseCusps,
	northSouthHemisphere,
	polar,
	resolveDeclutteredPlacements,
	strokeDasharrayForAspectTier,
	strokeWidthForAspectTier,
	type WheelAxis
} from '@/lib/astrology/wheelGeometry';
import { useAppTheme } from '@/app/providers/app-theme';
import {
	DEFAULT_BODY_LONGITUDE,
	DEFAULT_WHEEL_BODY_ORDER,
	HOROSCOPE_WHEEL_AXIS
} from './wheel-demo-data';
import { WheelTintedGlyphImage } from './wheel-tinted-glyph';

export type HoroscopeWheelBody = string;

const OBSERVABLE_OBJECT_META = new Map(
	OBSERVABLE_OBJECTS.map((item) => [item.id, { icon: item.icon }] as const)
);

export type HemisphereOverlayKind =
	'off' | 'asc-dsc-east' | 'asc-dsc-west' | 'mc-ic-north' | 'mc-ic-south';

const ZODIAC_PRESENTATION_GLYPHS: Record<string, string> = {
	aries: '♈',
	taurus: '♉',
	gemini: '♊',
	cancer: '♋',
	leo: '♌',
	virgo: '♍',
	libra: '♎',
	scorpio: '♏',
	sagittarius: '♐',
	capricorn: '♑',
	aquarius: '♒',
	pisces: '♓'
};

const zodiacSigns = () =>
	catalogSigns().map((sign, index) => ({
		name: sign.name,
		id: sign.id,
		icon: ZODIAC_PRESENTATION_GLYPHS[sign.id] ?? sign.glyph,
		angle: index * 30
	}));

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
	/**
	 * When set, planet and zodiac marks use `static/glyphs/.../planets/*.svg` and `.../zodiac/*.svg`
	 * as native `<image>` with per-tint SVG filters (`elementColors` for signs; primary for light planets).
	 */
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
	axisLongitudes?: Partial<WheelAxis>;
	/** House cusps 1-12 in ecliptic longitude, from backend/Swiss/JPL. */
	houseCusps?: readonly number[];
	/** Ecliptic longitude pinned to the left edge (computed ASC or 0° Aries). */
	leftEdgeLongitude?: number;
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
	/** Per-object glyph tint override (workspace defaults), keyed by body/angle id. Objects
	 *  absent from this map keep the default `lightPlanetFill`/dark-theme glyph color. */
	bodyColors?: Record<string, string>;
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
	wheelStyle = 'technical',
	bodyLongitudes,
	bodyOrder,
	transitBodyLongitudes,
	transitBodyOrder,
	axisLongitudes,
	houseCusps,
	leftEdgeLongitude,
	useFallbackData = true,
	highlightBodies = new Set(),
	dimNonHighlighted = false,
	hemisphereOverlay = 'off',
	radixAspects,
	aspectOrbsForRadix,
	aspectColorsForRadix,
	bodyColors,
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
	const { theme, glyphSet } = useAppTheme();
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
		houseOuterRadius +
		(innerRadius - houseOuterRadius) * planetBandOuterBias -
		8 +
		glyphRadialOutset;
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
	/** Hemisphere overlays split by the chart's own axes (the demo axes only without them). */
	const hemisphereAsc = axisAsc ?? HOROSCOPE_WHEEL_AXIS.asc;
	const hemisphereMc = axisMc ?? HOROSCOPE_WHEEL_AXIS.mc;
	const hasAxisGeometry =
		typeof axisAsc === 'number' &&
		typeof axisDsc === 'number' &&
		typeof axisMc === 'number' &&
		typeof axisIc === 'number';

	const strokeMain = 'var(--token-wheel-stroke-main)';
	const strokeSoft = 'var(--token-wheel-stroke-soft)';
	const fillBg = 'var(--token-wheel-bg)';
	const wheelRotationOffset =
		typeof leftEdgeLongitude === 'number' && Number.isFinite(leftEdgeLongitude)
			? -normalizeDegrees(leftEdgeLongitude)
			: 0;
	const displayLon = (lon: number) => normalizeDegrees(lon + wheelRotationOffset);
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
	const bodyGlyphFilterId = (id: string) =>
		bodyColors?.[id]
			? `${wheelFilterUid}-b-${id}`
			: isDark
				? planetDarkFilterId
				: planetLightFilterId;
	const bodyGlyphFillColor = (id: string) => bodyColors?.[id] ?? planetGlyphColor;
	/** Transit-ring counterpart to the two above — same per-body filter/color override,
	 *  falling back to the ring's own uniform accent tint (`transitFilterId`) rather than the
	 *  radix glyph color, since that accent color is what visually marks "this is the transit
	 *  layer" for every uncustomized body. */
	const transitGlyphFilterId = (id: string) =>
		bodyColors?.[id] ? `${wheelFilterUid}-b-${id}` : transitFilterId;
	const transitGlyphFillColor = (id: string) => bodyColors?.[id] ?? 'var(--theme-accent)';
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
					? zodiacSigns().map((sign) => {
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
				{glyphSet && bodyColors
					? Object.entries(bodyColors).map(([id, color]) => (
							<filter
								key={`bf-${id}`}
								id={`${wheelFilterUid}-b-${id}`}
								colorInterpolationFilters="sRGB"
								x="-50%"
								y="-50%"
								width="200%"
								height="200%"
							>
								<feFlood floodColor={color} floodOpacity="1" result="bc" />
								<feComposite in="bc" in2="SourceGraphic" operator="in" result="br" />
								<feMerge>
									<feMergeNode in="br" />
								</feMerge>
							</filter>
						))
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
										filterId={transitGlyphFilterId(key)}
									/>
								) : (
									<text
										x={p.x}
										y={p.y}
										textAnchor="middle"
										dominantBaseline="middle"
										fontSize={icon.length > 2 ? 8 : 14}
										fontWeight="700"
										fill={transitGlyphFillColor(key)}
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

			{zodiacSigns().map((sign, idx) => {
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

			{zodiacSigns().map((sign) => {
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
						const angleId = key === 'dsc' ? 'desc' : key;
						return (
							<g
								key={key}
								data-handoff={`Angle_${key}`}
								style={{ cursor: 'pointer' }}
								onClick={(event) => emitObjectClick(event, angleId, 'radix')}
							>
								<circle cx={p.x} cy={p.y} r="18" fill="transparent" />
								{selectedObject?.layer === 'radix' && selectedObject.bodyId === angleId && (
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
											filterId={bodyGlyphFilterId(angleId)}
										/>
									) : (
										<WheelTintedGlyphImage
											key="light"
											href={angleHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={bodyGlyphFilterId(angleId)}
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
										fill={bodyGlyphFillColor(angleId)}
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
						const isSelected = selectedObject?.layer === 'radix' && selectedObject.bodyId === key;
						const hi = highlightBodies.has(key);
						let hemiDim = 1;
						if (hemisphereOverlay !== 'off') {
							if (hemisphereOverlay === 'asc-dsc-east') {
								hemiDim = eastWestHemisphere(lon, hemisphereAsc) === 'east' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'asc-dsc-west') {
								hemiDim = eastWestHemisphere(lon, hemisphereAsc) === 'west' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'mc-ic-north') {
								hemiDim = northSouthHemisphere(lon, hemisphereMc) === 'north' ? 1 : 0.42;
							} else if (hemisphereOverlay === 'mc-ic-south') {
								hemiDim = northSouthHemisphere(lon, hemisphereMc) === 'south' ? 1 : 0.42;
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
											filterId={bodyGlyphFilterId(key)}
										/>
									) : (
										<WheelTintedGlyphImage
											key="light"
											href={planetHref}
											x={p.x}
											y={p.y}
											size={22}
											filterId={bodyGlyphFilterId(key)}
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
										fill={bodyGlyphFillColor(key)}
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
