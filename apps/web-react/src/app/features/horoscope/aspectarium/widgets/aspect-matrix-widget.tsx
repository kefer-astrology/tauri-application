import { useTranslation } from 'react-i18next';
import { Text } from '@/app/components/ui/typography';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { AspectMatrix } from '@/app/views/domain/aspect-matrix';
import { normalizeLongitude } from '@/lib/astrology/chartSearch';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';
import { useAspectarium } from '../aspectarium-context';
import { useAspectariumLabels } from '../use-aspectarium-labels';

/** The aspect grid of the selected chart (or its transit overlay). A cell opens its details. */
export function AspectMatrixWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const { chart, transitOverlay, data, selected, select } = useAspectarium();
	const labels = useAspectariumLabels();
	const title = t('widget_aspect_matrix', { defaultValue: 'Aspect grid' });
	const chrome = useWidgetChrome(instance, title);
	const radix = (chart?.computed?.positions ?? {}) as Record<string, unknown>;
	const transit = (transitOverlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;

	return (
		<WidgetFrame
			{...chrome}
			title={title}
			fill
			bodyClassName="flex min-h-0 flex-col gap-2 px-0 pb-0"
		>
			<AspectMatrix
				data={data}
				selectedId={selected?.id ?? null}
				onSelect={select}
				bodyLabel={labels.bodyLabel}
				bodyColor={labels.bodyColor}
				aspectColor={labels.aspectColor}
				rowLongitude={(id) => normalizeLongitude((data.transit ? transit : radix)[id])}
				columnLongitude={(id) => normalizeLongitude(radix[id])}
				cornerLabel={t('transit_overlay_aspectarium_hint')}
				missingPositionLabel={t('loading_positions')}
			/>
			<Text
				variant="caption"
				tone="muted"
				className="border-t border-[color:var(--theme-panel-border)] px-4 py-2"
			>
				{data.entries.length > 0
					? t('aspectarium_select_aspect_hint')
					: data.transit
						? t('transit_overlay_no_aspects')
						: t('aspectarium_no_aspects')}
			</Text>
		</WidgetFrame>
	);
}
