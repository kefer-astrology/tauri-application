import { effectiveSchool } from '@/lib/astrology/schools';
import type { AstrologicalTraditionId } from '@/lib/tauri/types';
import {
	GRID_COLUMNS,
	GRID_MODULES,
	type Breakpoint,
	type GridModule,
	type GridPlacement,
	type HoroskopRegion,
	type ModuleLayouts,
	type RegionPlacement,
	type WidgetInstance,
	type WidgetModule,
	type WidgetPresetId,
	type WidgetSize,
	type WorkspaceProfile,
	type WorkspaceProfileOverride
} from './types';

const BREAKPOINTS: readonly Breakpoint[] = ['desktop', 'tablet', 'mobile'];

const emptyLayouts = (): ModuleLayouts => ({
	horoskop: { desktop: [], tablet: [], mobile: [] },
	spektrum: { desktop: [], tablet: [], mobile: [] },
	aspektarium: { desktop: [], tablet: [], mobile: [] }
});

/** Every layout list of a profile, so an operation can treat them alike. */
function mapLayouts(
	layouts: ModuleLayouts,
	region: (placements: RegionPlacement[], bp: Breakpoint) => RegionPlacement[],
	grid: (placements: GridPlacement[], bp: Breakpoint, module: GridModule) => GridPlacement[]
): ModuleLayouts {
	const next = emptyLayouts();
	for (const bp of BREAKPOINTS) {
		next.horoskop[bp] = region(layouts.horoskop[bp], bp);
		for (const module of GRID_MODULES) next[module][bp] = grid(layouts[module][bp], bp, module);
	}
	return next;
}

const instanceOf = (widgetId: string): WidgetInstance => ({
	instanceId: widgetId,
	widgetId,
	settings: {},
	dataContext: { kind: 'active' }
});

/** The Horoskop widgets every profile starts with: the chart's profile and the astrolabe left
 *  of the wheel, its positions right of it. */
const HOROSKOP_BASE: { widgetId: string; region: HoroskopRegion; order: number }[] = [
	{ widgetId: 'chart-profile', region: 'left', order: 0 },
	{ widgetId: 'astrolabe', region: 'left', order: 1 },
	{ widgetId: 'positions', region: 'right', order: 0 }
];

/** The Aspectarium page every profile starts with: the matrix with the aspect list beside it,
 *  midpoints below; stacked on narrower screens. */
const ASPEKTARIUM_BASE: {
	widgetId: string;
	place: Record<Breakpoint, Omit<GridPlacement, 'instanceId'>>;
}[] = [
	{
		widgetId: 'aspect-matrix',
		place: {
			desktop: { x: 0, y: 0, w: 8, h: 8 },
			tablet: { x: 0, y: 0, w: 6, h: 8 },
			mobile: { x: 0, y: 0, w: 1, h: 8 }
		}
	},
	{
		widgetId: 'aspect-list',
		place: {
			desktop: { x: 8, y: 0, w: 4, h: 8 },
			tablet: { x: 0, y: 8, w: 6, h: 6 },
			mobile: { x: 0, y: 8, w: 1, h: 6 }
		}
	},
	{
		widgetId: 'midpoints',
		place: {
			desktop: { x: 0, y: 8, w: 12, h: 6 },
			tablet: { x: 0, y: 14, w: 6, h: 6 },
			mobile: { x: 0, y: 14, w: 1, h: 6 }
		}
	}
];

/** The Spektrum page every profile starts with: structure (elements … orientation) left, the
 *  wheel and the highlights in the centre, dynamics (aspects … focal planets) right. */
const SPEKTRUM_DESKTOP: { widgetId: string; x: number; y: number; w: number; h: number }[] = [
	{ widgetId: 'element-balance', x: 0, y: 0, w: 3, h: 4 },
	{ widgetId: 'modality-balance', x: 0, y: 4, w: 3, h: 3 },
	{ widgetId: 'house-balance', x: 0, y: 7, w: 3, h: 5 },
	{ widgetId: 'quadrants', x: 0, y: 12, w: 3, h: 3 },
	{ widgetId: 'hemispheres', x: 0, y: 15, w: 3, h: 4 },
	{ widgetId: 'orientation', x: 0, y: 19, w: 3, h: 2 },
	{ widgetId: 'spektrum-wheel', x: 3, y: 0, w: 6, h: 14 },
	{ widgetId: 'highlights', x: 3, y: 14, w: 6, h: 3 },
	{ widgetId: 'aspect-balance', x: 9, y: 0, w: 3, h: 4 },
	{ widgetId: 'configurations', x: 9, y: 4, w: 3, h: 3 },
	{ widgetId: 'stelliums', x: 9, y: 7, w: 3, h: 3 },
	{ widgetId: 'singletons', x: 9, y: 10, w: 3, h: 2 },
	{ widgetId: 'retrograde', x: 9, y: 12, w: 3, h: 4 },
	{ widgetId: 'focal-planets', x: 9, y: 16, w: 3, h: 5 }
];

/** Narrower layouts of the Spektrum page: the wheel and highlights first across the width, then
 *  the cards two per row (tablet) or one per row (mobile). */
function spektrumLayout(bp: Breakpoint): GridPlacement[] {
	if (bp === 'desktop')
		return SPEKTRUM_DESKTOP.map(({ widgetId, ...place }) => ({ instanceId: widgetId, ...place }));
	const columns = GRID_COLUMNS[bp];
	const wide = ['spektrum-wheel', 'highlights'];
	const ordered = [
		...SPEKTRUM_DESKTOP.filter((p) => wide.includes(p.widgetId)),
		...SPEKTRUM_DESKTOP.filter((p) => !wide.includes(p.widgetId))
	];
	const placements: GridPlacement[] = [];
	let y = 0;
	let column = 0;
	let rowHeight = 0;
	const width = Math.max(1, columns / 2);
	for (const { widgetId, h } of ordered) {
		if (wide.includes(widgetId) || columns === 1) {
			if (column > 0) y += rowHeight;
			placements.push({ instanceId: widgetId, x: 0, y, w: columns, h });
			y += h;
			column = 0;
			rowHeight = 0;
			continue;
		}
		placements.push({ instanceId: widgetId, x: column * width, y, w: width, h });
		rowHeight = Math.max(rowHeight, h);
		column += 1;
		if (column === 2) {
			y += rowHeight;
			column = 0;
			rowHeight = 0;
		}
	}
	return placements;
}

const preset = (id: WidgetPresetId, school: AstrologicalTraditionId): WorkspaceProfile => {
	const layouts = emptyLayouts();
	for (const bp of BREAKPOINTS) {
		layouts.horoskop[bp] = HOROSKOP_BASE.map(({ widgetId, region, order }) => ({
			instanceId: widgetId,
			region,
			order
		}));
		layouts.aspektarium[bp] = ASPEKTARIUM_BASE.map(({ widgetId, place }) => ({
			instanceId: widgetId,
			...place[bp]
		}));
		layouts.spektrum[bp] = spektrumLayout(bp);
	}
	return {
		id: `preset:${id}`,
		nameKey: `widget_preset_${id}`,
		preset: id,
		school,
		instances: [...HOROSKOP_BASE, ...ASPEKTARIUM_BASE, ...SPEKTRUM_DESKTOP].map(({ widgetId }) =>
			instanceOf(widgetId)
		),
		layouts
	};
};

/**
 * Read-only built-in profiles, in the order they are offered. Profiles of one school share its
 * calculation and differ only in what is shown: Basic is a lighter Modern; Kabbalistic is
 * Traditional with the Tree of Life and its correspondences. For now every profile has the same
 * widgets; their sets diverge as more widgets are built.
 */
export const BUILT_IN_PRESETS: Record<WidgetPresetId, WorkspaceProfile> = {
	basic: preset('basic', 'modern_western'),
	modern: preset('modern', 'modern_western'),
	traditional: preset('traditional', 'medieval_traditional'),
	kabbalah: preset('kabbalah', 'medieval_traditional')
};

/** The built-in profiles offered in a workspace of `school` (the default school when it has
 *  none or an unavailable one). */
export function presetsForSchool(
	school: AstrologicalTraditionId | null | undefined
): WorkspaceProfile[] {
	const active = effectiveSchool(school);
	return Object.values(BUILT_IN_PRESETS).filter((profile) => profile.school === active);
}

/** The profile a workspace of `school` opens with: its school's first built-in profile. */
export function defaultPresetForSchool(
	school: AstrologicalTraditionId | null | undefined
): WidgetPresetId {
	return presetsForSchool(school)[0]!.preset;
}

/** A profile's Horoskop widgets in one region at one screen size, in order. */
export function regionInstances(
	profile: WorkspaceProfile,
	breakpoint: Breakpoint,
	region: HoroskopRegion
): WidgetInstance[] {
	const byId = new Map(profile.instances.map((instance) => [instance.instanceId, instance]));
	return profile.layouts.horoskop[breakpoint]
		.filter((placement) => placement.region === region)
		.sort((a, b) => a.order - b.order)
		.flatMap((placement) => byId.get(placement.instanceId) ?? []);
}

/** A grid module's widgets at one screen size, in reading order, with their placements. */
export function gridItems(
	profile: WorkspaceProfile,
	module: GridModule,
	breakpoint: Breakpoint
): { instance: WidgetInstance; placement: GridPlacement }[] {
	const byId = new Map(profile.instances.map((instance) => [instance.instanceId, instance]));
	return [...profile.layouts[module][breakpoint]]
		.sort((a, b) => a.y - b.y || a.x - b.x)
		.flatMap((placement) => {
			const instance = byId.get(placement.instanceId);
			return instance ? [{ instance, placement }] : [];
		});
}

/** Ids of the instances placed in a module (at any screen size). */
export function moduleInstanceIds(profile: WorkspaceProfile, module: WidgetModule): Set<string> {
	const lists =
		module === 'horoskop'
			? BREAKPOINTS.map((bp) => profile.layouts.horoskop[bp])
			: BREAKPOINTS.map((bp) => profile.layouts[module][bp]);
	return new Set(lists.flat().map((placement) => placement.instanceId));
}

/** How many instances of a widget a module has. */
export function instanceCount(
	profile: WorkspaceProfile,
	widgetId: string,
	module?: WidgetModule
): number {
	const placed = module ? moduleInstanceIds(profile, module) : null;
	return profile.instances.filter(
		(instance) => instance.widgetId === widgetId && (!placed || placed.has(instance.instanceId))
	).length;
}

/** Drop placements of instances the profile does not have, and instances of unknown widgets
 *  when `knownWidgetIds` is given (a workspace may name widgets this build lacks). */
export function withoutOrphans(
	profile: WorkspaceProfile,
	knownWidgetIds?: ReadonlySet<string>
): WorkspaceProfile {
	const instances = knownWidgetIds
		? profile.instances.filter((instance) => knownWidgetIds.has(instance.widgetId))
		: profile.instances;
	const ids = new Set(instances.map((instance) => instance.instanceId));
	const keep = <P extends { instanceId: string }>(placements: P[]) =>
		placements.filter((p) => ids.has(p.instanceId));
	return { ...profile, instances, layouts: mapLayouts(profile.layouts, keep, keep) };
}

/** The effective profile: the built-in preset with the workspace's override applied. */
export function resolveProfile(
	override: WorkspaceProfileOverride,
	knownWidgetIds?: ReadonlySet<string>
): WorkspaceProfile {
	const base = BUILT_IN_PRESETS[override.preset];
	const layouts = mapLayouts(
		base.layouts,
		(placements, bp) => override.layouts?.horoskop?.[bp] ?? placements,
		(placements, bp, module) => override.layouts?.[module]?.[bp] ?? placements
	);
	return withoutOrphans(
		{
			id: override.id,
			name: override.name,
			nameKey: override.name ? undefined : base.nameKey,
			preset: override.preset,
			school: base.school,
			instances: override.instances ?? base.instances,
			layouts
		},
		knownWidgetIds
	);
}

/** What removing an instance took away, to put it back exactly (Undo). */
export interface RemovedInstance {
	instance: WidgetInstance;
	index: number;
	horoskop: Partial<Record<Breakpoint, RegionPlacement>>;
	grid: Partial<Record<GridModule, Partial<Record<Breakpoint, GridPlacement>>>>;
}

/** The profile without one instance (its placements too), and what was removed. Removing an
 *  instance never touches chart data. */
export function removeInstance(
	profile: WorkspaceProfile,
	instanceId: string
): { profile: WorkspaceProfile; removed: RemovedInstance | null } {
	const index = profile.instances.findIndex((instance) => instance.instanceId === instanceId);
	if (index === -1) return { profile, removed: null };
	const removed: RemovedInstance = {
		instance: profile.instances[index]!,
		index,
		horoskop: {},
		grid: {}
	};
	const layouts = mapLayouts(
		profile.layouts,
		(placements, bp) => {
			removed.horoskop[bp] = placements.find((p) => p.instanceId === instanceId);
			return placements.filter((p) => p.instanceId !== instanceId);
		},
		(placements, bp, module) => {
			const found = placements.find((p) => p.instanceId === instanceId);
			if (found) (removed.grid[module] ??= {})[bp] = found;
			return placements.filter((p) => p.instanceId !== instanceId);
		}
	);
	return {
		profile: {
			...profile,
			instances: profile.instances.filter((instance) => instance.instanceId !== instanceId),
			layouts
		},
		removed
	};
}

/** Put a removed instance back where it was. */
export function restoreInstance(
	profile: WorkspaceProfile,
	removed: RemovedInstance
): WorkspaceProfile {
	if (profile.instances.some((instance) => instance.instanceId === removed.instance.instanceId)) {
		return profile;
	}
	const instances = [...profile.instances];
	instances.splice(Math.min(removed.index, instances.length), 0, removed.instance);
	const layouts = mapLayouts(
		profile.layouts,
		(placements, bp) => {
			const placement = removed.horoskop[bp];
			return placement ? [...placements, placement] : placements;
		},
		(placements, bp, module) => {
			const placement = removed.grid[module]?.[bp];
			return placement ? [...placements, placement] : placements;
		}
	);
	return { ...profile, instances, layouts };
}

function newInstanceId(profile: WorkspaceProfile, widgetId: string): string {
	const taken = new Set(profile.instances.map((instance) => instance.instanceId));
	let instanceId = widgetId;
	for (let n = 2; taken.has(instanceId); n += 1) instanceId = `${widgetId}-${n}`;
	return instanceId;
}

const withInstance = (
	profile: WorkspaceProfile,
	instanceId: string,
	widgetId: string,
	settings: Record<string, unknown>,
	layouts: ModuleLayouts
): WorkspaceProfile => ({
	...profile,
	instances: [
		...profile.instances,
		{ ...instanceOf(widgetId), instanceId, settings: { ...settings } }
	],
	layouts
});

/** The profile with a new instance of `widgetId` at the end of a Horoskop `region` (at every
 *  screen size), and the new instance's id. */
export function addHoroskopInstance(
	profile: WorkspaceProfile,
	widgetId: string,
	region: HoroskopRegion,
	settings: Record<string, unknown> = {}
): { profile: WorkspaceProfile; instanceId: string } {
	const instanceId = newInstanceId(profile, widgetId);
	const layouts = mapLayouts(
		profile.layouts,
		(placements) => {
			const order =
				placements
					.filter((placement) => placement.region === region)
					.reduce((max, placement) => Math.max(max, placement.order), -1) + 1;
			return [...placements, { instanceId, region, order }];
		},
		(placements) => placements
	);
	return { profile: withInstance(profile, instanceId, widgetId, settings, layouts), instanceId };
}

/** The profile with a new instance of `widgetId` below everything on a grid module, at its
 *  default size (capped to each screen size's columns), and the new instance's id. */
export function addGridInstance(
	profile: WorkspaceProfile,
	module: GridModule,
	widgetId: string,
	size: WidgetSize,
	settings: Record<string, unknown> = {}
): { profile: WorkspaceProfile; instanceId: string } {
	const instanceId = newInstanceId(profile, widgetId);
	const layouts = mapLayouts(
		profile.layouts,
		(placements) => placements,
		(placements, bp, target) => {
			if (target !== module) return placements;
			const y = placements.reduce((max, p) => Math.max(max, p.y + p.h), 0);
			return [
				...placements,
				{ instanceId, x: 0, y, w: Math.min(size.w, GRID_COLUMNS[bp]), h: size.h }
			];
		}
	);
	return { profile: withInstance(profile, instanceId, widgetId, settings, layouts), instanceId };
}
