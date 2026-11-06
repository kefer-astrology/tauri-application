import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { ChartContextCard } from '@/app/views/domain/chart-context-card';
import { tagColor } from '@/lib/chartTags';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useHoroskop } from '../horoskop-context';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';

/** The active chart's identity, tags and transit overlay; the pencil edits the chart. */
export function ChartProfileWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { chart, labels, transitOverlay, clearTransitOverlay, onEdit } = useHoroskop();
	const chrome = useWidgetChrome(
		instance,
		t('widget_chart_profile', { defaultValue: 'Chart profile' })
	);
	const tags = (chart?.tags ?? []).filter(Boolean);

	return (
		<WidgetFrame
			{...chrome}
			title={labels.name}
			dataTour="radix-profile"
			actions={
				<Button
					variant="ghost"
					size="icon"
					className="rounded-lg hover:bg-[color:var(--token-hover-subtle)]"
					aria-label={t('edit_radix_title')}
					disabled={!chart}
					onClick={() => {
						if (chart) onEdit?.(chart);
					}}
				>
					<Pencil className={cn('h-4 w-4', ft.muted)} />
				</Button>
			}
		>
			<ChartContextCard
				lines={[
					labels.type,
					labels.date,
					labels.time,
					labels.location,
					labels.coordinates,
					labels.houseSystem
				]}
				tags={tags.map((tag, index) => ({
					name: tag,
					color: tagColor(chart?.tagColors, tag, index)
				}))}
				transit={
					transitOverlay
						? {
								title: t('transit_overlay_label'),
								detail: `${t('transits_period_to')}: ${labels.transitMoment}`,
								clearLabel: t('transit_overlay_clear'),
								onClear: clearTransitOverlay
							}
						: null
				}
			/>
		</WidgetFrame>
	);
}
