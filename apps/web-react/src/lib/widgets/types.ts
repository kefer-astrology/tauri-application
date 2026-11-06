import type { AstrologicalTraditionId } from '@/lib/tauri/types';

/** The widget workspace model: widgets, their instances and data context, and the profiles
 *  that lay them out per module and screen size. A profile decides what is shown and how,
 *  never what is calculated. */

/** Modules laid out on a free grid (as opposed to Horoskop's regions around the wheel). */
export type GridModule = 'spektrum' | 'aspektarium';
export const GRID_MODULES: readonly GridModule[] = ['spektrum', 'aspektarium'];

export type WidgetModule = 'horoskop' | GridModule;

/** Catalog categories; a widget may belong to several. */
export type WidgetCategory = 'common' | 'modern' | 'traditional' | 'kabbalah';

/** Built-in profiles. Each belongs to one astrological school: Basic and Modern to modern
 *  western, Traditional and Kabbalistic to medieval / traditional. */
export type WidgetPresetId = 'basic' | 'modern' | 'traditional' | 'kabbalah';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

/** Spektrum grid columns per screen size. */
export const GRID_COLUMNS: Record<Breakpoint, number> = { desktop: 12, tablet: 6, mobile: 1 };

/** Horoskop regions around the protected wheel centre. */
export type HoroskopRegion = 'left' | 'right' | 'bottom';

/** Size in grid units (columns × rows). */
export interface WidgetSize {
	w: number;
	h: number;
}

/** What a widget is: catalog entry, where it may go, and how it may be sized. */
export interface WidgetManifest {
	id: string;
	/** i18n keys of the catalog name and one-sentence description. */
	titleKey: string;
	descriptionKey: string;
	categories: WidgetCategory[];
	modules: WidgetModule[];
	/** Repeatable widgets are added again ("+ Add"); unique ones are found ("On the workspace"). */
	repeatable: boolean;
	sizes: { min: WidgetSize; default: WidgetSize; supported?: WidgetSize[] };
	/** Region a new Horoskop instance goes to. */
	horoskopRegion?: HoroskopRegion;
	/** Default settings of a new instance. */
	defaultSettings?: Record<string, unknown>;
}

/** Where a widget takes its chart from. */
export type DataContext =
	| { kind: 'active' }
	| { kind: 'pinned'; chartId: string }
	| { kind: 'compare'; chartA: string; chartB: string };

/** One widget on a workspace. Removing it removes the instance, never chart data. */
export interface WidgetInstance {
	instanceId: string;
	widgetId: string;
	settings: Record<string, unknown>;
	dataContext: DataContext;
	collapsed?: boolean;
}

/** A Spektrum grid placement, in grid units from the top left. */
export interface GridPlacement extends WidgetSize {
	instanceId: string;
	x: number;
	y: number;
}

/** A Horoskop placement: a region and the order within it. */
export interface RegionPlacement {
	instanceId: string;
	region: HoroskopRegion;
	order: number;
}

export type ModuleLayouts = { horoskop: Record<Breakpoint, RegionPlacement[]> } & Record<
	GridModule,
	Record<Breakpoint, GridPlacement[]>
>;

export interface WorkspaceProfile {
	id: string;
	/** Built-in profiles carry an i18n name key; profiles from a workspace carry a name. */
	nameKey?: string;
	name?: string;
	/** The preset a profile is based on. */
	preset: WidgetPresetId;
	/** The school the profile belongs to; it is offered only in workspaces of that school. */
	school: AstrologicalTraditionId;
	instances: WidgetInstance[];
	layouts: ModuleLayouts;
}

/**
 * A workspace's changes to a preset. Each section it sets replaces the preset's: the name, the
 * whole instance list, or the layout of one module at one screen size. Unset sections keep the
 * preset's.
 */
export interface WorkspaceProfileOverride {
	id: string;
	preset: WidgetPresetId;
	name?: string;
	instances?: WidgetInstance[];
	layouts?: { horoskop?: Partial<Record<Breakpoint, RegionPlacement[]>> } & Partial<
		Record<GridModule, Partial<Record<Breakpoint, GridPlacement[]>>>
	>;
}
