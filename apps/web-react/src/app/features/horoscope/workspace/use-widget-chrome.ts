import { useTranslation } from 'react-i18next';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import type { WidgetInstance } from '@/lib/widgets/types';

/** The frame props every widget instance shares: its `⋯` menu (remove from the workspace),
 *  highlight and instance marker. `name` is the widget's visible name. */
export function useWidgetChrome(instance: WidgetInstance, name: string) {
	const { t } = useTranslation();
	const { removeWidget, highlightedInstanceId } = useWidgetWorkspace();
	return {
		instanceId: instance.instanceId,
		highlighted: highlightedInstanceId === instance.instanceId,
		menu: {
			label: t('widget_menu', { name, defaultValue: '{{name}} options' }),
			items: [
				{
					id: 'remove',
					label: t('widget_remove', { defaultValue: 'Remove from workspace' }),
					onSelect: () => removeWidget(instance.instanceId, name)
				}
			]
		}
	};
}
