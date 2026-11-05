import { useTranslation } from 'react-i18next';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { AspectEntryList } from '@/app/views/domain/aspect-entry-list';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';
import { useAspectarium } from '../aspectarium-context';
import { useAspectariumLabels } from '../use-aspectarium-labels';

/** The filtered aspects as a list. A row opens its details. */
export function AspectListWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const { data, selected, select } = useAspectarium();
	const labels = useAspectariumLabels();
	const title = t('widget_aspect_list', { defaultValue: 'Aspect list' });
	const chrome = useWidgetChrome(instance, title);

	return (
		<WidgetFrame {...chrome} title={title} fill bodyClassName="min-h-0 overflow-y-auto px-0">
			<AspectEntryList
				entries={data.entries}
				selectedId={selected?.id ?? null}
				onSelect={select}
				bodyLabel={labels.bodyLabel}
				aspectLabel={labels.aspectLabel}
				aspectColor={labels.aspectColor}
				emptyText={data.transit ? t('transit_overlay_no_aspects') : t('aspectarium_no_aspects')}
			/>
		</WidgetFrame>
	);
}
