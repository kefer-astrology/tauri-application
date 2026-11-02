import { Surface } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/app/providers/workspace';
import { aspectColorByKey, exactHitRows, fastBodies } from '@/lib/astrology/transitResults';
import { useTransits } from '../transits-provider';
import { ConfigurationMatchesPanel } from './configuration-matches-panel';
import { CycleAnalysisPanel } from './cycle-analysis-panel';
import { EventSearchPanel } from './event-search-panel';
import { ExactHitsTable } from './exact-hits-table';
import { ResonanceMappingNote, ResonancePanel } from './resonance-panel';
import { ResultsToolbar } from './results-toolbar';
import { SeriesDetailPanel } from './series-detail-panel';

/** Computed transits: the resonance chart or exact-hit table with the cycle analysis beside it,
 *  then exact events and configuration matches. */
export function TransitsResultsView() {
	const { t } = useTranslation();

	const { workspaceDefaults } = useWorkspace();
	const {
		series,
		timelineCategories,
		timelineSeries,
		setup,
		view,
		loading,
		error,
		warnings,
		eventSearch,
		openChartAtInstant
	} = useTransits();

	const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
	// A second click on a highlighted wave opens its details; closing them clears both.
	const [detailKey, setDetailKey] = useState<string | null>(null);
	const openInstant = (datetime: string) => void openChartAtInstant(datetime);

	const visibleSeries = useMemo(
		() => timelineSeries.filter((s) => !view.hiddenSeriesKeys.has(s.key)),
		[timelineSeries, view.hiddenSeriesKeys]
	);
	const colorByKey = useMemo(
		() => aspectColorByKey(visibleSeries, workspaceDefaults.defaultAspectColors),
		[visibleSeries, workspaceDefaults.defaultAspectColors]
	);
	const hitRows = useMemo(() => exactHitRows(visibleSeries), [visibleSeries]);
	const chartMode = view.viewMode === 'chart';

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<ResultsToolbar />

			{(error || warnings.length > 0) && (
				<Surface variant="plain" divider="bottom" className="space-y-1 px-4 py-2">
					{error && (
						<Text variant="caption" className="text-destructive">
							{error}
						</Text>
					)}
					{warnings.map((warning, index) => (
						<Text variant="caption" tone="muted" key={index}>
							{warning}
						</Text>
					))}
				</Surface>
			)}

			<div className="flex min-h-0 flex-1">
				<div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
					{chartMode && <ResonanceMappingNote degrees={view.yZoomDegrees} />}

					{visibleSeries.length === 0 ? (
						<Text variant="body" tone="muted" className="py-10 text-center">
							{loading
								? t('transit_loading')
								: !setup.sampledGraphOutput
									? t('transits_sampled_graph_output_disabled_note', {
											defaultValue:
												'Sampled graph output is off — see Exact events / Multi-body configurations below.'
										})
									: t('aspect_timeline_no_pairs', {
											defaultValue: 'No aspects were detected within orb across this series.'
										})}
						</Text>
					) : chartMode ? (
						<ResonancePanel
							categories={timelineCategories}
							series={visibleSeries}
							fastBodyIds={fastBodies(setup.transitedBodies)}
							colorByKey={colorByKey}
							yMaxDegrees={view.yZoomDegrees}
							visibleRange={view.visibleRange}
							onVisibleRangeChange={view.setVisibleRange}
							highlightedKey={highlightedKey}
							onHighlightChange={setHighlightedKey}
							onOpenSeries={setDetailKey}
						/>
					) : (
						<ExactHitsTable rows={hitRows} />
					)}
				</div>

				<CycleAnalysisPanel series={visibleSeries} entries={series} colorByKey={colorByKey} />
			</div>

			<EventSearchPanel eventSearch={eventSearch} onOpenInstant={openInstant} />
			<ConfigurationMatchesPanel
				matches={eventSearch.configuration_matches}
				onOpenInstant={openInstant}
			/>

			<SeriesDetailPanel
				series={timelineSeries.find((s) => s.key === detailKey) ?? null}
				onClose={() => {
					setDetailKey(null);
					setHighlightedKey(null);
				}}
				onOpenInstant={openInstant}
			/>
		</div>
	);
}
