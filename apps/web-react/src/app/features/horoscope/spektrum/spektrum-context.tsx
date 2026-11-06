import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import { chartViewData, type ChartViewData } from '@/lib/astrology/chartView';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { WheelFocus } from '@/lib/astrology/informationView';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import type { AppChart, WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import type { ChartFacts } from '@/lib/tauri/types';

export interface SpektrumOptions {
	workspaceDefaults: WorkspaceDefaultsState;
	wheelStyle?: WheelStyleId;
	elementColors: ElementColors;
	lightPlanetFill: string;
}

export interface SpektrumValue extends SpektrumOptions {
	chart: AppChart | null;
	/** The chart's computed facts, or `null` (not computed yet, or an older backend). */
	facts: ChartFacts | null;
	wheel: ChartViewData;
	/** What the wheel shows: the hovered row, else the locked one. */
	focus: WheelFocus | null;
	/** Whether a row is the one shown. */
	isActive: (id: string) => boolean;
	/** Preview a row on the wheel while hovered or focused (`null` ends it). */
	preview: (id: string | null, focus?: WheelFocus) => void;
	/** Lock a row on the wheel, or unlock it when it is already locked. */
	toggleLock: (id: string, focus: WheelFocus) => void;
}

const SpektrumContext = createContext<SpektrumValue | null>(null);

export function useSpektrum(): SpektrumValue {
	const value = useContext(SpektrumContext);
	if (!value) throw new Error('useSpektrum must be used within SpektrumProvider');
	return value;
}

interface FocusEntry {
	id: string;
	focus: WheelFocus;
}

/** The selected chart's facts for the Spektrum widgets, and the focus they share with the wheel:
 *  hovering a row previews its bodies (and chart half), a click locks it until clicked again. */
export function SpektrumProvider({
	children,
	...options
}: SpektrumOptions & { children: ReactNode }) {
	const { selectedChart } = useWorkspaceCharts();
	const chart = selectedChart ?? null;
	const facts = chart?.computed?.facts ?? null;
	const wheel = useMemo(
		() => chartViewData(chart, options.workspaceDefaults.defaultBodies, null),
		[chart, options.workspaceDefaults.defaultBodies]
	);
	const [previewed, setPreviewed] = useState<FocusEntry | null>(null);
	const [locked, setLocked] = useState<FocusEntry | null>(null);

	useEffect(() => {
		setPreviewed(null);
		setLocked(null);
	}, [chart?.id]);

	const shown = previewed ?? locked;
	const value: SpektrumValue = {
		...options,
		chart,
		facts,
		wheel,
		focus: shown?.focus ?? null,
		isActive: (id) => shown?.id === id,
		preview: (id, focus) => setPreviewed(id && focus ? { id, focus } : null),
		toggleLock: (id, focus) => setLocked((current) => (current?.id === id ? null : { id, focus }))
	};
	return <SpektrumContext.Provider value={value}>{children}</SpektrumContext.Provider>;
}
