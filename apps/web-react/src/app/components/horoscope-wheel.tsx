/**
 * Horoscope wheel SVG — single source shared with Horoskop tab (`HoroscopeDashboard`).
 * Developer handoff id: HoroscopeWheel
 */
import type { Theme } from './astrology-sidebar';

export type HoroscopeWheelBody =
	| 'sun'
	| 'moon'
	| 'mercury'
	| 'venus'
	| 'mars'
	| 'jupiter'
	| 'saturn'
	| 'uranus'
	| 'neptune'
	| 'pluto';

export type HemisphereOverlayKind =
	| 'off'
	| 'asc-dsc-east'
	| 'asc-dsc-west'
	| 'mc-ic-north'
	| 'mc-ic-south';

const zodiacSigns = [
	{ name: 'Aries', icon: '♈', angle: 0 },
	{ name: 'Taurus', icon: '♉', angle: 30 },
	{ name: 'Gemini', icon: '♊', angle: 60 },
	{ name: 'Cancer', icon: '♋', angle: 90 },
	{ name: 'Leo', icon: '♌', angle: 120 },
	{ name: 'Virgo', icon: '♍', angle: 150 },
	{ name: 'Libra', icon: '♎', angle: 180 },
	{ name: 'Scorpio', icon: '♏', angle: 210 },
	{ name: 'Sagittarius', icon: '♐', angle: 240 },
	{ name: 'Capricorn', icon: '♑', angle: 270 },
	{ name: 'Aquarius', icon: '♒', angle: 300 },
	{ name: 'Pisces', icon: '♓', angle: 330 }
];

/** Ecliptic longitudes (°) — aligned with `horoscope-dashboard` mock radix for handoff */
const DEFAULT_BODY_LONGITUDE: Record<HoroscopeWheelBody, number> = {
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

export interface HoroscopeWheelProps {
	theme: Theme;
	bodyLongitudes?: Partial<Record<HoroscopeWheelBody, number>>;
	axisLongitudes?: Partial<HoroscopeWheelAxis>;
	useFallbackData?: boolean;
	/** Bodies that receive a soft halo (badge hover, singleton, focal planets, …) */
	highlightBodies?: ReadonlySet<HoroscopeWheelBody>;
	/** When true, non-highlighted planets/icons are dimmed (hemisphere / focus preview) */
	dimNonHighlighted?: boolean;
	hemisphereOverlay?: HemisphereOverlayKind;
	/** Aspect lines between bodies — default hidden; show in “Dynamika” or histogram hover */
	showAspectLines?: boolean;
	/** Horoskop tab uses radix-only wheel; Informace view enables glyphs + axes */
	showPlanetGlyphs?: boolean;
	showAxisLines?: boolean;
	className?: string;
}

export function HoroscopeWheel({
	theme,
	bodyLongitudes,
	axisLongitudes,
	useFallbackData = true,
	highlightBodies = new Set(),
	dimNonHighlighted = false,
	hemisphereOverlay = 'off',
	showAspectLines = false,
	showPlanetGlyphs = false,
	showAxisLines = false,
	className
}: HoroscopeWheelProps) {
	const isDark = theme === 'midnight' || theme === 'twilight';
	const wheelSize = 800;
	const center = wheelSize / 2;
	const outerRadius = 320;
	const innerRadius = 270;
	const innerCenterRing = 184;
	const innerCenterCore = 152;
	const planetRadius = (innerRadius + innerCenterRing) / 2 - 8;
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

	const zodiacWithColors = [
		{ ...zodiacSigns[0], color: '#ef4444' },
		{ ...zodiacSigns[1], color: '#000000' },
		{ ...zodiacSigns[2], color: '#22c55e' },
		{ ...zodiacSigns[3], color: '#3b82f6' },
		{ ...zodiacSigns[4], color: '#ef4444' },
		{ ...zodiacSigns[5], color: '#000000' },
		{ ...zodiacSigns[6], color: '#22c55e' },
		{ ...zodiacSigns[7], color: '#3b82f6' },
		{ ...zodiacSigns[8], color: '#ef4444' },
		{ ...zodiacSigns[9], color: '#000000' },
		{ ...zodiacSigns[10], color: '#22c55e' },
		{ ...zodiacSigns[11], color: '#3b82f6' }
	];

	const bodies: { key: HoroscopeWheelBody; icon: string }[] = [
		{ key: 'sun', icon: '☉' },
		{ key: 'moon', icon: '☽' },
		{ key: 'mercury', icon: '☿' },
		{ key: 'venus', icon: '♀' },
		{ key: 'mars', icon: '♂' },
		{ key: 'jupiter', icon: '♃' },
		{ key: 'saturn', icon: '♄' },
		{ key: 'uranus', icon: '♅' },
		{ key: 'neptune', icon: '♆' },
		{ key: 'pluto', icon: '♇' }
	];

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

	const aspectPairs: [HoroscopeWheelBody, HoroscopeWheelBody][] = [
		['sun', 'moon'],
		['venus', 'mars'],
		['jupiter', 'saturn']
	];

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

			{zodiacWithColors.map((sign) => {
				const rad = longitudeToScreenRadians(displayLon(sign.angle + 15));
				const zodiacRadius = (innerRadius + outerRadius) / 2;
				const x = center + zodiacRadius * Math.cos(rad);
				const y = center + zodiacRadius * Math.sin(rad);
				let finalColor = sign.color;
				if (isDark && sign.color !== '#000000') {
					finalColor = sign.color + 'dd';
				} else if (isDark && sign.color === '#000000') {
					finalColor = '#ffffff';
				}
				return (
					<text
						key={sign.name}
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="20"
						fontWeight="500"
						fill={finalColor}
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

			{/* Layer: aspect lines (default off) */}
			<g
				data-handoff="Layer_AspectLines"
				opacity={showAspectLines ? 0.45 : 0}
				style={{ pointerEvents: 'none' }}
			>
					{aspectPairs.flatMap(([a, b]) => {
						const aLon = wheelBodyLongitudes[a];
						const bLon = wheelBodyLongitudes[b];
						if (typeof aLon !== 'number' || typeof bLon !== 'number') return [];
						const pa = polar(center, center, planetRadius, displayLon(aLon));
						const pb = polar(center, center, planetRadius, displayLon(bLon));
					return [(
						<line
							key={`${a}-${b}`}
							x1={pa.x}
							y1={pa.y}
							x2={pb.x}
							y2={pb.y}
							stroke={isDark ? 'rgba(250,204,21,0.6)' : 'rgba(161,98,7,0.55)'}
							strokeWidth="1.2"
						/>
					)];
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
								<text
									x={p.x}
									y={p.y}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize="18"
									fontWeight="600"
									fill={isDark ? '#f8fafc' : '#0f172a'}
								>
									{icon}
								</text>
							</g>
						)];
					})}
				</g>
			)}
		</svg>
	);
}
