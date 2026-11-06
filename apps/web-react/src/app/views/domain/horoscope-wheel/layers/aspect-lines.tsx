import {
	aspectOrbTier,
	longitudeForAspectPoint,
	maxOrbForAspectType,
	polar,
	strokeDasharrayForAspectTier,
	strokeWidthForAspectTier,
	type WheelAxis
} from '@/lib/astrology/wheelGeometry';
import type { AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import { WHEEL, type WheelFrame } from '../wheel-frame';

export interface RadixAspectDrawInput {
	from: string;
	to: string;
	type: string;
	orb: number;
}

/** Aspect chords inside the house band; width and dash by orb tier, color by aspect type. A
 *  selection or highlight dims the other chords. Each chord has a wider invisible hit line. */
export function AspectLines({
	frame,
	aspects,
	bodyLongitudes,
	axisLongitudes,
	orbTable,
	colorTable,
	tierStyle,
	selectedAspectIndex,
	highlightAspectIndices,
	onAspectClick
}: {
	frame: WheelFrame;
	aspects: RadixAspectDrawInput[];
	bodyLongitudes: Partial<Record<string, number>>;
	axisLongitudes: Partial<WheelAxis>;
	orbTable: Record<string, number>;
	colorTable: Record<string, string>;
	tierStyle: AspectLineTierStyleState;
	selectedAspectIndex?: number | null;
	highlightAspectIndices: ReadonlySet<number>;
	onAspectClick?: (interaction: { aspect: RadixAspectDrawInput; index: number }) => void;
}) {
	const { center, aspectChordRadius } = WHEEL;
	return (
		<g data-handoff="Layer_AspectLines" opacity={aspects.length > 0 ? 1 : 0}>
			{aspects.flatMap((aspect, idx) => {
				const aLon = longitudeForAspectPoint(aspect.from, bodyLongitudes, axisLongitudes);
				const bLon = longitudeForAspectPoint(aspect.to, bodyLongitudes, axisLongitudes);
				if (aLon === null || bLon === null) return [];
				const pa = polar(center, center, aspectChordRadius, frame.displayLon(aLon));
				const pb = polar(center, center, aspectChordRadius, frame.displayLon(bLon));
				const maxOrb = maxOrbForAspectType(aspect.type, orbTable);
				const orbTier = aspectOrbTier(aspect.orb, maxOrb, tierStyle);
				const sw = strokeWidthForAspectTier(orbTier, tierStyle);
				const dasharray = strokeDasharrayForAspectTier(orbTier, tierStyle.outerLineStyle, sw);
				const baseHex = colorTable[aspect.type] ?? 'var(--token-viz-2)';
				const stroke =
					baseHex.length === 7 && baseHex.startsWith('#')
						? `${baseHex}${frame.isDark ? '99' : 'cc'}`
						: baseHex;
				const emphasized = selectedAspectIndex === idx || highlightAspectIndices.has(idx);
				const dimActive = selectedAspectIndex != null || highlightAspectIndices.size > 0;
				return [
					<g key={`${aspect.from}-${aspect.to}-${aspect.type}-${idx}`}>
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
							data-wheel-aspect={idx}
							onClick={(event) => {
								event.stopPropagation();
								onAspectClick?.({ aspect, index: idx });
							}}
						/>
					</g>
				];
			})}
		</g>
	);
}
