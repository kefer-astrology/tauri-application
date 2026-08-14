import type { AppChart } from '@/lib/tauri/chartPayload';

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

