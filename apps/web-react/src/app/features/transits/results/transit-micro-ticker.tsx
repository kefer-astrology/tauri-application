import { useTranslation } from 'react-i18next';
import { TimeTicker } from '@/app/views/data/time-ticker';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { objectIcon, objectLabel } from '@/lib/astrology/objectLabels';
import { formatDateTime } from '@/lib/time/format';
import { seriesLabel } from './series-label';

/** Exact hits on the fast transited bodies (natal Sun–Mars) under the resonance chart, one lane
 *  per body, so contacts to the personal points read at a glance. A tick opens the series'
 *  details. */
export function TransitMicroTicker({
	categories,
	bodyIds,
	series,
	colorByKey,
	visibleRange,
	onTickClick
}: {
	categories: number[];
	/** Fast transited bodies, one lane each, in this order. */
	bodyIds: string[];
	/** Aspect series aimed at them. */
	series: AspectTimelineSeries[];
	colorByKey: Map<string, string>;
	visibleRange: [number, number] | null;
	onTickClick: (seriesKey: string) => void;
}) {
	const { t } = useTranslation();
	const seriesKeyByMark = new Map<string, string>();
	const marks = series.flatMap((s) =>
		s.hits.map((hit) => {
			const id = `${s.key}@${hit.timestampMs}`;
			seriesKeyByMark.set(id, s.key);
			return {
				id,
				laneId: s.to,
				x: hit.timestampMs,
				color: colorByKey.get(s.key) ?? 'var(--theme-accent)',
				title: `${seriesLabel(s, t)} — ${formatDateTime(hit.timestampMs)}`
			};
		})
	);

	return (
		<TimeTicker
			categories={categories}
			lanes={bodyIds.map((id) => ({ id, label: objectIcon(id), title: objectLabel(id, t) }))}
			marks={marks}
			visibleRange={visibleRange}
			onMarkClick={(markId) => {
				const key = seriesKeyByMark.get(markId);
				if (key) onTickClick(key);
			}}
			title={t('transit_micro_ticker_title', { defaultValue: 'Micro ticker (personal planets)' })}
			emptyLabel={t('transit_micro_ticker_empty', {
				defaultValue: 'No fast transited bodies (Sun–Mars) selected.'
			})}
		/>
	);
}
