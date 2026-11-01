import { polar, type WheelAxis } from '@/lib/astrology/wheelGeometry';
import { WHEEL, type WheelFrame } from '../wheel-frame';

/** ASC–DSC and MC–IC lines across the wheel. */
export function AxisLines({ frame, axis }: { frame: WheelFrame; axis: WheelAxis }) {
	const { center, outerRadius } = WHEEL;
	const at = (lon: number) => polar(center, center, outerRadius + 4, frame.displayLon(lon));
	const pAsc = at(axis.asc);
	const pDsc = at(axis.dsc);
	const pMc = at(axis.mc);
	const pIc = at(axis.ic);
	return (
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
	);
}
