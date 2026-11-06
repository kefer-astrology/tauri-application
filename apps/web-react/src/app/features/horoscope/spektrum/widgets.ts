import type { WidgetManifest } from '@/lib/widgets/types';
import type { WidgetDefinition } from '../workspace/widget-definition';
import {
	AspectBalanceWidget,
	ConfigurationsWidget,
	FocalPlanetsWidget,
	RetrogradeWidget,
	SingletonsWidget,
	StelliumsWidget
} from './widgets/dynamics-widgets';
import { HighlightsWidget } from './widgets/highlights-widget';
import {
	ElementBalanceWidget,
	HemispheresWidget,
	HouseBalanceWidget,
	ModalityBalanceWidget,
	OrientationWidget,
	QuadrantsWidget
} from './widgets/structure-widgets';
import { SpektrumWheelWidget } from './widgets/wheel-widget';

const card = (
	id: string,
	titleKey: string,
	Component: WidgetDefinition['Component'],
	size: { w: number; h: number } = { w: 3, h: 4 }
): WidgetDefinition => ({
	manifest: {
		id,
		titleKey,
		descriptionKey: `widget_${id.replace(/-/g, '_')}_description`,
		categories: ['common'],
		modules: ['spektrum'],
		repeatable: false,
		sizes: { min: { w: 2, h: 2 }, default: size }
	} satisfies WidgetManifest,
	Component
});

/** The Spektrum (Information) widgets, by widget id. */
export const SPEKTRUM_WIDGETS: Record<string, WidgetDefinition> = {
	'spektrum-wheel': card('spektrum-wheel', 'widget_spektrum_wheel', SpektrumWheelWidget, {
		w: 6,
		h: 14
	}),
	highlights: card('highlights', 'widget_highlights', HighlightsWidget, { w: 6, h: 3 }),
	'element-balance': card('element-balance', 'info_dominance_element', ElementBalanceWidget),
	'modality-balance': card(
		'modality-balance',
		'info_dominance_mode_quality',
		ModalityBalanceWidget
	),
	'house-balance': card('house-balance', 'info_dominance_houses', HouseBalanceWidget),
	quadrants: card('quadrants', 'info_quadrant_division', QuadrantsWidget),
	hemispheres: card('hemispheres', 'info_hemisphere_emphasis', HemispheresWidget),
	orientation: card('orientation', 'info_extroversion_introversion_ratio', OrientationWidget, {
		w: 3,
		h: 2
	}),
	'aspect-balance': card('aspect-balance', 'info_dominance_aspects', AspectBalanceWidget),
	configurations: card('configurations', 'info_planetary_configuration', ConfigurationsWidget),
	stelliums: card('stelliums', 'info_stellium', StelliumsWidget),
	singletons: card('singletons', 'info_singleton_hemisphere', SingletonsWidget, { w: 3, h: 2 }),
	retrograde: card('retrograde', 'open_motion_retrograde', RetrogradeWidget),
	'focal-planets': card('focal-planets', 'info_focal_planets', FocalPlanetsWidget, { w: 3, h: 5 })
};
