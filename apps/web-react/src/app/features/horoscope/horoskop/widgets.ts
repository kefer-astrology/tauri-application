import type { WidgetDefinition } from '../workspace/widget-definition';
import { AstrolabeWidget } from './widgets/astrolabe-widget';
import { ChartProfileWidget } from './widgets/chart-profile-widget';
import { PositionsWidget } from './widgets/positions-widget';

/** The Horoskop widgets, by widget id. */
export const HOROSKOP_WIDGETS: Record<string, WidgetDefinition> = {
	'chart-profile': {
		manifest: {
			id: 'chart-profile',
			titleKey: 'widget_chart_profile',
			descriptionKey: 'widget_chart_profile_description',
			categories: ['common'],
			modules: ['horoskop'],
			repeatable: false,
			sizes: { min: { w: 1, h: 2 }, default: { w: 1, h: 3 } },
			horoskopRegion: 'left'
		},
		Component: ChartProfileWidget
	},
	astrolabe: {
		manifest: {
			id: 'astrolabe',
			titleKey: 'astrolabe',
			descriptionKey: 'widget_astrolabe_description',
			categories: ['common'],
			modules: ['horoskop'],
			repeatable: false,
			sizes: { min: { w: 1, h: 2 }, default: { w: 1, h: 3 } },
			horoskopRegion: 'left'
		},
		Component: AstrolabeWidget
	},
	positions: {
		manifest: {
			id: 'positions',
			titleKey: 'right_panel',
			descriptionKey: 'widget_positions_description',
			categories: ['common'],
			modules: ['horoskop', 'spektrum'],
			repeatable: true,
			sizes: { min: { w: 1, h: 3 }, default: { w: 1, h: 6 } },
			horoskopRegion: 'right'
		},
		Component: PositionsWidget
	}
};
