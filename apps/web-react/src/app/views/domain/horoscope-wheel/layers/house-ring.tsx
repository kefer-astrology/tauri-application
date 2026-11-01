import { midpointLongitude, polar } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame } from '../wheel-frame';

/** Inner circles and the house band: cusps from the computed house system, numbered. */
export function HouseRing({ frame, cusps }: { frame: WheelFrame; cusps: number[] }) {
	const { center, houseInnerRadius, houseOuterRadius, houseLabelRadius, strokeMain, strokeSoft } =
		WHEEL;
	const { displayLon } = frame;

	return (
		<>
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
				r={WHEEL.innerCenterRing}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>

			<circle
				cx={center}
				cy={center}
				r={WHEEL.innerCenterCore}
				fill="none"
				stroke={strokeSoft}
				strokeWidth="1.5"
			/>

			{cusps.length === 12 && (
				<g data-handoff="Layer_HouseCusps" style={{ pointerEvents: 'none' }}>
					{cusps.map((cusp, idx) => {
						const p1 = polar(center, center, houseInnerRadius, displayLon(cusp));
						const p2 = polar(center, center, houseOuterRadius, displayLon(cusp));
						const next = cusps[(idx + 1) % cusps.length]!;
						const label = polar(
							center,
							center,
							houseLabelRadius,
							displayLon(midpointLongitude(cusp, next))
						);
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
									fill={frame.planetGlyphColor}
									opacity={0.86}
								>
									{idx + 1}
								</text>
							</g>
						);
					})}
				</g>
			)}
		</>
	);
}
