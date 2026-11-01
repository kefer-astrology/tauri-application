import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeferLoaderOverlay } from '@/app/components/ui/kefer-loader';
import { useWorkspace } from '@/app/providers/workspace';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import {
	anchoredAspectTimelines,
	sampledSeriesToShow,
	transitResultWarnings
} from '@/lib/astrology/transitResults';
import {
	defaultTransitSetup,
	EMPTY_EVENT_SEARCH,
	estimateSampleCount,
	stepToSeconds,
	transitRequestRange,
	transitSetupFromDto,
	transitSetupToDto,
	type TransitSetupState
} from '@/lib/astrology/transitSetup';
import {
	chartDataToComputePayload,
	normalizeComputedChartPayload,
	type AppChart
} from '@/lib/tauri/chartPayload';
import type { TransitEventSearch, TransitSeriesEntry } from '@/lib/tauri/types';
import { computeChartFromData, loadTransitSetup, saveTransitSetup } from '@/lib/tauri/workspace';
import { computeTransitSnapshot, requestTransitSeries } from './compute-transits';
import { useResultsView, type ResultsView } from './use-results-view';

const errorText = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export interface TransitsValue {
	/** `results` once a series is computed, until the setup is opened again or reset. */
	mode: 'setup' | 'results';
	/** Open the setup again, keeping the results. */
	editSetup: () => void;

	setup: TransitSetupState;
	updateSetup: (patch: Partial<TransitSetupState>) => void;
	/** The chart transits are computed for: the chosen one, else the selected or first chart. */
	sourceChartId: string;
	setSourceChartId: (id: string) => void;
	timeStepSeconds: number;
	estimatedSampleCount: number;

	loading: boolean;
	error: string | null;
	/** Notes on the last computation that did not stop it (fallback backend, short series). */
	warnings: string[];
	series: TransitSeriesEntry[];
	/** Exact events and configuration matches, separate from the sampled series. */
	eventSearch: TransitEventSearch;
	/** Shared timestamps of `timelineSeries`. */
	timelineCategories: number[];
	/** Aspect timelines of the transiting bodies against the transited bodies. */
	timelineSeries: AspectTimelineSeries[];

	/** Save the setup and compute; `range` replaces the setup's period. */
	compute: (range?: { start: Date; end: Date }) => Promise<void>;
	/** Drop the results (back to the setup), keeping the setup. */
	reset: () => void;
	/** Recompute for one instant (an event, or a configuration's entry / best fit / exit). */
	openChartAtInstant: (datetime: string) => Promise<void>;

	view: ResultsView;
}

const TransitsContext = createContext<TransitsValue | null>(null);

/** Transit setup, computation and results. Mounted around the whole shell because the results
 *  also drive the secondary sidebar and the horoscope views' transit overlay. */
export function TransitsProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const { workspacePath, workspaceDefaults } = useWorkspace();
	const {
		charts,
		selectedChartId,
		setCharts,
		setSelectedChartId,
		setTransitOverlay,
		clearTransitOverlay
	} = useWorkspaceCharts();

	const [setup, setSetup] = useState<TransitSetupState>(() => defaultTransitSetup(new Date()));
	const [chosenSourceChartId, setSourceChartId] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [series, setSeries] = useState<TransitSeriesEntry[]>([]);
	const [eventSearch, setEventSearch] = useState<TransitEventSearch>(EMPTY_EVENT_SEARCH);
	const [forceSetupView, setForceSetupView] = useState(false);
	const view = useResultsView();

	const updateSetup = (patch: Partial<TransitSetupState>) =>
		setSetup((prev) => ({ ...prev, ...patch }));

	const sourceChartId = chosenSourceChartId || selectedChartId || charts[0]?.id || '';

	useEffect(() => {
		if (chosenSourceChartId || charts.length === 0) return;
		setSourceChartId(selectedChartId ?? charts[0].id);
	}, [charts, selectedChartId, chosenSourceChartId]);

	// A new source chart starts clean and loads its saved setup.
	useEffect(() => {
		let cancelled = false;
		setSeries([]);
		setError(null);
		clearTransitOverlay();
		if (!workspacePath || !sourceChartId) return;

		void loadTransitSetup(workspacePath, sourceChartId)
			.then((saved) => {
				if (!cancelled && saved) setSetup((prev) => transitSetupFromDto(saved, prev));
			})
			.catch((err) => {
				if (cancelled) return;
				console.error('Failed to load transit setup:', err);
				setError(errorText(err, 'Failed to load transit setup.'));
			});
		return () => {
			cancelled = true;
		};
	}, [clearTransitOverlay, sourceChartId, workspacePath]);

	const fixedChartPositions = useMemo(
		() => charts.find((chart) => chart.id === sourceChartId)?.computed?.positions ?? {},
		[charts, sourceChartId]
	);

	const timelines = useMemo(
		() =>
			anchoredAspectTimelines(
				series,
				setup.transitingBodies,
				fixedChartPositions,
				setup.transitedBodies
			),
		[series, setup.transitingBodies, fixedChartPositions, setup.transitedBodies]
	);

	const timeStepSeconds = stepToSeconds(setup.timeStepValue, setup.timeStepUnit);
	const estimatedSampleCount = estimateSampleCount(
		setup.periodModeId,
		setup.fromDateTime,
		setup.toDateTime,
		timeStepSeconds
	);

	const ensureChartComputed = async (
		chart: AppChart
	): Promise<NonNullable<AppChart['computed']>> => {
		if (Object.keys(chart.computed?.positions ?? {}).length > 0) return chart.computed!;
		const computed = normalizeComputedChartPayload(
			await computeChartFromData(chartDataToComputePayload(chart, workspaceDefaults))
		);
		setCharts((prev) =>
			prev.map((existing) => (existing.id === chart.id ? { ...existing, computed } : existing))
		);
		return computed;
	};

	const compute = async (override?: { start: Date; end: Date }) => {
		if (!sourceChartId) {
			setError('No chart selected for transit computation.');
			return;
		}
		const sourceChart = charts.find((chart) => chart.id === sourceChartId);
		if (!sourceChart) {
			setError('Selected chart was not found.');
			return;
		}
		if (setup.selectedAspects.length === 0) {
			setError('Select at least one aspect for transit computation.');
			return;
		}

		const range = transitRequestRange(setup, override, new Date());
		const request = { setup, sourceChart, workspaceDefaults, range };

		setLoading(true);
		setError(null);
		setWarnings([]);
		setSeries([]);
		setEventSearch(EMPTY_EVENT_SEARCH);
		setForceSetupView(false);
		view.clear();

		try {
			if (workspacePath)
				await saveTransitSetup(workspacePath, transitSetupToDto(setup, sourceChart));
			const { overlay, snapshot } = await computeTransitSnapshot({
				...request,
				radix: await ensureChartComputed(sourceChart),
				transitChartName: `${sourceChart.name} ${t('transits_general_transit_transit')}`
			});
			setTransitOverlay(overlay);
			setSelectedChartId(sourceChart.id);

			try {
				const result = await requestTransitSeries({ ...request, workspacePath });
				setSeries(sampledSeriesToShow(result.results, setup.sampledGraphOutput, snapshot));
				setEventSearch(result.event_search ?? EMPTY_EVENT_SEARCH);
				setWarnings(transitResultWarnings(result, setup.periodModeId, estimatedSampleCount));
			} catch (seriesErr) {
				console.error('Failed to compute transit series:', seriesErr);
				setSeries([snapshot]);
				setError(errorText(seriesErr, 'Transit series failed; showing the end timestamp overlay.'));
			}
		} catch (err) {
			console.error('Failed to compute transits:', err);
			setError(errorText(err, 'Transit computation failed.'));
		} finally {
			setLoading(false);
		}
	};

	const reset = () => {
		setSeries([]);
		setEventSearch(EMPTY_EVENT_SEARCH);
		setError(null);
		setWarnings([]);
		setForceSetupView(false);
		view.clear();
		clearTransitOverlay();
	};

	const openChartAtInstant = async (datetime: string) => {
		const instant = new Date(datetime);
		if (Number.isNaN(instant.getTime())) return;
		updateSetup({ periodModeId: 'current', fromDateTime: instant, toDateTime: instant });
		await compute({ start: instant, end: instant });
	};

	const value: TransitsValue = {
		mode: series.length > 0 && !forceSetupView ? 'results' : 'setup',
		editSetup: () => setForceSetupView(true),
		setup,
		updateSetup,
		sourceChartId,
		setSourceChartId,
		timeStepSeconds,
		estimatedSampleCount,
		loading,
		error,
		warnings,
		series,
		eventSearch,
		timelineCategories: timelines.categories,
		timelineSeries: timelines.series,
		compute,
		reset,
		openChartAtInstant,
		view
	};

	return (
		<TransitsContext.Provider value={value}>
			{children}
			<KeferLoaderOverlay active={loading} />
		</TransitsContext.Provider>
	);
}

export function useTransits(): TransitsValue {
	const ctx = useContext(TransitsContext);
	if (!ctx) throw new Error('useTransits must be used within TransitsProvider');
	return ctx;
}
