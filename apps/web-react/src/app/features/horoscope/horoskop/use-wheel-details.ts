import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { aspectLabel } from '@/lib/astrology/objectLabels';
import { buildObjectDetailViewModel } from '@/lib/astrology/objectDetail';
import { useHoroskop } from './horoskop-context';

const NO_IDS: string[] = [];
const NO_POSITIONS: Record<string, unknown> = {};
const NO_MOTION: Record<string, { speed: number; retrograde: boolean }> = {};

/**
 * The detail view-models of the selected body or aspect (shared with the aspectarium's detail),
 * plus the panel title and description. A transiting body's house is read against the radix
 * cusps; aspects are radix-only.
 */
export function useWheelDetails() {
	const { t, i18n } = useTranslation();
	const { chart, data, transitOverlay, selectedObject, selectedAspect, detailKind, ...rest } =
		useHoroskop();
	const { enabledSymbolSetIds } = rest;
	const computed = chart?.computed;
	const positions = (computed?.positions ?? NO_POSITIONS) as Record<string, unknown>;
	const motion = computed?.motion ?? NO_MOTION;
	const shapes = computed?.shapes ?? NO_IDS;
	const configurations = computed?.configurations ?? NO_IDS;
	const transitComputed = transitOverlay?.transitChart.computed;
	const radixLabel = chart?.name ?? t('new_type_radix');

	const object = useMemo(() => {
		if (!selectedObject) return null;
		const transit = selectedObject.layer === 'transit';
		return buildObjectDetailViewModel(
			{
				bodyId: selectedObject.bodyId,
				rawPosition: (transit
					? ((transitComputed?.positions ?? NO_POSITIONS) as Record<string, unknown>)
					: positions)[selectedObject.bodyId],
				motion: (transit ? (transitComputed?.motion ?? NO_MOTION) : motion)[selectedObject.bodyId],
				extendedMaps: transit ? transitComputed : computed,
				houseCusps: computed?.houseCusps ?? [],
				chartShapeIds: shapes,
				chartConfigurationIds: configurations,
				allAspects: transit ? [] : data.radixAspects,
				layerLabel: transit ? t('transits_general_transit_transit') : radixLabel
			},
			i18n.language,
			t,
			enabledSymbolSetIds
		);
	}, [
		selectedObject,
		transitComputed,
		positions,
		motion,
		computed,
		shapes,
		configurations,
		data.radixAspects,
		radixLabel,
		i18n.language,
		t,
		enabledSymbolSetIds
	]);

	const aspect = useMemo(() => {
		if (!selectedAspect) return null;
		const clicked = selectedAspect.aspect;
		const enriched =
			data.radixAspects.find(
				(candidate) =>
					candidate.from === clicked.from &&
					candidate.to === clicked.to &&
					candidate.type === clicked.type
			) ?? clicked;
		const side = (bodyId: string) =>
			buildObjectDetailViewModel(
				{
					bodyId,
					rawPosition: positions[bodyId],
					motion: motion[bodyId],
					extendedMaps: computed,
					houseCusps: computed?.houseCusps ?? [],
					chartShapeIds: shapes,
					chartConfigurationIds: configurations,
					allAspects: data.radixAspects,
					layerLabel: radixLabel
				},
				i18n.language,
				t,
				enabledSymbolSetIds
			);
		const fromObject = side(enriched.from);
		const toObject = side(enriched.to);
		return fromObject && toObject ? { aspect: enriched, fromObject, toObject } : null;
	}, [
		selectedAspect,
		data.radixAspects,
		positions,
		motion,
		computed,
		shapes,
		configurations,
		radixLabel,
		i18n.language,
		t,
		enabledSymbolSetIds
	]);

	const showingAspect = detailKind === 'aspect' && aspect;
	return {
		object,
		aspect,
		title: showingAspect ? aspectLabel(aspect.aspect.type, t) : (object?.label ?? t('details')),
		description: showingAspect
			? `${aspect.fromObject.label} → ${aspect.toObject.label}`
			: object?.layerLabel
	};
}
