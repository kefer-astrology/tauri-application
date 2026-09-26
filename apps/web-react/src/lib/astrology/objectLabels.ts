import { ASPECT_ROWS } from './aspects';
import { OBSERVABLE_OBJECTS, getObservableObjectLabel } from './observableObjects';

/** Shared `t` shape used across this module — matches `useTranslation()`'s `t`. */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

const OBSERVABLE_OBJECT_MAP = new Map(OBSERVABLE_OBJECTS.map((item) => [item.id, item] as const));

/** Human label for a body/point id (planet, angle, node, asteroid, ...). Falls back to the raw
 *  id for anything not in the `OBSERVABLE_OBJECTS` registry (the single source of truth for
 *  body metadata — do not keep a second copy of this list next to a detail view). */
export function objectLabel(id: string, t: Translate): string {
	const item = OBSERVABLE_OBJECT_MAP.get(id);
	return item ? getObservableObjectLabel(item, t) : id;
}

/** Glyph fallback character for a body/point id, for when the active glyph set has no art. */
export function objectIcon(id: string): string {
	return OBSERVABLE_OBJECT_MAP.get(id)?.icon ?? id.slice(0, 3);
}

/** Human label for an aspect type id (`trine`, `square`, ...). */
export function aspectLabel(type: string, t: Translate): string {
	const definition = ASPECT_ROWS.find((aspect) => aspect.id === type);
	return definition ? t(definition.labelKey) : type;
}

/** `detect_chart_shapes` (Rust) emits per-planet variants (`bowl_leader_venus`, `bucket_mars`,
 *  ...) that have no dedicated translation key; fall back to the base shape's label plus the
 *  planet's own name instead of showing a raw, untranslated id. */
export function shapeLabel(id: string, t: Translate, exists: (key: string) => boolean): string {
	const exactKey = `open_shape_${id}`;
	if (exists(exactKey)) return t(exactKey);
	const leaderMatch = id.match(/^(bowl|locomotive)_leader_(.+)$/);
	if (leaderMatch) return `${t('open_shape_leading_planet')}: ${objectLabel(leaderMatch[2], t)}`;
	const bucketMatch = id.match(/^bucket_(.+)$/);
	if (bucketMatch) return `${t('open_shape_bucket')}: ${objectLabel(bucketMatch[1], t)}`;
	if (id === 'stellium') return t('info_stellium');
	return id;
}

/** Same idea for `detect_chart_configurations`'s modality/element variants
 *  (`t_square_cardinal`, `grand_trine_fire`, ...). */
export function configurationLabel(
	id: string,
	t: Translate,
	exists: (key: string) => boolean
): string {
	const exactKey = `open_configuration_${id}`;
	if (exists(exactKey)) return t(exactKey);
	const modalityMatch = id.match(/^(t_square|grand_cross)_(cardinal|fixed|mutable)$/);
	if (modalityMatch) {
		return `${t(`open_configuration_${modalityMatch[1]}`)} (${t(`open_modality_${modalityMatch[2]}`)})`;
	}
	const elementMatch = id.match(/^(grand_trine|kite)_(fire|earth|air|water)$/);
	if (elementMatch) {
		return `${t(`open_configuration_${elementMatch[1]}`)} (${t(`open_element_${elementMatch[2]}`)})`;
	}
	return id;
}
