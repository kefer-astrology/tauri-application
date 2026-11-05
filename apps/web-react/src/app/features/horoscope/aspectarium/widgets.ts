import type { WidgetDefinition } from '../workspace/widget-definition';
import { AspectListWidget } from './widgets/aspect-list-widget';
import { AspectMatrixWidget } from './widgets/aspect-matrix-widget';
import { MidpointsWidget } from './widgets/midpoints-widget';

/** The Aspectarium widgets, by widget id. */
export const ASPEKTARIUM_WIDGETS: Record<string, WidgetDefinition> = {
	'aspect-matrix': {
		manifest: {
			id: 'aspect-matrix',
			titleKey: 'widget_aspect_matrix',
			descriptionKey: 'widget_aspect_matrix_description',
			categories: ['common'],
			modules: ['aspektarium', 'spektrum'],
			repeatable: false,
			sizes: { min: { w: 4, h: 6 }, default: { w: 8, h: 8 } }
		},
		Component: AspectMatrixWidget
	},
	'aspect-list': {
		manifest: {
			id: 'aspect-list',
			titleKey: 'widget_aspect_list',
			descriptionKey: 'widget_aspect_list_description',
			categories: ['common'],
			modules: ['aspektarium', 'spektrum'],
			repeatable: false,
			sizes: { min: { w: 3, h: 4 }, default: { w: 4, h: 8 } }
		},
		Component: AspectListWidget
	},
	midpoints: {
		manifest: {
			id: 'midpoints',
			titleKey: 'aspectarium_view_midpoints',
			descriptionKey: 'widget_midpoints_description',
			categories: ['common'],
			modules: ['aspektarium', 'spektrum'],
			repeatable: false,
			sizes: { min: { w: 6, h: 4 }, default: { w: 12, h: 6 } }
		},
		Component: MidpointsWidget
	}
};
