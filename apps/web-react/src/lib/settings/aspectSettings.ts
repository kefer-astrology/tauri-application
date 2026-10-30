import {
	ASPECT_ROWS,
	DEFAULT_ASPECT_COLORS,
	DEFAULT_ASPECT_ORBS,
	type AspectRow
} from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS } from '@/lib/astrology/observableObjects';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import type { ObjectTypeId } from '@/lib/tauri/types';

/** Editable state of one aspect in Settings. */
export type AspectRowState = { enabled: boolean; orb: number; color: string };

/**
 * Object categories that can be made aspect-eligible, one checkbox each. `planet` is always
 * eligible and has no checkbox. `types` may list several Rust `ObjectType`s that share one
 * checkbox (`calculated_point` and `part` are both "Sensitive Points"; Lilith variants are
 * `calculated_point` too but the observable-objects catalog lists them under "Black Luna").
 */
export const EXTENDED_OBJECT_TYPE_OPTIONS: { labelKey: string; types: ObjectTypeId[] }[] = [
	{ labelKey: 'observable_category_angles', types: ['angle'] },
	{ labelKey: 'transits_group_asteroids', types: ['asteroid'] },
	{ labelKey: 'transits_group_lunar_nodes', types: ['lunar_node'] },
	{ labelKey: 'observable_category_sensitive_points', types: ['calculated_point', 'part'] },
	{ labelKey: 'transits_group_geo_nodes', types: ['geocentric_node'] },
	{ labelKey: 'transits_group_tno', types: ['trans_neptunian'] },
	{ labelKey: 'transits_group_hypotheticals', types: ['hypothetical_planet'] }
];

/** Starting orb for a newly eligible category's objects: half the conjunction orb, rounded to
 *  0.5°, at least 0.5°. */
export function suggestedObjectOrb(): number {
	const baseOrb = DEFAULT_ASPECT_ORBS.conjunction ?? 8;
	return Math.max(0.5, Math.round((baseOrb / 2) * 2) / 2);
}

export function aspectRowStateFromDefaults(
	aspect: AspectRow,
	defaults: WorkspaceDefaultsState
): AspectRowState {
	return {
		enabled: defaults.defaultAspects.includes(aspect.id),
		orb: defaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
		color: defaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
	};
}

export function aspectRowsFromDefaults(
	defaults: WorkspaceDefaultsState
): Record<string, AspectRowState> {
	return Object.fromEntries(
		ASPECT_ROWS.map((aspect) => [aspect.id, aspectRowStateFromDefaults(aspect, defaults)])
	);
}

/** The workspace defaults patch for edited aspect rows (invalid orbs fall back to defaults). */
export function aspectDefaultsPatch(
	rows: Record<string, AspectRowState>
): Pick<WorkspaceDefaultsState, 'defaultAspects' | 'defaultAspectOrbs' | 'defaultAspectColors'> {
	return {
		defaultAspects: ASPECT_ROWS.filter((aspect) => rows[aspect.id]?.enabled).map(
			(aspect) => aspect.id
		),
		defaultAspectOrbs: Object.fromEntries(
			ASPECT_ROWS.map((aspect) => [
				aspect.id,
				Number.isFinite(rows[aspect.id]?.orb)
					? rows[aspect.id]!.orb
					: DEFAULT_ASPECT_ORBS[aspect.id]
			])
		),
		defaultAspectColors: Object.fromEntries(
			ASPECT_ROWS.map((aspect) => [
				aspect.id,
				rows[aspect.id]?.color || DEFAULT_ASPECT_COLORS[aspect.id]
			])
		)
	};
}

/**
 * Toggle aspect eligibility for object categories. Enabling pre-fills a starting orb for that
 * category's objects that have none yet, so enabling never silently means "no narrowing".
 */
export function toggleExtendedObjectTypes(
	current: { extendedObjectTypes: ObjectTypeId[]; objectOrbs: Record<string, number> },
	types: ObjectTypeId[],
	enabled: boolean
): { extendedObjectTypes: ObjectTypeId[]; objectOrbs: Record<string, number> } {
	const extendedObjectTypes = enabled
		? Array.from(new Set([...current.extendedObjectTypes, ...types]))
		: current.extendedObjectTypes.filter((existing) => !types.includes(existing));
	if (!enabled) return { extendedObjectTypes, objectOrbs: current.objectOrbs };
	const additions = OBSERVABLE_OBJECTS.filter(
		(item) =>
			item.objectType !== null &&
			types.includes(item.objectType) &&
			current.objectOrbs[item.id] === undefined
	);
	if (additions.length === 0) return { extendedObjectTypes, objectOrbs: current.objectOrbs };
	const objectOrbs = { ...current.objectOrbs };
	for (const item of additions) objectOrbs[item.id] = suggestedObjectOrb();
	return { extendedObjectTypes, objectOrbs };
}
