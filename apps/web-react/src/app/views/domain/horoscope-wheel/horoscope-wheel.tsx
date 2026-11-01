/**
 * The radix wheel (SVG): zodiac ring, houses, axes, aspect lines, bodies and an optional transit
 * ring, drawn as layers in this order. Render rules: `docs/content/developer/radix-render-contract.md`.
 */
import { DEFAULT_ELEMENT_COLORS, type ElementColors } from '@/lib/astrology/elementColors';
import { DEFAULT_ASPECT_COLORS, DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS } from '@/lib/astrology/observableObjects';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import {
	normalizeHouseCusps,
	resolveDeclutteredPlacements,
	type WheelAxis
} from '@/lib/astrology/wheelGeometry';
import type { AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import { DEFAULT_ASPECT_LINE_TIER_STYLE } from '@/lib/tauri/chartPayload';
import { AngleGlyphs, type AnglePoint } from './layers/angle-glyphs';
import { AspectLines, type RadixAspectDrawInput } from './layers/aspect-lines';
import { AxisLines } from './layers/axis-lines';
import { HemisphereOverlay, type HemisphereOverlayKind } from './layers/hemisphere-overlay';
import { HouseRing } from './layers/house-ring';
import { PlanetGlyphs } from './layers/planet-glyphs';
import { TransitRing } from './layers/transit-ring';
import { WheelFilters } from './layers/wheel-filters';
import { ZodiacRing } from './layers/zodiac-ring';
import {
	DEFAULT_BODY_LONGITUDE,
	DEFAULT_WHEEL_BODY_ORDER,
	HOROSCOPE_WHEEL_AXIS
} from './wheel-demo-data';
import { useWheelFrame, WHEEL, type WheelObjectLayer } from './wheel-frame';

export type { HemisphereOverlayKind, RadixAspectDrawInput };

export type HoroscopeWheelBody = string;

const OBSERVABLE_OBJECT_META = new Map(
	OBSERVABLE_OBJECTS.map((item) => [item.id, { icon: item.icon }] as const)
);

const iconOf = (key: string, fallback = key.slice(0, 3)) =>
	OBSERVABLE_OBJECT_META.get(key)?.icon ?? fallback;

export type HoroscopeWheelObjectLayer = WheelObjectLayer;

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
	const frame = useWheelFrame({
		leftEdgeLongitude,
		elementColors: elementColorsProp,
		bodyColors,
		lightPlanetFill,
		onObjectClick
	});

	const wheelBodyLongitudes = useFallbackData
		? { ...DEFAULT_BODY_LONGITUDE, ...bodyLongitudes }
		: (bodyLongitudes ?? {});
	const wheelAxisLongitudes: Partial<WheelAxis> = useFallbackData
		? { ...HOROSCOPE_WHEEL_AXIS, ...axisLongitudes }
		: (axisLongitudes ?? {});
	const { asc, dsc, mc, ic } = wheelAxisLongitudes;
	const axis: WheelAxis | null =
		typeof asc === 'number' &&
		typeof dsc === 'number' &&
		typeof mc === 'number' &&
		typeof ic === 'number'
			? { asc, dsc, mc, ic }
			: null;

	const bodies = (bodyOrder ?? DEFAULT_WHEEL_BODY_ORDER).map((key) => ({ key, icon: iconOf(key) }));
	/** Conjunctions fan inward from the planet radius; true longitudes are used everywhere else. */
	const placements = resolveDeclutteredPlacements(
		bodies
			.map(({ key }) => ({ key, lon: wheelBodyLongitudes[key] }))
			.filter((entry): entry is { key: string; lon: number } => typeof entry.lon === 'number'),
		WHEEL.planetRadius,
		WHEEL.houseOuterRadius + 14
	);
	const transitBodies = (transitBodyOrder ?? []).map((key) => ({ key, icon: iconOf(key) }));
	const hasTransitBodies = transitBodies.some(
		({ key }) => typeof transitBodyLongitudes?.[key] === 'number'
	);
	const anglePoints: AnglePoint[] = [
		typeof asc === 'number'
			? { key: 'asc' as const, icon: iconOf('asc', 'Asc'), longitude: asc }
			: null,
		typeof dsc === 'number'
			? { key: 'dsc' as const, icon: iconOf('desc', 'Dsc'), longitude: dsc }
			: null,
		typeof mc === 'number' ? { key: 'mc' as const, icon: iconOf('mc', 'MC'), longitude: mc } : null,
		typeof ic === 'number' ? { key: 'ic' as const, icon: iconOf('ic', 'IC'), longitude: ic } : null
	].filter((point): point is AnglePoint => point !== null);

	return (
		<svg
			data-handoff="HoroscopeWheel"
			width="100%"
			height="100%"
			viewBox={`0 0 ${WHEEL.size} ${WHEEL.size}`}
			className={className}
			preserveAspectRatio="xMidYMid meet"
			onClick={onWheelBackgroundClick}
		>
			<WheelFilters frame={frame} />

			<circle cx={WHEEL.center} cy={WHEEL.center} r={WHEEL.outerRadius + 72} fill={WHEEL.fillBg} />

			{hasTransitBodies && (
				<TransitRing
					frame={frame}
					bodies={transitBodies}
					longitudes={transitBodyLongitudes}
					selectedObject={selectedObject}
				/>
			)}

			<ZodiacRing frame={frame} wheelStyle={wheelStyle} />

			{/* Above the zodiac ring, under the inner radix. */}
			{showAxisLines && axis && (
				<HemisphereOverlay frame={frame} axis={axis} kind={hemisphereOverlay} />
			)}

			<HouseRing frame={frame} cusps={normalizeHouseCusps(houseCusps)} />

			{showAxisLines && axis && <AxisLines frame={frame} axis={axis} />}

			{showPlanetGlyphs && anglePoints.length > 0 && (
				<AngleGlyphs frame={frame} points={anglePoints} selectedObject={selectedObject} />
			)}

			<AspectLines
				frame={frame}
				aspects={radixAspects ?? []}
				bodyLongitudes={wheelBodyLongitudes}
				axisLongitudes={wheelAxisLongitudes}
				orbTable={{ ...DEFAULT_ASPECT_ORBS, ...(aspectOrbsForRadix ?? {}) }}
				colorTable={{ ...DEFAULT_ASPECT_COLORS, ...(aspectColorsForRadix ?? {}) }}
				tierStyle={aspectLineTierStyleProp ?? DEFAULT_ASPECT_LINE_TIER_STYLE}
				selectedAspectIndex={selectedAspectIndex}
				highlightAspectIndices={highlightAspectIndices}
				onAspectClick={onAspectClick}
			/>

			{showPlanetGlyphs && (
				<PlanetGlyphs
					frame={frame}
					bodies={bodies}
					longitudes={wheelBodyLongitudes}
					placements={placements}
					selectedObject={selectedObject}
					highlightBodies={highlightBodies}
					dimNonHighlighted={dimNonHighlighted}
					hemisphereOverlay={hemisphereOverlay}
					hemisphereAsc={asc ?? HOROSCOPE_WHEEL_AXIS.asc}
					hemisphereMc={mc ?? HOROSCOPE_WHEEL_AXIS.mc}
				/>
			)}
		</svg>
	);
}
