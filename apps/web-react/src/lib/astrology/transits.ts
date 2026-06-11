import { ASPECT_ROWS } from './aspects';
import type { AppChart } from '@/lib/tauri/chartPayload';

const ASPECT_ANGLES: Record<string, number> = {
	conjunction: 0,
	sextile: 60,
	square: 90,
	trine: 120,
	quincunx: 150,
	opposition: 180
};

export type TransitAspect = Record<string, unknown> & {
	from: string;
	to: string;
	type: string;
	angle: number;
	orb: number;
	exact_angle: number;
	applying: boolean;
	separating: boolean;
};

export interface TransitOverlay {
	sourceChartId: string;
	sourceChartName: string;
	dateTime: string;
	transitChart: AppChart;
	transitingBodies: string[];
	transitedBodies: string[];
	aspectTypes: string[];
	aspects: TransitAspect[];
}

export function normalizeLongitude(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return ((value % 360) + 360) % 360;
	}
	if (value && typeof value === 'object') {
		const longitude = (value as { longitude?: unknown }).longitude;
		if (typeof longitude === 'number' && Number.isFinite(longitude)) {
			return ((longitude % 360) + 360) % 360;
		}
	}
	return null;
}

function shortestArcDeg(a: number, b: number): number {
	const diff = Math.abs(normalizeLongitude(a)! - normalizeLongitude(b)!);
	return diff > 180 ? 360 - diff : diff;
}

function selectedAspectSpecs(
	aspectOrbs: Record<string, number>,
	aspectTypes: readonly string[]
): Array<{ id: string; angle: number; orb: number }> {
	const selected = new Set(aspectTypes.map((id) => id.trim().toLowerCase()).filter(Boolean));
	return ASPECT_ROWS.flatMap((row) => {
		if (selected.size > 0 && !selected.has(row.id)) return [];
		const angle = ASPECT_ANGLES[row.id];
		if (typeof angle !== 'number') return [];
		const configuredOrb = aspectOrbs[row.id];
		const orb =
			typeof configuredOrb === 'number' && Number.isFinite(configuredOrb)
				? Math.max(configuredOrb, 0)
				: row.defaultOrb;
		return [{ id: row.id, angle, orb }];
	});
}

function detectAspect(
	angle: number,
	specs: Array<{ id: string; angle: number; orb: number }>
): { id: string; exactAngle: number; orb: number } | null {
	for (const spec of specs) {
		const exact = spec.angle > 180 ? 360 - spec.angle : spec.angle;
		const orb = Math.abs(angle - exact);
		if (orb <= spec.orb) {
			return { id: spec.id, exactAngle: spec.angle, orb };
		}
	}
	return null;
}

export function computeTransitAspects({
	transitPositions,
	radixPositions,
	transitingBodies,
	transitedBodies,
	aspectTypes,
	aspectOrbs
}: {
	transitPositions: Record<string, unknown>;
	radixPositions: Record<string, unknown>;
	transitingBodies: readonly string[];
	transitedBodies: readonly string[];
	aspectTypes: readonly string[];
	aspectOrbs: Record<string, number>;
}): TransitAspect[] {
	const specs = selectedAspectSpecs(aspectOrbs, aspectTypes);
	const transitingIds = transitingBodies
		.filter((id, index, arr) => arr.indexOf(id) === index)
		.filter((id) => normalizeLongitude(transitPositions[id]) !== null)
		.sort();
	const transitedIds = transitedBodies
		.filter((id, index, arr) => arr.indexOf(id) === index)
		.filter((id) => normalizeLongitude(radixPositions[id]) !== null)
		.sort();

	const aspects: TransitAspect[] = [];
	for (const from of transitingIds) {
		const fromLon = normalizeLongitude(transitPositions[from]);
		if (fromLon === null) continue;
		for (const to of transitedIds) {
			const toLon = normalizeLongitude(radixPositions[to]);
			if (toLon === null) continue;
			const angle = shortestArcDeg(fromLon, toLon);
			const detected = detectAspect(angle, specs);
			if (!detected) continue;
			aspects.push({
				from,
				to,
				type: detected.id,
				angle,
				orb: detected.orb,
				exact_angle: detected.exactAngle,
				applying: false,
				separating: false
			});
		}
	}

	return aspects;
}
