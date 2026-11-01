import { polar } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame, type WheelObjectLayer } from '../wheel-frame';
import { WheelTintedGlyphImage } from '../wheel-tinted-glyph';

export interface AnglePoint {
	key: 'asc' | 'dsc' | 'mc' | 'ic';
	icon: string;
	longitude: number;
}

/** ASC, DSC, MC and IC glyphs just outside the zodiac ring (clickable like bodies). */
export function AngleGlyphs({
	frame,
	points,
	selectedObject
}: {
	frame: WheelFrame;
	points: AnglePoint[];
	selectedObject?: { bodyId: string; layer: WheelObjectLayer } | null;
}) {
	const { center, angleMarkerRadius } = WHEEL;
	return (
		<g data-handoff="Layer_AngleGlyphs">
			{points.map(({ key, icon, longitude }) => {
				const p = polar(center, center, angleMarkerRadius, frame.displayLon(longitude));
				const angleHref = frame.astrologyGlyphSrc(key);
				const angleId = key === 'dsc' ? 'desc' : key;
				return (
					<g
						key={key}
						data-handoff={`Angle_${key}`}
						style={{ cursor: 'pointer' }}
						onClick={(event) => frame.emitObjectClick(event, angleId, 'radix')}
					>
						<circle cx={p.x} cy={p.y} r="18" fill="transparent" />
						{selectedObject?.layer === 'radix' && selectedObject.bodyId === angleId && (
							<circle cx={p.x} cy={p.y} r="18" fill="var(--token-wheel-highlight)" />
						)}
						{angleHref ? (
							<WheelTintedGlyphImage
								key={frame.isDark ? 'dark' : 'light'}
								href={angleHref}
								x={p.x}
								y={p.y}
								size={22}
								filterId={frame.bodyGlyphFilterId(angleId)}
							/>
						) : (
							<text
								x={p.x}
								y={p.y}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize="11"
								fontWeight="700"
								fill={frame.bodyGlyphFillColor(angleId)}
							>
								{icon}
							</text>
						)}
					</g>
				);
			})}
		</g>
	);
}
