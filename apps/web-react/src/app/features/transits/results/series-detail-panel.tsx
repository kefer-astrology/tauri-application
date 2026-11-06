import { Text } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { formatDateTime } from '@/lib/time/format';
import { seriesLabel } from './series-label';

/** Side panel of one aspect series: its exact crossings, each opening the chart at that time. */
export function SeriesDetailPanel({
	series,
	onClose,
	onOpenInstant
}: {
	series: AspectTimelineSeries | null;
	onClose: () => void;
	onOpenInstant: (datetime: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const label = series ? seriesLabel(series, t) : '';

	return (
		<DetailSidePanel
			open={series !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={label}
			description={series ? label : undefined}
		>
			{series && (
				<div className="flex flex-col gap-2">
					<Text variant="caption" tone="muted">
						{t('transit_detail_hits_title', { defaultValue: 'Exact crossings in this series' })}
					</Text>
					{series.hits.length === 0 ? (
						<Text variant="caption" tone="muted">
							{t('transit_detail_hits_empty', {
								defaultValue: 'No exact alignment within this computed period.'
							})}
						</Text>
					) : (
						<ul className="flex flex-col gap-1">
							{series.hits.map((hit) => (
								<li key={hit.timestampMs}>
									<Button
										type="button"
										variant="ghost"
										onClick={() => onOpenInstant(new Date(hit.timestampMs).toISOString())}
										className={cn(
											'h-auto w-full justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-normal transition-colors',
											'hover:bg-[color:var(--theme-hover-bg)] hover:text-[color:var(--theme-content-primary)]',
											ft.bodyText
										)}
									>
										<span>{formatDateTime(hit.timestampMs)}</span>
										<span className={cn('tabular-nums', ft.muted)}>
											{hit.hitNumber}/{hit.hitCount}
											{hit.fromRetrograde
												? ` · ${t('transits_event_search_retrograde', { defaultValue: 'retrograde' })}`
												: ''}
										</span>
									</Button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</DetailSidePanel>
	);
}
