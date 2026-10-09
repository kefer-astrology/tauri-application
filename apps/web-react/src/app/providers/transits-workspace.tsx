import {
	createContext,
	useCallback,
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
import type {
	ConfigurationSearchRequest,
	TransitEventSearch,
	TransitSeriesEntry,
	TransitSetup
} from '@/lib/tauri/types';
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
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import { KeferLoaderOverlay } from '../components/ui/kefer-loader';

const BROWSER_TRANSIT_BODY_FALLBACK = [
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

/** Rust model defaults are authoritative; this fallback is only for browser mode. */
export function getDefaultTransitBodyIds(): string[] {
	return DOMAIN_CATALOG?.model.settings?.default_bodies?.length
		? [...DOMAIN_CATALOG.model.settings.default_bodies]
		: [...BROWSER_TRANSIT_BODY_FALLBACK];
}

/** Default fixed-anchor selection (the "Transited Bodies" tab): the slow outer planets. A fixed
 *  anchor is picked once and shown in the results sidebar, so it should be something that still
 *  means the same thing across the whole scan — an inner planet's own position would itself be
 *  stale within days, defeating the point of pinning it. The Transited Bodies tab still lets
 *  anyone add other objects back in; this is only the starting selection, not a restriction. */
export const DEFAULT_FIXED_ANCHOR_BODY_IDS = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** Period preset ids (general transit setup's period `<Select>`), in display order. `current`/
 *  `custom` keep their existing special handling (single instant / user-edited range) in
 *  `handleComputeTransits`; every other id is a fixed, non-editable `[from, to]` window computed
 *  from "now" at selection time (see `transits-content.tsx`'s `PERIOD_PRESET_RANGES`). Exported
 *  so the results dashboard's period summary can label whichever preset was actually used. */
export const PERIOD_PRESET_IDS = [
	'current',
	'next_3_months',
	'next_6_months',
	'previous_3_months',
	'previous_6_months',
	'next_year',
	'previous_year',
	'custom'
] as const;

export function humanizePeriodPresetId(id: string): string {
	return id.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
	/** Independent of `checkboxes` above — these two are real, enabled controls (not disabled
	 *  placeholders) that trigger an actual adaptive event search; see `exact_hits`/
	 *  `station_events` in the transit-series contract. */
	exactHits: boolean;
	setExactHits: (value: boolean) => void;
	stationEvents: boolean;
	setStationEvents: (value: boolean) => void;
	/** Whether the sampled graph (`transitSeries`) is computed at all — defaults to `true` so
	 *  existing behavior is unchanged. `timeStepSeconds`/"Graph sampling interval" should only be
	 *  shown in the UI while this is on. */
	sampledGraphOutput: boolean;
	setSampledGraphOutput: (value: boolean) => void;
	/** Requested multi-body configuration interval searches (Grand Trine/T-square/Yod/Grand
	 *  Cross) — independent of `sampledGraphOutput`/`timeStepSeconds`. */
	configurationSearches: ConfigurationSearchRequest[];
	setConfigurationSearches: (value: ConfigurationSearchRequest[]) => void;
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
	/** Exact-event search results (`exactHits`/`stationEvents`), kept separate from the sampled
	 *  `transitSeries` above — always present after a compute, a fixed empty/complete shape when
	 *  both flags are off. */
	transitEventSearch: TransitEventSearch;
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
	handleComputeTransits: (overrideRange?: { start: Date; end: Date }) => Promise<void>;
	/** Clears the computed series (returns to the setup screen) without touching the configured
	 *  setup fields, so hitting "Calculate" again reruns with the same selection. */
	reset: () => void;
	/** Jumps the whole transit computation to a single instant (an event's `datetime`, or a
	 *  configuration match's entry/best-fit/exit) and recomputes — reuses the same
	 *  `handleComputeTransits`/overlay flow `periodModeId === 'current'` already goes through,
	 *  rather than a separate code path. */
	openChartAtInstant: (datetime: string) => Promise<void>;

	resultsViewMode: TransitsResultsViewMode;
	setResultsViewMode: (value: TransitsResultsViewMode) => void;

	/** Aspect-timeline series keys (`AspectTimelineSeries.key`) hidden from the resonance chart —
	 *  the left layers panel's checkboxes. Reset (emptied) on every fresh computation so a
	 *  previous series' hidden keys never silently carry over. */
	hiddenSeriesKeys: ReadonlySet<string>;
	toggleSeriesVisibility: (key: string) => void;
	setSeriesGroupVisibility: (keys: string[], visible: boolean) => void;
	/** Resonance chart's Y-axis span in degrees, `[0.5, 6.0]` in `0.1` steps. */
	chartYZoomDegrees: number;
	setChartYZoomDegrees: (value: number) => void;
	/** Resonance chart's visible X window (epoch ms); `null` shows the full computed range. */
	chartVisibleRange: [number, number] | null;
	setChartVisibleRange: (value: [number, number] | null) => void;
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
	const [transitingBodies, setTransitingBodies] = useState<string[]>(getDefaultTransitBodyIds);
	const [transitedBodies, setTransitedBodies] = useState<string[]>(DEFAULT_FIXED_ANCHOR_BODY_IDS);
	const [selectedAspects, setSelectedAspects] = useState<string[]>(DEFAULT_TRANSIT_ASPECT_IDS);
	const [timeStepValue, setTimeStepValue] = useState(1);
	const [timeStepUnit, setTimeStepUnit] = useState<TimeStepUnit>('hours');
	const [exactHits, setExactHits] = useState(false);
	const [stationEvents, setStationEvents] = useState(false);
	const [sampledGraphOutput, setSampledGraphOutput] = useState(true);
	const [configurationSearches, setConfigurationSearches] = useState<ConfigurationSearchRequest[]>(
		[]
	);
	const [transitLoading, setTransitLoading] = useState(false);
	const [transitError, setTransitError] = useState<string | null>(null);
	const [transitWarnings, setTransitWarnings] = useState<string[]>([]);
	const [transitSeries, setTransitSeries] = useState<TransitSeriesEntry[]>([]);
	const [transitEventSearch, setTransitEventSearch] = useState<TransitEventSearch>({
		events: [],
		configuration_matches: [],
		complete: true,
		warnings: []
	});
	const [resultsViewMode, setResultsViewMode] = useState<TransitsResultsViewMode>('chart');
	const [forceSetupView, setForceSetupView] = useState(false);
	const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<ReadonlySet<string>>(() => new Set());
	const [chartYZoomDegrees, setChartYZoomDegreesState] = useState(6);
	const [chartVisibleRange, setChartVisibleRange] = useState<[number, number] | null>(null);

	const toggleSeriesVisibility = useCallback((key: string) => {
		setHiddenSeriesKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	/** Bulk visibility for a group of series keys at once — the layers panel's per-transited-body
	 *  checkbox toggles every series for that body together, not one at a time. */
	const setSeriesGroupVisibility = useCallback((keys: string[], visible: boolean) => {
		setHiddenSeriesKeys((prev) => {
			const next = new Set(prev);
			for (const key of keys) {
				if (visible) next.delete(key);
				else next.add(key);
			}
			return next;
		});
	}, []);

	const setChartYZoomDegrees = useCallback((value: number) => {
		setChartYZoomDegreesState(Math.min(6, Math.max(0.5, Math.round(value * 10) / 10)));
	}, []);

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
				// `?? false`: older saved setups predate these two fields entirely (the Rust side
				// already defaults a missing YAML field to `false` via `#[serde(default)]`), so a
				// loaded `undefined` here must behave the same as an explicit `false`, not crash.
				setExactHits(setup.exact_hits ?? false);
				setStationEvents(setup.station_events ?? false);
				// `?? true`: an older saved setup predates this field entirely and always computed
				// the sampled series unconditionally (the Rust side defaults the same way).
				setSampledGraphOutput(setup.sampled_series ?? true);
				setConfigurationSearches(
					(setup.configuration_requests ?? []).map((entry) => ({
						configurationId: entry.configuration_id as ConfigurationSearchRequest['configurationId'],
						fixedRoles: entry.fixed_roles,
						roleCandidates: entry.role_candidates
					}))
				);
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

	const { categories: aspectTimelineCategories, series: aspectTimelineSeries } = useMemo(() => {
		const result = buildAspectTimelines(transitSeries, transitingBodyIdsInSeries, fixedChartPositions);
		// The resonance chart/layers panel model is "transiting body vs. my selected Transited
		// Bodies" — `compute_chart_aspects` (Rust) also returns mutual aspects *among* the
		// transiting bodies themselves, a different signal (used by exact event search/
		// configuration search) that isn't tied to any selected anchor. Filter those out by the
		// actual `transitedBodies` selection, not `kind`: the default Transiting/Transited lists
		// overlap (e.g. Jupiter/Saturn/.../Pluto appear in both), so a `kind` check based on
		// transiting-set membership alone misclassifies real cross aspects to those overlapping
		// anchors as "mutual" too — `to` is only ever a genuine anchor when it's literally in
		// `transitedBodies`, regardless of whether that id also happens to be swept as transiting.
		const transitedSet = new Set(transitedBodies);
		return { ...result, series: result.series.filter((s) => transitedSet.has(s.to)) };
	}, [transitSeries, transitingBodyIdsInSeries, fixedChartPositions, transitedBodies]);

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

	const handleComputeTransits = async (overrideRange?: { start: Date; end: Date }) => {
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

		const range: { startDatetime: string; endDatetime: string } = overrideRange
			? {
					startDatetime: overrideRange.start.toISOString(),
					endDatetime: overrideRange.end.toISOString()
				}
			: periodModeId === 'current'
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
		setTransitEventSearch({ events: [], configuration_matches: [], complete: true, warnings: [] });
		setResultsViewMode('chart');
		setForceSetupView(false);
		setHiddenSeriesKeys(new Set());
		setChartVisibleRange(null);

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
					exact_hits: exactHits,
					station_events: stationEvents,
					sampled_series: sampledGraphOutput,
					configuration_requests: configurationSearches.map((entry) => ({
						configuration_id: entry.configurationId,
						fixed_roles: entry.fixedRoles ?? [],
						role_candidates: entry.roleCandidates ?? {}
					})),
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
					transitingBodies.length > 0 ? transitingBodies : getDefaultTransitBodyIds(),
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
							aspectTypes: selectedAspects,
							exactHits,
							stationEvents,
							configurationRequests: configurationSearches.map((entry) => ({
								configuration_id: entry.configurationId,
								fixed_roles: entry.fixedRoles ?? [],
								role_candidates: entry.roleCandidates ?? {}
							})),
							sampledSeries: sampledGraphOutput
						})
					: await computeTransitSeriesFromData({
							chartJson: sourceChartPayload,
							startDatetime: range.startDatetime,
							endDatetime: range.endDatetime,
							timeStepSeconds,
							transitingObjects: transitingBodies,
							transitedObjects: effectiveTransitedBodies,
							aspectTypes: selectedAspects,
							exactHits,
							stationEvents,
							configurationRequests: configurationSearches.map((entry) => ({
								configuration_id: entry.configurationId,
								fixed_roles: entry.fixedRoles ?? [],
								role_candidates: entry.roleCandidates ?? {}
							})),
							sampledSeries: sampledGraphOutput
						});

				// Treat a present-but-empty array the same as a missing one — either way there's
				// nothing to show except the snapshot already computed above for the overlay.
				// Only when a sampled series was actually requested: an explicit
				// `sampledGraphOutput: false` must show no sampled points at all, not a
				// synthetic single-entry fallback pretending to be one.
				const rawResults = result.results ?? [];
				const results = !sampledGraphOutput
					? []
					: rawResults.length > 0
						? rawResults
						: [singleEntry];
				setTransitSeries(results);
				setTransitEventSearch(
					result.event_search ?? {
						events: [],
						configuration_matches: [],
						complete: true,
						warnings: []
					}
				);
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
		setTransitEventSearch({ events: [], configuration_matches: [], complete: true, warnings: [] });
		setTransitError(null);
		setTransitWarnings([]);
		setResultsViewMode('chart');
		setForceSetupView(false);
		setHiddenSeriesKeys(new Set());
		setChartVisibleRange(null);
		clearTransitOverlay();
	};

	const editSetup = () => setForceSetupView(true);

	const openChartAtInstant = async (datetime: string) => {
		const instant = new Date(datetime);
		if (Number.isNaN(instant.getTime())) return;
		setPeriodModeId('current');
		setFromDateTime(instant);
		setToDateTime(instant);
		await handleComputeTransits({ start: instant, end: instant });
	};

	const value: TransitsWorkspaceValue = {
		mode: transitSeries.length > 0 && !forceSetupView ? 'results' : 'setup',
		editSetup,
		selectedTypeId,
		setSelectedTypeId,
		periodModeId,
		setPeriodModeId,
		checkboxes,
		setCheckboxes,
		exactHits,
		setExactHits,
		stationEvents,
		setStationEvents,
		sampledGraphOutput,
		setSampledGraphOutput,
		configurationSearches,
		setConfigurationSearches,
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
		transitEventSearch,
		transitResultsCountLabel,
		transitingBodyIdsInSeries,
		fixedChartPositions,
		aspectTimelineCategories,
		aspectTimelineSeries,
		handleComputeTransits,
		reset,
		openChartAtInstant,
		resultsViewMode,
		setResultsViewMode,
		hiddenSeriesKeys,
		toggleSeriesVisibility,
		setSeriesGroupVisibility,
		chartYZoomDegrees,
		setChartYZoomDegrees,
		chartVisibleRange,
		setChartVisibleRange
	};

	return (
		<TransitsWorkspaceContext.Provider value={value}>
			{children}
			<KeferLoaderOverlay active={transitLoading} />
		</TransitsWorkspaceContext.Provider>
	);
}

export function useTransitsWorkspace(): TransitsWorkspaceValue {
	const ctx = useContext(TransitsWorkspaceContext);
	if (!ctx) {
		throw new Error('useTransitsWorkspace must be used within TransitsWorkspaceProvider');
	}
	return ctx;
}
