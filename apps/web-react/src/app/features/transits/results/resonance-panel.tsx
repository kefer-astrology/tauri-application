import { Text } from '@/app/components/ui/typography';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import {
	clippedOrbValues,
	resonanceMarkers,
	seriesToTargets
} from '@/lib/astrology/transitResults';
import { seriesLabel } from './series-label';
import { TransitMicroTicker } from './transit-micro-ticker';
import { TransitResonanceChart } from './transit-resonance-chart';

/** The resonance chart of the aspect waves, with the micro ticker below it: exact hits on the
 *  fast transited bodies (natal Sun–Mars), one lane each. */
export function ResonancePanel({
	categories,
	series,
	fastBodyIds,
	colorByKey,
	yMaxDegrees,
	visibleRange,
	onVisibleRangeChange,
	highlightedKey,
	onHighlightChange,
	onOpenSeries
}: {
	categories: number[];
	/** Visible series; all are drawn as waves. */
	series: AspectTimelineSeries[];
	/** Fast transited bodies (Sun–Mars), one ticker lane each. */
	fastBodyIds: string[];
	colorByKey: Map<string, string>;
	yMaxDegrees: number;
	visibleRange: [number, number] | null;
	onVisibleRangeChange: (range: [number, number] | null) => void;
	highlightedKey: string | null;
	onHighlightChange: (key: string | null) => void;
	/** Open a series' details (second click on a wave, or a tick). */
	onOpenSeries: (key: string) => void;
}) {
	const { t } = useTranslation();
	const ticks = useMemo(() => seriesToTargets(series, fastBodyIds), [series, fastBodyIds]);
	const values = useMemo(() => clippedOrbValues(series, yMaxDegrees), [series, yMaxDegrees]);
	const markers = useMemo(
		() =>
			resonanceMarkers(series, values, (s) =>
				t('aspect_timeline_hit_title', { defaultValue: 'Exact {{pair}}', pair: seriesLabel(s, t) })
			),
		[series, values, t]
	);

	const tooltipExtra = (seriesId: string, index: number): string | null => {
		const phase = series.find((s) => s.key === seriesId)?.phase[index];
		if (!phase) return null;
		return phase === 'applying'
			? t('aspect_timeline_applying', { defaultValue: 'Applying' })
			: t('aspect_timeline_separating', { defaultValue: 'Separating' });
	};

	return (
		<div className="flex min-h-[28rem] flex-1 flex-col gap-3">
			<div className="min-h-0 flex-1">
				<TransitResonanceChart
					categories={categories}
					series={series.map((s) => ({
						id: s.key,
						label: seriesLabel(s, t),
						color: colorByKey.get(s.key) ?? 'var(--theme-accent)'
					}))}
					values={values}
					markers={markers}
					tooltipExtra={tooltipExtra}
					yMaxDegrees={yMaxDegrees}
					visibleRange={visibleRange}
					onVisibleRangeChange={onVisibleRangeChange}
					highlightedKey={highlightedKey}
					onHighlightChange={onHighlightChange}
					onActivate={onOpenSeries}
					ariaLabel={t('aspect_timeline_subtitle', { defaultValue: 'Aspect timeline' })}
				/>
			</div>
			<TransitMicroTicker
				categories={categories}
				bodyIds={fastBodyIds}
				series={ticks}
				colorByKey={colorByKey}
				visibleRange={visibleRange}
				onTickClick={onOpenSeries}
			/>
		</div>
	);
}

/** How the chart maps orbs, shown above it in chart mode. */
export function ResonanceMappingNote({ degrees }: { degrees: number }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<Text
			variant="caption"
			tone="muted"
			className={cn('mb-4 shrink-0 rounded-lg border p-3', ft.footerBorder)}
		>
			{t('aspect_timeline_mapping_note', {
				defaultValue:
					"Display mapping: the y-axis is the raw angular deviation from exact, in degrees, capped at a {{degrees}}° window — 0° at exact alignment, {{degrees}}° at the edge of what's shown. A wider configured orb only becomes visible once it closes to within range. Scroll to zoom, drag to pan.",
				degrees
			})}
		</Text>
	);
}
