import { polar, type WheelAxis } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame } from '../wheel-frame';

export type HemisphereOverlayKind =
	'off' | 'asc-dsc-east' | 'asc-dsc-west' | 'mc-ic-north' | 'mc-ic-south';

/** Tinted half of the wheel along the ASC–DSC or MC–IC line. */
export function HemisphereOverlay({
	frame,
	axis,
	kind
}: {
	frame: WheelFrame;
	axis: WheelAxis;
	kind: HemisphereOverlayKind;
}) {
	const { center, outerRadius } = WHEEL;

	/** Wedge from the center to the outer arc [startLon → endLon] (ecliptic °). */
	const arcWedge = (startLon: number, endLon: number, sweepFlag: 0 | 1) => {
		const p1 = polar(center, center, outerRadius, frame.displayLon(startLon));
		const p2 = polar(center, center, outerRadius, frame.displayLon(endLon));
		return `M ${center} ${center} L ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 0 ${sweepFlag} ${p2.x} ${p2.y} Z`;
	};

	const path =
		kind === 'asc-dsc-east'
			? arcWedge(axis.dsc, axis.asc, 1)
			: kind === 'asc-dsc-west'
				? arcWedge(axis.dsc, axis.asc, 0)
				: kind === 'mc-ic-north'
					? arcWedge(axis.ic, axis.mc, 1)
					: kind === 'mc-ic-south'
						? arcWedge(axis.ic, axis.mc, 0)
						: null;

	return (
		<g data-handoff="Layer_HemisphericOverlay" style={{ pointerEvents: 'none' }}>
			{path && (
				<path
					d={path}
					fill={
						kind.startsWith('mc-ic')
							? 'var(--token-wheel-overlay-secondary)'
							: 'var(--token-wheel-overlay-primary)'
					}
					opacity={1}
				/>
			)}
		</g>
	);
}
