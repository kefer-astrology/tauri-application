import { isInChartHalf, polar, type PlanetPlacement } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame, type WheelObjectLayer } from '../wheel-frame';
import { WheelTintedGlyphImage } from '../wheel-tinted-glyph';
import type { HemisphereOverlayKind } from './hemisphere-overlay';

/** Opacity of a body for the hemisphere overlay: full in the highlighted half. */
function hemisphereOpacity(
	lon: number,
	overlay: HemisphereOverlayKind,
	ascDeg: number,
	mcDeg: number
): number {
	if (overlay === 'off') return 1;
	return isInChartHalf(lon, overlay, { asc: ascDeg, mc: mcDeg }) ? 1 : 0.42;
}

/** Radix bodies in the planet band (conjunctions fanned), with highlight halo, dimming, and a
 *  dashed trailer from the selected body to its true longitude on the ring. */
export function PlanetGlyphs({
	frame,
	bodies,
	longitudes,
	placements,
	selectedObject,
	highlightBodies,
	dimNonHighlighted,
	hemisphereOverlay,
	hemisphereAsc,
	hemisphereMc
}: {
	frame: WheelFrame;
	bodies: { key: string; icon: string }[];
	longitudes: Partial<Record<string, number>>;
	placements: Map<string, PlanetPlacement>;
	selectedObject?: { bodyId: string; layer: WheelObjectLayer } | null;
	highlightBodies: ReadonlySet<string>;
	dimNonHighlighted: boolean;
	hemisphereOverlay: HemisphereOverlayKind;
	hemisphereAsc: number;
	hemisphereMc: number;
}) {
	const { center, planetRadius, innerRadius } = WHEEL;
	const { displayLon } = frame;
	return (
		<g data-handoff="Layer_PlanetGlyphs">
			{bodies.flatMap(({ key, icon }) => {
				const lon = longitudes[key];
				if (typeof lon !== 'number') return [];
				const placement = placements.get(key);
				const p = polar(
					center,
					center,
					placement?.radius ?? planetRadius,
					displayLon(placement?.renderLon ?? lon)
				);
				const isSelected = selectedObject?.layer === 'radix' && selectedObject.bodyId === key;
				const hi = highlightBodies.has(key);
				const hemiDim = hemisphereOpacity(lon, hemisphereOverlay, hemisphereAsc, hemisphereMc);
				const dim =
					(dimNonHighlighted && highlightBodies.size > 0 && !hi
						? 0.38
						: hi
							? 1
							: dimNonHighlighted
								? 0.62
								: 1) * hemiDim;
				const planetHref = frame.astrologyGlyphSrc(key);
				/** The selected body's true longitude on the ring, opposite the degree ticks. */
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
						data-wheel-object=""
						onClick={(event) => frame.emitObjectClick(event, key, 'radix')}
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
							<WheelTintedGlyphImage
								key={frame.isDark ? 'dark' : 'light'}
								href={planetHref}
								x={p.x}
								y={p.y}
								size={22}
								filterId={frame.bodyGlyphFilterId(key)}
							/>
						) : (
							<text
								x={p.x}
								y={p.y}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize="18"
								fontWeight="600"
								fill={frame.bodyGlyphFillColor(key)}
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
