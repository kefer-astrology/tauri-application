import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
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
	const ft = useAppFormFieldTheme();
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
				<div className="space-y-1 border-b border-[color:var(--theme-panel-border)] px-4 py-2">
					{error && <p className="text-destructive text-xs">{error}</p>}
					{warnings.map((warning, index) => (
						<p key={index} className={cn('text-xs', ft.muted)}>
							{warning}
						</p>
					))}
				</div>
			)}

			<div className="flex min-h-0 flex-1">
				<div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
					{chartMode && <ResonanceMappingNote degrees={view.yZoomDegrees} />}

					{visibleSeries.length === 0 ? (
						<p className={cn('py-10 text-center text-sm', ft.muted)}>
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
						</p>
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
