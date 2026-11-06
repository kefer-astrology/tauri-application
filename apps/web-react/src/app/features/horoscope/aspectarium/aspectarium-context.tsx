import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import {
	aspectariumData,
	maxOrbForPreset,
	type AspectariumData,
	type AspectEntry,
	type OrbPreset
} from '@/lib/astrology/aspectarium';
import { DEFAULT_ENABLED_ASPECT_IDS } from '@/lib/astrology/aspects';
import { DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import type { TransitOverlay } from '@/lib/astrology/transits';
import type { AppChart, WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';

export interface AspectariumOptions {
	workspaceDefaults: WorkspaceDefaultsState;
	enabledSymbolSetIds: readonly string[];
}

export interface AspectariumValue extends AspectariumOptions {
	chart: AppChart | null;
	/** The transit overlay when it belongs to this chart. */
	transitOverlay: TransitOverlay | null;
	/** Shared by every Aspectarium widget (the page's filter bar). */
	bodyIds: ReadonlySet<string>;
	setBodyIds: (ids: Set<string>) => void;
	aspectTypes: ReadonlySet<string>;
	setAspectTypes: (types: Set<string>) => void;
	orbPreset: OrbPreset;
	setOrbPreset: (preset: OrbPreset) => void;
	data: AspectariumData;
	/** The aspect whose details are open (a click on a cell or row opens them). */
	selected: AspectEntry | null;
	select: (entryId: string | null) => void;
}

const AspectariumContext = createContext<AspectariumValue | null>(null);

export function useAspectarium(): AspectariumValue {
	const value = useContext(AspectariumContext);
	if (!value) throw new Error('useAspectarium must be used within AspectariumProvider');
	return value;
}

const or = (ids: readonly string[], fallback: readonly string[]) =>
	new Set(ids.length > 0 ? ids : fallback);

/** The selected chart's aspects for the Aspectarium widgets, the shared filters (bodies, aspect
 *  types, orb; they start from the workspace defaults) and the opened aspect. */
export function AspectariumProvider({
	children,
	...options
}: AspectariumOptions & { children: ReactNode }) {
	const { selectedChart, transitOverlay } = useWorkspaceCharts();
	const chart = selectedChart ?? null;
	const overlay =
		transitOverlay && transitOverlay.sourceChartId === chart?.id ? transitOverlay : null;
	const { defaultBodies, defaultAspects } = options.workspaceDefaults;

	const [bodyIds, setBodyIds] = useState<Set<string>>(() =>
		or(defaultBodies, DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS)
	);
	const [aspectTypes, setAspectTypes] = useState<Set<string>>(() =>
		or(defaultAspects, DEFAULT_ENABLED_ASPECT_IDS)
	);
	const [orbPreset, setOrbPreset] = useState<OrbPreset>('default');
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(
		() => setBodyIds(or(defaultBodies, DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS)),
		[defaultBodies]
	);
	useEffect(() => setAspectTypes(or(defaultAspects, DEFAULT_ENABLED_ASPECT_IDS)), [defaultAspects]);

	const data = useMemo(
		() =>
			aspectariumData(chart, overlay, {
				bodyIds,
				aspectTypes,
				maxOrb: maxOrbForPreset(orbPreset)
			}),
		[chart, overlay, bodyIds, aspectTypes, orbPreset]
	);
	const selected = data.entries.find((entry) => entry.id === selectedId) ?? null;

	// An aspect filtered away closes its details.
	useEffect(() => {
		if (selectedId && !selected) setSelectedId(null);
	}, [selectedId, selected]);

	const value: AspectariumValue = {
		...options,
		chart,
		transitOverlay: overlay,
		bodyIds,
		setBodyIds,
		aspectTypes,
		setAspectTypes,
		orbPreset,
		setOrbPreset,
		data,
		selected,
		select: setSelectedId
	};
	return <AspectariumContext.Provider value={value}>{children}</AspectariumContext.Provider>;
}
