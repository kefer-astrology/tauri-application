import type { ComponentType } from 'react';
import type { WidgetInstance, WidgetManifest } from '@/lib/widgets/types';

/** A widget: its manifest and the component drawn for each of its instances. */
export interface WidgetDefinition {
	manifest: WidgetManifest;
	Component: ComponentType<{ instance: WidgetInstance }>;
}
