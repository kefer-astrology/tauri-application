import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	computeChartFromData,
	computeCrossAspectsFromData,
	computeTransitSeries,
	computeTransitSeriesFromData,
	loadTransitSetup,
	saveTransitSetup
} from '@/lib/tauri/workspace';
import type { TransitSeriesEntry, TransitSetup } from '@/lib/tauri/types';
import { normalizeLongitude } from '@/lib/astrology/transits';
import { DEFAULT_ENABLED_ASPECT_IDS } from '@/lib/astrology/aspects';
import { buildAspectTimelines, type AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import {
	chartDataToComputePayload,
	normalizeComputedChartPayload,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { useWorkspaceCharts } from './workspace-charts';

export const DEFAULT_TRANSIT_BODY_IDS = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

/** Default fixed-anchor selection (the "Transited Bodies" tab): the slow outer planets. A fixed
 *  anchor is picked once and shown in the results sidebar, so it should be something that still
 *  means the same thing across the whole scan — an inner planet's own position would itself be
 *  stale within days, defeating the point of pinning it. The Transited Bodies tab still lets
 *  anyone add faster ones back in. */
export const DEFAULT_FIXED_ANCHOR_BODY_IDS = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

// `ASPECT_ROWS` is a runtime projection of the Rust model catalog — empty until
// `setAspectDefinitions` populates it, so filtering it at module-eval time (before that call
// lands) silently produces an empty default. `DEFAULT_ENABLED_ASPECT_IDS` is the static,
// always-available "basic aspects" list the rest of the app already standardized on for exactly
// this reason.
const DEFAULT_TRANSIT_ASPECT_IDS = DEFAULT_ENABLED_ASPECT_IDS;

export type TimeStepUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export const TIME_STEP_UNIT_SECONDS: Record<TimeStepUnit, number> = {
	seconds: 1,
	minutes: 60,
	hours: 3600,
	days: 86400
};

/** Largest unit that divides `seconds` evenly, so a saved step (e.g. 3600s) edits back as "1 hour". */
function secondsToStep(seconds: number): { value: number; unit: TimeStepUnit } {
	const units: TimeStepUnit[] = ['days', 'hours', 'minutes', 'seconds'];
	for (const unit of units) {
		const perUnit = TIME_STEP_UNIT_SECONDS[unit];
		if (seconds % perUnit === 0 && seconds / perUnit >= 1) {
			return { value: seconds / perUnit, unit };
		}
	}
	return { value: Math.max(1, Math.round(seconds)), unit: 'seconds' };
}

function formatDateInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseLocalDateTime(dateValue: string, timeValue: string, fallback: Date): Date {
	const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
	return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatTimeInput(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

function positionsForIds(
	positions: Record<string, unknown>,
	ids: readonly string[]
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const id of new Set(ids)) {
		const longitude = normalizeLongitude(positions[id]);
		if (longitude !== null) result[id] = longitude;
	}
	return result;
}

export type TransitsMode = 'setup' | 'results';
export type TransitsResultsViewMode = 'chart' | 'table';

export interface TransitsWorkspaceValue {
	mode: TransitsMode;
	/** Opens the setup screen again without discarding the computed series — so adjusting the
	 *  period/bodies/aspects and recomputing doesn't require a full Reset first. */
	editSetup: () => void;

	selectedTypeId: string;
	setSelectedTypeId: (value: string) => void;
	periodModeId: string;
	setPeriodModeId: (value: string) => void;
	checkboxes: {
		houseTransitions: boolean;
		signTransitions: boolean;
		transitLimits: boolean;
		precessionCorrection: boolean;
	};
	setCheckboxes: (value: TransitsWorkspaceValue['checkboxes']) => void;
	sourceChartId: string;
	setSourceChartId: (value: string) => void;
	effectiveSourceChartId: string;
	fromDateTime: Date;
	setFromDateTime: (value: Date) => void;
	toDateTime: Date;
	setToDateTime: (value: Date) => void;
	transitingBodies: string[];
	setTransitingBodies: (value: string[]) => void;
	transitedBodies: string[];
	setTransitedBodies: (value: string[]) => void;
	selectedAspects: string[];
	setSelectedAspects: (value: string[]) => void;
	timeStepValue: number;
	setTimeStepValue: (value: number) => void;
	timeStepUnit: TimeStepUnit;
	setTimeStepUnit: (value: TimeStepUnit) => void;
	timeStepSeconds: number;
	estimatedSampleCount: number;

	transitLoading: boolean;
	transitError: string | null;
	/** Non-fatal notes about the last compute (backend fallback, a suspiciously short result, …) —
	 *  shown alongside the results even though they didn't stop a series from coming back. */
	transitWarnings: string[];
	transitSeries: TransitSeriesEntry[];
	transitResultsCountLabel: string;
	/** Transiting body ids actually present in the computed series (falls back to the
	 *  configured selection while nothing has been computed yet). */
	transitingBodyIdsInSeries: string[];
	/** Snapshot of the fixed/natal chart's positions at compute time — the "to" side for
	 *  moving-fixed aspect pairs. */
	fixedChartPositions: Record<string, unknown>;
	/** Shared timestamps for every aspect-timeline series (`aspectTimelineSeries`), computed once
	 *  so the left nav and the results dashboard never derive it twice. */
	aspectTimelineCategories: number[];
	aspectTimelineSeries: AspectTimelineSeries[];
	handleComputeTransits: () => Promise<void>;
	/** Clears the computed series (returns to the setup screen) without touching the configured
	 *  setup fields, so hitting "Calculate" again reruns with the same selection. */
	reset: () => void;

	selectedTransitedObjectId: string | null;
	setSelectedTransitedObjectId: (value: string | null) => void;
	resultsViewMode: TransitsResultsViewMode;
	setResultsViewMode: (value: TransitsResultsViewMode) => void;
}

const TransitsWorkspaceContext = createContext<TransitsWorkspaceValue | null>(null);

export function TransitsWorkspaceProvider({
	children,
	workspacePath,
	workspaceDefaults
}: {
	children: ReactNode;
	workspacePath: string | null;
	workspaceDefaults: WorkspaceDefaultsState;
}) {
	const { t } = useTranslation();
	const {
		charts,
		selectedChartId,
		setCharts,
		setSelectedChartId,
		setTransitOverlay,
		clearTransitOverlay
	} = useWorkspaceCharts();

	const [selectedTypeId, setSelectedTypeId] = useState('transit');
	const [periodModeId, setPeriodModeId] = useState('current');
	const [checkboxes, setCheckboxes] = useState({
		houseTransitions: false,
		signTransitions: false,
		transitLimits: false,
		precessionCorrection: false
	});
	const now = useMemo(() => new Date(), []);
	const tomorrow = useMemo(() => {
		const date = new Date(now);
		date.setDate(date.getDate() + 1);
		return date;
	}, [now]);
	const [sourceChartId, setSourceChartId] = useState('');
	const [fromDateTime, setFromDateTime] = useState<Date>(() => now);
	const [toDateTime, setToDateTime] = useState<Date>(() => tomorrow);
	// `transitingBodies`/`transitedBodies` match the Rust command's own `transiting_objects`/
	// `transited_objects`, and the conventional astrological sense in both English and Czech:
	// transiting (tranzitující, active) = swept across the whole period and recomputed at every
	// sample; transited (tranzitovaná, passive) = resolved once, from the source chart's own
	// moment, held fixed, and shown in the results sidebar once computed. The "Transiting Bodies" /
	// "Transited Bodies" tabs (transits-content.tsx) edit these in that same order.
	const [transitingBodies, setTransitingBodies] = useState<string[]>(DEFAULT_TRANSIT_BODY_IDS);
	const [transitedBodies, setTransitedBodies] = useState<string[]>(DEFAULT_FIXED_ANCHOR_BODY_IDS);
	const [selectedAspects, setSelectedAspects] = useState<string[]>(DEFAULT_TRANSIT_ASPECT_IDS);
	const [timeStepValue, setTimeStepValue] = useState(1);
	const [timeStepUnit, setTimeStepUnit] = useState<TimeStepUnit>('hours');
	const [transitLoading, setTransitLoading] = useState(false);
	const [transitError, setTransitError] = useState<string | null>(null);
	const [transitWarnings, setTransitWarnings] = useState<string[]>([]);
	const [transitSeries, setTransitSeries] = useState<TransitSeriesEntry[]>([]);
	const [selectedTransitedObjectId, setSelectedTransitedObjectId] = useState<string | null>(null);
	const [resultsViewMode, setResultsViewMode] = useState<TransitsResultsViewMode>('chart');
	const [forceSetupView, setForceSetupView] = useState(false);

	const effectiveSourceChartId = sourceChartId || selectedChartId || charts[0]?.id || '';

	useEffect(() => {
		if (sourceChartId || charts.length === 0) return;
		setSourceChartId(selectedChartId ?? charts[0].id);
	}, [charts, selectedChartId, sourceChartId]);

	useEffect(() => {
		let cancelled = false;
		setTransitSeries([]);
		setTransitError(null);
		clearTransitOverlay();

		if (!workspacePath || !effectiveSourceChartId) {
			return () => {
				cancelled = true;
			};
		}

		void loadTransitSetup(workspacePath, effectiveSourceChartId)
			.then((setup) => {
				if (cancelled || !setup) return;
				setSelectedTypeId(setup.transit_type);
				setPeriodModeId(setup.period_mode);
				setFromDateTime((prev) => parseLocalDateTime(setup.from_date, setup.from_time, prev));
				setToDateTime((prev) => parseLocalDateTime(setup.to_date, setup.to_time, prev));
				setTransitingBodies(setup.transiting_bodies);
				setTransitedBodies(setup.transited_bodies);
				setSelectedAspects(setup.aspect_types);
				const step = secondsToStep(setup.time_step_seconds);
				setTimeStepValue(step.value);
				setTimeStepUnit(step.unit);
				setCheckboxes({
					houseTransitions: setup.house_transitions,
					signTransitions: setup.sign_transitions,
					transitLimits: setup.transit_limits,
					precessionCorrection: setup.precession_correction
				});
			})
			.catch((err) => {
				if (cancelled) return;
				console.error('Failed to load transit setup:', err);
				setTransitError(err instanceof Error ? err.message : 'Failed to load transit setup.');
			});

		return () => {
			cancelled = true;
		};
	}, [clearTransitOverlay, effectiveSourceChartId, workspacePath]);

	const transitingBodyIdsInSeries = useMemo(() => {
		const ids = new Set<string>();
		for (const entry of transitSeries) {
			for (const id of Object.keys(entry.transit_positions ?? {})) ids.add(id);
		}
		return ids.size > 0 ? Array.from(ids) : transitingBodies;
	}, [transitSeries, transitingBodies]);

	const fixedChartPositions = useMemo(
		() => charts.find((chart) => chart.id === effectiveSourceChartId)?.computed?.positions ?? {},
		[charts, effectiveSourceChartId]
	);

	const { categories: aspectTimelineCategories, series: aspectTimelineSeries } = useMemo(
		() => buildAspectTimelines(transitSeries, transitingBodyIdsInSeries, fixedChartPositions),
		[transitSeries, transitingBodyIdsInSeries, fixedChartPositions]
	);

	const timeStepSeconds = Math.max(
		1,
		Math.round(timeStepValue) * TIME_STEP_UNIT_SECONDS[timeStepUnit]
	);

	const estimatedSampleCount = useMemo(() => {
		if (periodModeId !== 'custom') return 1;
		const durationSeconds = (toDateTime.getTime() - fromDateTime.getTime()) / 1000;
		if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1;
		return Math.floor(durationSeconds / timeStepSeconds) + 1;
	}, [periodModeId, fromDateTime, toDateTime, timeStepSeconds]);

	const transitResultsCountLabel = useMemo(
		() => t('transit_results_count').replace('{count}', String(transitSeries.length)),
		[t, transitSeries.length]
	);

	const ensureChartComputed = async (
		chart: AppChart
	): Promise<NonNullable<AppChart['computed']>> => {
		if (Object.keys(chart.computed?.positions ?? {}).length > 0) {
			return chart.computed!;
		}
		const result = await computeChartFromData(chartDataToComputePayload(chart, workspaceDefaults));
		const computed = normalizeComputedChartPayload(result);
		setCharts((prev) =>
			prev.map((existing) => (existing.id === chart.id ? { ...existing, computed } : existing))
		);
		return computed;
	};

	const handleComputeTransits = async () => {
		if (!effectiveSourceChartId) {
			setTransitError('No chart selected for transit computation.');
			return;
		}
		const sourceChart = charts.find((chart) => chart.id === effectiveSourceChartId);
		if (!sourceChart) {
			setTransitError('Selected chart was not found.');
			return;
		}
		if (selectedAspects.length === 0) {
			setTransitError('Select at least one aspect for transit computation.');
			return;
		}

		const range: { startDatetime: string; endDatetime: string } =
			periodModeId === 'current'
				? (() => {
						const instant = new Date().toISOString();
						return { startDatetime: instant, endDatetime: instant };
					})()
				: {
						startDatetime: fromDateTime.toISOString(),
						endDatetime: toDateTime.toISOString()
					};

		setTransitLoading(true);
		setTransitError(null);
		setTransitWarnings([]);
		setTransitSeries([]);
		setSelectedTransitedObjectId(null);
		setResultsViewMode('chart');
		setForceSetupView(false);

		try {
			if (workspacePath) {
				const setup: TransitSetup = {
					version: 1,
					source_chart_id: effectiveSourceChartId,
					transit_type: selectedTypeId,
					period_mode: periodModeId,
					from_date: formatDateInput(fromDateTime),
					from_time: formatTimeInput(fromDateTime),
					to_date: formatDateInput(toDateTime),
					to_time: formatTimeInput(toDateTime),
					time_step_seconds: timeStepSeconds,
					transiting_bodies: transitingBodies,
					transited_bodies: transitedBodies,
					aspect_types: selectedAspects,
					aspect_orbs: sourceChart.aspectOrbs ?? {},
					model: sourceChart.model ?? null,
					model_overrides: sourceChart.modelOverrides ?? null,
					house_transitions: checkboxes.houseTransitions,
					sign_transitions: checkboxes.signTransitions,
					exact_hits: false,
					station_events: false,
					transit_limits: checkboxes.transitLimits,
					precession_correction: checkboxes.precessionCorrection
				};
				await saveTransitSetup(workspacePath, setup);
			}

			const radixComputed = await ensureChartComputed(sourceChart);
			const transitDateTime = range.endDatetime;
			const transitChart: AppChart = {
				...sourceChart,
				id: `${sourceChart.id}__transit__${transitDateTime.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
				name: `${sourceChart.name} ${t('transits_general_transit_transit')}`,
				chartType: 'EVENT',
				dateTime: transitDateTime,
				observableObjects:
					transitingBodies.length > 0 ? transitingBodies : DEFAULT_TRANSIT_BODY_IDS,
				tags: [...(sourceChart.tags ?? []), 'transit']
			};
			const transitResult = await computeChartFromData(
				chartDataToComputePayload(transitChart, workspaceDefaults)
			);
			const transitComputed = normalizeComputedChartPayload(transitResult);
			const computedTransitChart = { ...transitChart, computed: transitComputed };
			const effectiveTransitedBodies =
				transitedBodies.length > 0
					? transitedBodies
					: (sourceChart.observableObjects ?? workspaceDefaults.defaultBodies);
			const sourceChartPayload = chartDataToComputePayload(sourceChart, workspaceDefaults);
			const crossAspects = await computeCrossAspectsFromData(
				sourceChartPayload,
				positionsForIds(transitComputed.positions ?? {}, transitingBodies),
				positionsForIds(radixComputed.positions ?? {}, effectiveTransitedBodies),
				selectedAspects
			);
			const overlay = {
				sourceChartId: sourceChart.id,
				sourceChartName: sourceChart.name,
				dateTime: transitDateTime,
				transitChart: computedTransitChart,
				transitingBodies,
				transitedBodies: effectiveTransitedBodies,
				aspectTypes: selectedAspects,
				aspects: crossAspects
			};
			setTransitOverlay(overlay);
			setSelectedChartId(sourceChart.id);

			const singleEntry: TransitSeriesEntry = {
				datetime: transitDateTime,
				transit_positions: transitComputed.positions,
				aspects: crossAspects
			};

			try {
				// With a workspace open, use the disk-backed command (persists/reuses saved setup
				// state); without one, compute straight from the in-memory chart data — same split as
				// computeChart vs computeChartFromData elsewhere in this file.
				const result = workspacePath
					? await computeTransitSeries({
							workspacePath,
							chartId: effectiveSourceChartId,
							startDatetime: range.startDatetime,
							endDatetime: range.endDatetime,
							timeStepSeconds,
							transitingObjects: transitingBodies,
							transitedObjects: effectiveTransitedBodies,
							aspectTypes: selectedAspects
						})
					: await computeTransitSeriesFromData({
							chartJson: sourceChartPayload,
							startDatetime: range.startDatetime,
							endDatetime: range.endDatetime,
							timeStepSeconds,
							transitingObjects: transitingBodies,
							transitedObjects: effectiveTransitedBodies,
							aspectTypes: selectedAspects
						});

				// Treat a present-but-empty array the same as a missing one — either way there's
				// nothing to show except the snapshot already computed above for the overlay.
				const rawResults = result.results ?? [];
				const results = rawResults.length > 0 ? rawResults : [singleEntry];
				setTransitSeries(results);
				const warnings = [...(result.warnings ?? [])];
				if (result.fallback_used) {
					warnings.push(
						`Fell back to the ${result.backend_used ?? 'alternate'} backend after the primary one failed.`
					);
				}
				// A custom range expecting multiple samples that still came back with just one (or
				// none) is a strong signal the series call silently degraded — surface it instead of
				// letting a single-point result pass as a normal, if short, computation.
				if (periodModeId === 'custom' && estimatedSampleCount > 1 && rawResults.length <= 1) {
					warnings.push(
						`Expected ~${estimatedSampleCount} samples over the selected period but received only ${rawResults.length}. The backend may have rejected the request and returned a single snapshot instead.`
					);
				}
				setTransitWarnings(warnings);
			} catch (seriesErr) {
				console.error('Failed to compute transit series:', seriesErr);
				setTransitSeries([singleEntry]);
				setTransitError(
					seriesErr instanceof Error
						? seriesErr.message
						: 'Transit series failed; showing the end timestamp overlay.'
				);
			}
		} catch (err) {
			console.error('Failed to compute transits:', err);
			setTransitError(err instanceof Error ? err.message : 'Transit computation failed.');
		} finally {
			setTransitLoading(false);
		}
	};

	const reset = () => {
		setTransitSeries([]);
		setTransitError(null);
		setTransitWarnings([]);
		setSelectedTransitedObjectId(null);
		setResultsViewMode('chart');
		setForceSetupView(false);
		clearTransitOverlay();
	};

	const editSetup = () => setForceSetupView(true);

	const value: TransitsWorkspaceValue = {
		mode: transitSeries.length > 0 && !forceSetupView ? 'results' : 'setup',
		editSetup,
		selectedTypeId,
		setSelectedTypeId,
		periodModeId,
		setPeriodModeId,
		checkboxes,
		setCheckboxes,
		sourceChartId,
		setSourceChartId,
		effectiveSourceChartId,
		fromDateTime,
		setFromDateTime,
		toDateTime,
		setToDateTime,
		transitingBodies,
		setTransitingBodies,
		transitedBodies,
		setTransitedBodies,
		selectedAspects,
		setSelectedAspects,
		timeStepValue,
		setTimeStepValue,
		timeStepUnit,
		setTimeStepUnit,
		timeStepSeconds,
		estimatedSampleCount,
		transitLoading,
		transitError,
		transitWarnings,
		transitSeries,
		transitResultsCountLabel,
		transitingBodyIdsInSeries,
		fixedChartPositions,
		aspectTimelineCategories,
		aspectTimelineSeries,
		handleComputeTransits,
		reset,
		selectedTransitedObjectId,
		setSelectedTransitedObjectId,
		resultsViewMode,
		setResultsViewMode
	};

	return (
		<TransitsWorkspaceContext.Provider value={value}>{children}</TransitsWorkspaceContext.Provider>
	);
}

export function useTransitsWorkspace(): TransitsWorkspaceValue {
	const ctx = useContext(TransitsWorkspaceContext);
	if (!ctx) {
		throw new Error('useTransitsWorkspace must be used within TransitsWorkspaceProvider');
	}
	return ctx;
}
