import { polar } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame, type WheelObjectLayer } from '../wheel-frame';
import { WheelTintedGlyphImage } from '../wheel-tinted-glyph';

/** Outer ring of transit (event) bodies around the radix, drawn in the accent color. */
export function TransitRing({
	frame,
	bodies,
	longitudes,
	selectedObject
}: {
	frame: WheelFrame;
	bodies: { key: string; icon: string }[];
	longitudes?: Partial<Record<string, number>>;
	selectedObject?: { bodyId: string; layer: WheelObjectLayer } | null;
}) {
	const { center, transitRingOuterRadius, transitRingInnerRadius, transitGlyphRadius } = WHEEL;
	return (
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
			{bodies.flatMap(({ key, icon }) => {
				const lon = longitudes?.[key];
				if (typeof lon !== 'number') return [];
				const p = polar(center, center, transitGlyphRadius, frame.displayLon(lon));
				const planetHref = frame.astrologyGlyphSrc(key);
				return [
					<g
						key={`transit-${key}`}
						data-handoff={`TransitPlanet_${key}`}
						style={{ cursor: 'pointer' }}
						data-wheel-object=""
						onClick={(event) => frame.emitObjectClick(event, key, 'transit')}
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
								filterId={frame.transitGlyphFilterId(key)}
							/>
						) : (
							<text
								x={p.x}
								y={p.y}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize={icon.length > 2 ? 8 : 14}
								fontWeight="700"
								fill={frame.transitGlyphFillColor(key)}
							>
								{icon}
							</text>
						)}
					</g>
				];
			})}
		</g>
	);
}
