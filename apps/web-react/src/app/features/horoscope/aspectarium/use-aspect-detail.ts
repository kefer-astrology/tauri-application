import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AspectLayer } from '@/lib/astrology/aspectarium';
import { buildObjectDetailViewModel } from '@/lib/astrology/objectDetail';
import { useAspectarium } from './aspectarium-context';

const NO_IDS: string[] = [];

/** The opened aspect's detail: the aspect, and each side's full body detail from its own layer
 *  (the same view-model as the wheel's aspect detail). Each side lists all of its aspects. */
export function useAspectDetail() {
	const { t, i18n } = useTranslation();
	const { chart, transitOverlay, data, selected, enabledSymbolSetIds } = useAspectarium();

	return useMemo(() => {
		if (!selected) return null;
		const side = (bodyId: string, layer: AspectLayer) => {
			const source = layer === 'transit' ? transitOverlay?.transitChart.computed : chart?.computed;
			return buildObjectDetailViewModel(
				{
					bodyId,
					rawPosition: ((source?.positions ?? {}) as Record<string, unknown>)[bodyId],
					motion: source?.motion?.[bodyId],
					extendedMaps: source,
					houseCusps: chart?.computed?.houseCusps ?? [],
					chartShapeIds: chart?.computed?.shapes ?? NO_IDS,
					chartConfigurationIds: chart?.computed?.configurations ?? NO_IDS,
					allAspects: layer === 'transit' ? data.allTransitAspects : data.allRadixAspects,
					layerLabel:
						layer === 'transit'
							? t('transits_general_transit_transit')
							: (chart?.name ?? t('new_type_radix'))
				},
				i18n.language,
				t,
				enabledSymbolSetIds
			);
		};
		const fromObject = side(selected.aspect.from, selected.fromLayer);
		const toObject = side(selected.aspect.to, selected.toLayer);
		return fromObject && toObject ? { aspect: selected.aspect, fromObject, toObject } : null;
	}, [
		selected,
		transitOverlay,
		chart,
		data.allRadixAspects,
		data.allTransitAspects,
		i18n.language,
		t,
		enabledSymbolSetIds
	]);
}
