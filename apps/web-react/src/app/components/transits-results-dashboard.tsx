import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnDef,
	type SortingState
} from '@tanstack/react-table';
import type { AspectExactHit, AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import type { ConfigurationMatch, TransitEvent } from '@/lib/tauri/types';
import { positionWithinSign } from '@/lib/astrology/objectDetail';
import { objectIcon, objectLabel, aspectLabel } from '@/lib/astrology/objectLabels';
import { isPersonalPlanetId } from '@/lib/astrology/observableObjects';
import { ASPECT_GLYPHS, DEFAULT_ASPECT_COLORS } from '@/lib/astrology/aspects';
import { formatSignedDms } from '@/lib/astrology/dms';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ModeSwitcher } from './ui/mode-switcher';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
	TransitResonanceChart,
	type TransitResonanceMarker
} from './transit-resonance-chart';
import { TransitMicroTicker } from './transit-micro-ticker';
import { cn } from './ui/utils';
import { useAppFormFieldTheme, type AppFormFieldTheme } from './form-field-theme';
import {
	humanizePeriodPresetId,
	useTransitsWorkspace,
	type TimeStepUnit
} from '../providers/transits-workspace';
import { CycleAnalysisPanel } from './cycle-analysis-panel';
import { DetailSidePanel } from './detail-side-panel';
import type { Theme } from './astrology-sidebar';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';

interface TransitsResultsDashboardProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	workspaceDefaults: WorkspaceDefaultsState;
}

/** Preset X-axis window spans (TR-02) — approximate months/years as fixed day counts, matching
 *  how a "zoom level" button is meant to read (a round window), not a calendar-exact span. */
const X_ZOOM_PRESET_MS: Record<'day' | 'week' | 'month' | 'year', number> = {
	day: 24 * 60 * 60 * 1000,
	week: 7 * 24 * 60 * 60 * 1000,
	month: 30 * 24 * 60 * 60 * 1000,
	year: 365 * 24 * 60 * 60 * 1000
};

type HitRow = { series: AspectTimelineSeries; hit: AspectExactHit };

function pairGlyphLabel(series: AspectTimelineSeries, t: (key: string) => string): string {
	return `${objectLabel(series.from, t)} ${aspectLabel(series.aspectType, t)} ${objectLabel(series.to, t)}`;
}

/** First and last index of each contiguous non-null run — the chart-window entry/exit instants. */
function runBoundaries(values: Array<number | null>): Array<{ start: number; end: number }> {
	const runs: Array<{ start: number; end: number }> = [];
	let start: number | null = null;
	for (let i = 0; i < values.length; i += 1) {
		if (values[i] !== null) {
			if (start === null) start = i;
		} else if (start !== null) {
			runs.push({ start, end: i - 1 });
			start = null;
		}
	}
	if (start !== null) runs.push({ start, end: values.length - 1 });
	return runs;
}

function buildHitColumns(
	glyphSet: AstrologyGlyphSetId,
	ft: AppFormFieldTheme,
	t: (key: string, options?: Record<string, unknown>) => string
): ColumnDef<HitRow>[] {
	return [
		{
			id: 'date',
			accessorFn: (row) => row.hit.timestampMs,
			header: t('aspect_timeline_col_date', { defaultValue: 'Date' }),
			cell: ({ getValue }) => (
				<div className={cn('whitespace-nowrap', ft.bodyText)}>
					{new Date(getValue<number>()).toLocaleDateString()}
				</div>
			)
		},
		{
			id: 'time',
			accessorFn: (row) => row.hit.timestampMs,
			header: t('aspect_timeline_col_time', { defaultValue: 'Time' }),
			cell: ({ getValue }) => (
				<div className={cn('whitespace-nowrap', ft.bodyText)}>
					{new Date(getValue<number>()).toLocaleTimeString()}
				</div>
			)
		},
		{
			id: 'aspect',
			enableSorting: false,
			header: t('aspect_timeline_col_aspect', { defaultValue: 'Aspect' }),
			cell: ({ row }) => {
				const { series: s, hit } = row.original;
				return (
					<span className="inline-flex items-center gap-1">
						<AstrologyGlyph glyphId={s.from} glyphSet={glyphSet} fallback={objectIcon(s.from)} size={14} />
						<AstrologyGlyph
							glyphId={s.aspectType}
							glyphSet={glyphSet}
							domain="aspect"
							fallback={ASPECT_GLYPHS[s.aspectType] ?? '•'}
							size={14}
						/>
						<AstrologyGlyph glyphId={s.to} glyphSet={glyphSet} fallback={objectIcon(s.to)} size={14} />
						{hit.hitCount > 1 && (
							<span className={cn('tabular-nums', ft.muted)}>
								({hit.hitNumber}/{hit.hitCount})
							</span>
						)}
					</span>
				);
			}
		},
		{
			id: 'transiting',
			enableSorting: false,
			header: t('aspect_timeline_col_transiting', { defaultValue: 'Transiting' }),
			cell: ({ row }) => {
				const pos = positionWithinSign(row.original.hit.fromLongitude);
				return (
					<span className={cn('inline-flex items-center gap-1 tabular-nums whitespace-nowrap', ft.bodyText)}>
						{pos.degrees}
						<AstrologyGlyph
							glyphId={pos.signZodiacId}
							glyphSet={glyphSet}
							domain="zodiac"
							fallback={pos.signGlyphFallback}
							size={13}
						/>
						{pos.minutes}'{pos.seconds}"
					</span>
				);
			}
		},
		{
			id: 'natal',
			enableSorting: false,
			header: t('aspect_timeline_col_natal', { defaultValue: 'Natal' }),
			cell: ({ row }) => {
				const pos = positionWithinSign(row.original.hit.toLongitude);
				return (
					<span className={cn('inline-flex items-center gap-1 tabular-nums whitespace-nowrap', ft.bodyText)}>
						{pos.degrees}
						<AstrologyGlyph
							glyphId={pos.signZodiacId}
							glyphSet={glyphSet}
							domain="zodiac"
							fallback={pos.signGlyphFallback}
							size={13}
						/>
						{pos.minutes}'{pos.seconds}"
					</span>
				);
			}
		},
		{
			id: 'speed',
			accessorFn: (row) => row.hit.fromSpeed ?? 0,
			header: t('aspect_timeline_col_speed', { defaultValue: 'Speed' }),
			cell: ({ row }) => {
				const { hit } = row.original;
				return (
					<span className={cn('tabular-nums whitespace-nowrap', ft.bodyText)}>
						{hit.fromSpeed === undefined ? '—' : formatSignedDms(hit.fromSpeed)}
						{hit.fromRetrograde && (
							<span className={cn('ml-1 text-[10px]', ft.muted)}>
								{t('aspect_timeline_retrograde_tag', { defaultValue: 'R' })}
							</span>
						)}
					</span>
				);
			}
		}
	];
}

/** Chronological list for `event_search` (`exactHits`/`stationEvents`) — real root-found
 *  instants from `compute_transit_events`, kept visually and semantically separate from the
 *  sample-derived "Exact hits" table above (`hitRows`/`buildAspectTimelines`), which approximates
 *  an exact time from the nearest graph sample rather than solving for it. */
function EventSearchPanel({
	ft,
	glyphSet,
	t
}: {
	ft: AppFormFieldTheme;
	glyphSet: AstrologyGlyphSetId;
	t: (key: string, options?: Record<string, unknown>) => string;
}) {
	const { transitEventSearch, openChartAtInstant } = useTransitsWorkspace();
	const { events, complete, warnings } = transitEventSearch;

	if (events.length === 0 && complete && warnings.length === 0) return null;

	return (
		<div className="shrink-0 border-t border-[color:var(--theme-panel-border)] p-4">
			<h3 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', ft.bodyText)}>
				{t('transits_event_search_title', { defaultValue: 'Exact events' })}
			</h3>

			{!complete && (
				<div className="mb-2 space-y-1">
					<p className="text-destructive text-xs">
						{t('transits_event_search_complete_false', {
							defaultValue:
								'One or more searches could not complete — the events below may be partial.'
						})}
					</p>
					{warnings.map((warning, index) => (
						<p key={index} className={cn('text-xs', ft.muted)}>
							{warning}
						</p>
					))}
				</div>
			)}

			{events.length === 0 ? (
				<p className={cn('text-xs', ft.muted)}>
					{t('transits_event_search_empty', {
						defaultValue: 'No exact events found in the selected interval.'
					})}
				</p>
			) : (
				<ul className="max-h-48 space-y-1 overflow-auto">
					{events.map((event: TransitEvent, index) => {
						const when = new Date(event.datetime);
						const whenLabel = Number.isNaN(when.getTime())
							? event.datetime
							: `${when.toLocaleDateString()} ${when.toLocaleTimeString()}`;
						const motionBadge = (bodyId: string) => {
							const motion = event.motion?.[bodyId];
							if (!motion) return null;
							return (
								<span className={cn('ml-1 text-[10px]', ft.muted)}>
									({formatSignedDms(motion.speed)}
									{motion.retrograde
										? ` ${t('transits_event_search_retrograde', { defaultValue: 'retrograde' })}`
										: ''}
									)
								</span>
							);
						};
						const tangential =
							event.kind === 'aspect_hit'
								? event.contact === 'tangential'
								: event.direction_change === 'tangential_no_change';
						// `confirmed` is independent of `tangential`: it is always
						// `true` for a genuine crossing/direction-change, and only
						// meaningfully `false` for a tangential candidate whose
						// refinement didn't actually converge within tolerance (or
						// regressed) -- a heuristic, unverified near-miss that must
						// stay visibly distinct from a confirmed event, never
						// silently rendered the same way.
						const unconfirmed = tangential && !event.confirmed;
						return (
							<li
								key={index}
								className={cn('flex flex-wrap items-center gap-2 rounded px-2 py-1 text-xs', ft.bodyText)}
							>
								<span className="tabular-nums whitespace-nowrap">{whenLabel}</span>
								{event.kind === 'aspect_hit' ? (
									<>
										<span className="inline-flex items-center gap-1">
											<AstrologyGlyph
												glyphId={event.from}
												glyphSet={glyphSet}
												fallback={objectIcon(event.from)}
												size={14}
											/>
											<AstrologyGlyph
												glyphId={event.type}
												glyphSet={glyphSet}
												domain="aspect"
												fallback={ASPECT_GLYPHS[event.type] ?? '•'}
												size={14}
											/>
											<AstrologyGlyph
												glyphId={event.to}
												glyphSet={glyphSet}
												fallback={objectIcon(event.to)}
												size={14}
											/>
										</span>
										<span className={cn('whitespace-nowrap', ft.muted)}>
											{t('transits_event_search_exact_angle', { defaultValue: 'Exact angle' })}:{' '}
											{event.exact_angle}°
										</span>
										{motionBadge(event.from)}
									</>
								) : (
									<>
										<span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', ft.muted)}>
											{t('transits_event_search_kind_station', { defaultValue: 'Station' })}
										</span>
										<span className="inline-flex items-center gap-1">
											<AstrologyGlyph
												glyphId={event.body}
												glyphSet={glyphSet}
												fallback={objectIcon(event.body)}
												size={14}
											/>
											{objectLabel(event.body, t)}
										</span>
										{motionBadge(event.body)}
									</>
								)}
								{tangential && (
									<span className={cn('rounded px-1 py-0.5 text-[10px]', ft.muted)}>
										{t('transits_event_search_tangential', { defaultValue: 'tangential' })}
									</span>
								)}
								{unconfirmed && (
									<span
										className="rounded px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
										title={t('transits_event_search_unconfirmed_hint', {
											defaultValue:
												'Refinement did not converge within tolerance -- a heuristic candidate, not a verified event.',
										})}
									>
										{t('transits_event_search_unconfirmed', { defaultValue: 'unconfirmed' })}
									</span>
								)}
								<Button
									type="button"
									variant="ghost"
									className={cn('ml-auto h-6 px-2 text-[10px]', ft.bodyText)}
									onClick={() => void openChartAtInstant(event.datetime)}
								>
									{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
								</Button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

/** Chronological(-ish; grouped by pattern) list for `configuration_matches` — multi-body
 *  configuration intervals (Grand Trine/T-square/Yod/Grand Cross), shown as entry/best-fit/exit
 *  with clipped-boundary labels, kept separate from the exact-event list above. */
function ConfigurationMatchesPanel({
	ft,
	glyphSet,
	t
}: {
	ft: AppFormFieldTheme;
	glyphSet: AstrologyGlyphSetId;
	t: (key: string, options?: Record<string, unknown>) => string;
}) {
	const { transitEventSearch, openChartAtInstant } = useTransitsWorkspace();
	const { configuration_matches: matches } = transitEventSearch;

	if (matches.length === 0) return null;

	const formatInstant = (iso: string | null): string => {
		if (!iso) return '—';
		const when = new Date(iso);
		return Number.isNaN(when.getTime()) ? iso : `${when.toLocaleDateString()} ${when.toLocaleTimeString()}`;
	};

	const clippedLabel = (reason: string | null): string | null => {
		if (reason === 'period_start') {
			return t('transits_configuration_clipped_period_start', { defaultValue: 'clipped: period start' });
		}
		if (reason === 'period_end') {
			return t('transits_configuration_clipped_period_end', { defaultValue: 'clipped: period end' });
		}
		if (reason === 'missing_coverage') {
			return t('transits_configuration_clipped_missing_coverage', {
				defaultValue: 'clipped: missing coverage'
			});
		}
		return null;
	};

	return (
		<div className="shrink-0 border-t border-[color:var(--theme-panel-border)] p-4">
			<h3 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', ft.bodyText)}>
				{t('transits_configuration_matches_title', { defaultValue: 'Multi-body configurations' })}
			</h3>
			<ul className="max-h-64 space-y-2 overflow-auto">
				{matches.map((match: ConfigurationMatch, index) => {
					const entryClipped = clippedLabel(match.entry_clipped);
					const exitClipped = clippedLabel(match.exit_clipped);
					return (
						<li
							key={index}
							className={cn('rounded border p-2 text-xs', ft.bodyText, ft.footerBorder)}
						>
							<div className="mb-1 flex flex-wrap items-center gap-2">
								<span className="font-medium">
									{t(`transits_configuration_${match.configuration_id}`, {
										defaultValue: match.configuration_id
									})}
								</span>
								<span className="inline-flex items-center gap-1">
									{match.participants.map((participant) => (
										<AstrologyGlyph
											key={participant.role}
											glyphId={participant.body_id}
											glyphSet={glyphSet}
											fallback={objectIcon(participant.body_id)}
											size={14}
										/>
									))}
								</span>
								<span className={cn('text-[10px]', ft.muted)}>
									{match.participants
										.map((p) => `${p.role}=${objectLabel(p.body_id, t)}${p.is_fixed ? ' (fixed)' : ''}`)
										.join(', ')}
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<span className="tabular-nums whitespace-nowrap">
									{t('transits_configuration_entry', { defaultValue: 'Entry' })}:{' '}
									{formatInstant(match.entry)}
									{entryClipped && <span className={cn('ml-1 text-[10px]', ft.muted)}>({entryClipped})</span>}
								</span>
								{match.entry && (
									<Button
										type="button"
										variant="ghost"
										className={cn('h-6 px-2 text-[10px]', ft.bodyText)}
										onClick={() => void openChartAtInstant(match.entry!)}
									>
										{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
									</Button>
								)}
							</div>
							{match.best_fit && (
								<div className="flex flex-wrap items-center gap-2">
									<span className="tabular-nums whitespace-nowrap">
										{t('transits_configuration_best_fit', { defaultValue: 'Best fit' })}:{' '}
										{formatInstant(match.best_fit.datetime)}
									</span>
									<Button
										type="button"
										variant="ghost"
										className={cn('h-6 px-2 text-[10px]', ft.bodyText)}
										onClick={() => void openChartAtInstant(match.best_fit!.datetime)}
									>
										{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
									</Button>
								</div>
							)}
							<div className="flex flex-wrap items-center gap-2">
								<span className="tabular-nums whitespace-nowrap">
									{t('transits_configuration_exit', { defaultValue: 'Exit' })}:{' '}
									{formatInstant(match.exit)}
									{exitClipped && <span className={cn('ml-1 text-[10px]', ft.muted)}>({exitClipped})</span>}
								</span>
								{match.exit && (
									<Button
										type="button"
										variant="ghost"
										className={cn('h-6 px-2 text-[10px]', ft.bodyText)}
										onClick={() => void openChartAtInstant(match.exit!)}
									>
										{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
									</Button>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function TransitsResultsDashboard({
	theme,
	glyphSet,
	workspaceDefaults
}: TransitsResultsDashboardProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const {
		transitSeries,
		aspectTimelineCategories: categories,
		aspectTimelineSeries: series,
		periodModeId,
		fromDateTime,
		toDateTime,
		timeStepValue,
		setTimeStepValue,
		timeStepUnit,
		setTimeStepUnit,
		sampledGraphOutput,
		resultsViewMode,
		setResultsViewMode,
		hiddenSeriesKeys,
		chartYZoomDegrees,
		setChartYZoomDegrees,
		chartVisibleRange,
		setChartVisibleRange,
		handleComputeTransits,
		transitLoading,
		transitError,
		transitWarnings,
		transitResultsCountLabel,
		reset,
		editSetup,
		openChartAtInstant
	} = useTransitsWorkspace();

	const [highlightedSeriesKey, setHighlightedSeriesKey] = useState<string | null>(null);
	// Clicking an already-highlighted wave opens the detail panel for it (TR-07/TR-10) instead of
	// un-highlighting — closing the panel clears both.
	const [detailSeriesKey, setDetailSeriesKey] = useState<string | null>(null);

	function closeDetailPanel() {
		setDetailSeriesKey(null);
		setHighlightedSeriesKey(null);
	}

	const detailSeries = series.find((s) => s.key === detailSeriesKey) ?? null;

	// What was actually submitted for the series behind these results — "Current" mode computes a
	// single instant by design, so this is the fastest way to tell "correctly one point" apart from
	// "silently degraded from many points to one". Every other period id (a preset or "custom")
	// shows its own label plus the resolved range, rather than mislabeling every preset "Custom".
	const periodLabel = t(`transits_period_${periodModeId}`, {
		defaultValue: humanizePeriodPresetId(periodModeId)
	});
	const periodSummary =
		periodModeId === 'current'
			? periodLabel
			: `${periodLabel}: ${fromDateTime.toLocaleString()} → ${toDateTime.toLocaleString()}`;

	const [pendingTimeStepValue, setPendingTimeStepValue] = useState(String(timeStepValue));
	useEffect(() => setPendingTimeStepValue(String(timeStepValue)), [timeStepValue]);

	function commitTimeStepValue() {
		const next = Number.parseInt(pendingTimeStepValue, 10);
		const resolved = Number.isFinite(next) && next > 0 ? next : timeStepValue;
		setPendingTimeStepValue(String(resolved));
		if (resolved !== timeStepValue) {
			setTimeStepValue(resolved);
			void handleComputeTransits();
		}
	}

	function changeTimeStepUnit(unit: TimeStepUnit) {
		setTimeStepUnit(unit);
		void handleComputeTransits();
	}

	const dataMinMs = categories[0];
	const dataMaxMs = categories[categories.length - 1];

	/** TR-02: jump to a preset window span, anchored at the current view's center (or the series
	 *  end, before any pan/zoom has happened) and clamped to the real computed range. */
	function applyXZoomPreset(preset: keyof typeof X_ZOOM_PRESET_MS) {
		if (dataMinMs === undefined || dataMaxMs === undefined) return;
		const span = Math.min(X_ZOOM_PRESET_MS[preset], dataMaxMs - dataMinMs || X_ZOOM_PRESET_MS[preset]);
		const center = chartVisibleRange
			? (chartVisibleRange[0] + chartVisibleRange[1]) / 2
			: dataMaxMs;
		let start = center - span / 2;
		let end = center + span / 2;
		if (start < dataMinMs) {
			start = dataMinMs;
			end = start + span;
		}
		if (end > dataMaxMs) {
			end = dataMaxMs;
			start = end - span;
		}
		setChartVisibleRange([start, end]);
	}

	const visibleSeries = useMemo(
		() => series.filter((s) => !hiddenSeriesKeys.has(s.key)),
		[series, hiddenSeriesKeys]
	);

	/** Fast "personal planet" transiting bodies (Sun/Moon/Mercury/Venus/Mars) produce many brief,
	 *  narrow waves that clutter the main chart next to the slower outer/social planets' sustained
	 *  curves — those go to the micro ticker (TR-08) instead; everything else stays on the chart. */
	const waveSeries = useMemo(
		() => visibleSeries.filter((s) => !isPersonalPlanetId(s.from)),
		[visibleSeries]
	);
	const tickerSeries = useMemo(
		() => visibleSeries.filter((s) => isPersonalPlanetId(s.from)),
		[visibleSeries]
	);

	/** By aspect type, not an arbitrary index rotation — so a wave's color is the same aspect
	 *  color used everywhere else in the app (aspectarium, radix wheel), and any number of
	 *  simultaneously-visible waves (the layers panel has no cap) stay visually consistent. Built
	 *  over every visible series (not just `waveSeries`) so the micro ticker can reuse the same map. */
	const colorByKey = useMemo(() => {
		const map = new Map<string, string>();
		for (const s of visibleSeries) {
			map.set(
				s.key,
				workspaceDefaults.defaultAspectColors[s.aspectType] ??
					DEFAULT_ASPECT_COLORS[s.aspectType] ??
					'var(--theme-accent)'
			);
		}
		return map;
	}, [visibleSeries, workspaceDefaults.defaultAspectColors]);

	/** Raw orb (degrees), clipped to the current Y-zoom window — null beyond it, same as out of orb. */
	const values = useMemo(() => {
		const result: Record<string, Array<number | null>> = {};
		for (const s of waveSeries) {
			result[s.key] = s.orb.map((degrees) =>
				degrees === null || degrees > chartYZoomDegrees ? null : degrees
			);
		}
		return result;
	}, [waveSeries]);

	const markers = useMemo<TransitResonanceMarker[]>(() => {
		const list: TransitResonanceMarker[] = [];
		const seen = new Set<string>();
		for (const s of waveSeries) {
			const clipped = values[s.key] ?? [];
			for (const hit of s.hits) {
				if (clipped[hit.sampleIndex] === null) continue;
				seen.add(`${s.key}-${hit.sampleIndex}`);
				list.push({
					seriesId: s.key,
					index: hit.sampleIndex,
					kind: 'hit',
					title: t('aspect_timeline_hit_title', {
						defaultValue: 'Exact {{pair}}',
						pair: pairGlyphLabel(s, t)
					})
				});
			}
			for (const run of runBoundaries(clipped)) {
				if (run.start !== run.end) {
					if (!seen.has(`${s.key}-${run.start}`)) list.push({ seriesId: s.key, index: run.start, kind: 'entry' });
					if (!seen.has(`${s.key}-${run.end}`)) list.push({ seriesId: s.key, index: run.end, kind: 'exit' });
				}
			}
		}
		return list;
	}, [waveSeries, values, t]);

	const tooltipExtra = (seriesId: string, index: number): string | null => {
		const phase = visibleSeries.find((s) => s.key === seriesId)?.phase[index];
		if (!phase) return null;
		return phase === 'applying'
			? t('aspect_timeline_applying', { defaultValue: 'Applying' })
			: t('aspect_timeline_separating', { defaultValue: 'Separating' });
	};

	const hitRows = useMemo<HitRow[]>(() => {
		const rows = visibleSeries.flatMap((s) => s.hits.map((hit) => ({ series: s, hit })));
		rows.sort((a, b) => a.hit.timestampMs - b.hit.timestampMs);
		return rows;
	}, [visibleSeries]);

	const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: false }]);
	const columns = useMemo(() => buildHitColumns(glyphSet, ft, t), [glyphSet, ft, t]);
	const table = useReactTable({
		data: hitRows,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
					'border-[color:var(--theme-panel-border)]'
				)}
			>
				<ModeSwitcher
					value={resultsViewMode}
					onValueChange={(value) => setResultsViewMode(value as 'chart' | 'table')}
					ariaLabel={t('aspect_timeline_axis_closeness', { defaultValue: 'Orb to exact' })}
					options={[
						{ value: 'chart', label: t('transits_resonance_view', { defaultValue: 'Resonance' }) },
						{ value: 'table', label: t('aspect_timeline_hits_view', { defaultValue: 'Exact hits' }) }
					]}
				/>

				{resultsViewMode === 'chart' && (
					<div className="flex items-center gap-1">
						{(Object.keys(X_ZOOM_PRESET_MS) as Array<keyof typeof X_ZOOM_PRESET_MS>).map((preset) => (
							<Button
								key={preset}
								type="button"
								variant="ghost"
								className={cn('h-8 px-2.5 text-xs', ft.bodyText)}
								onClick={() => applyXZoomPreset(preset)}
							>
								{t(`transits_zoom_${preset}`, {
									defaultValue: preset.charAt(0).toUpperCase() + preset.slice(1)
								})}
							</Button>
						))}
						{chartVisibleRange && (
							<Button
								type="button"
								variant="ghost"
								className={cn('h-8 px-2.5 text-xs', ft.bodyText)}
								onClick={() => setChartVisibleRange(null)}
							>
								{t('transits_zoom_full_range', { defaultValue: 'Full range' })}
							</Button>
						)}
					</div>
				)}

				{resultsViewMode === 'chart' && (
					<div className="flex items-center gap-1.5">
						<span className={cn('text-xs', ft.muted)}>
							{t('transits_y_zoom_label', { defaultValue: 'Orb scale' })}
						</span>
						<Button
							type="button"
							variant="ghost"
							className={cn('h-8 w-8 px-0 text-xs', ft.bodyText)}
							onClick={() => setChartYZoomDegrees(chartYZoomDegrees - 0.1)}
						>
							−
						</Button>
						<Input
							type="number"
							min={0.5}
							max={6}
							step={0.1}
							value={chartYZoomDegrees}
							onChange={(event) => {
								const n = Number(event.target.value);
								if (Number.isFinite(n)) setChartYZoomDegrees(n);
							}}
							className={cn(ft.inputCompact, 'h-8 w-16 text-xs shadow-inner')}
						/>
						<Button
							type="button"
							variant="ghost"
							className={cn('h-8 w-8 px-0 text-xs', ft.bodyText)}
							onClick={() => setChartYZoomDegrees(chartYZoomDegrees + 0.1)}
						>
							+
						</Button>
					</div>
				)}

				<span className={cn('text-xs tabular-nums', ft.muted)}>
					{transitResultsCountLabel} · {periodSummary}
				</span>

				<div className="flex items-center gap-2">
					<span className={cn('text-xs', ft.muted)}>
						{t('transits_label_graph_sampling_interval', { defaultValue: 'Graph sampling interval' })}
					</span>
					<Input
						type="number"
						min={1}
						step={1}
						value={pendingTimeStepValue}
						onChange={(event) => setPendingTimeStepValue(event.target.value)}
						onBlur={commitTimeStepValue}
						onKeyDown={(event) => {
							if (event.key === 'Enter') commitTimeStepValue();
						}}
						disabled={!sampledGraphOutput}
						className={cn(
							ft.input,
							'h-8 w-16 py-1 text-xs shadow-inner',
							!sampledGraphOutput && ft.inputDisabled
						)}
					/>
					<Select
						value={timeStepUnit}
						onValueChange={(value) => changeTimeStepUnit(value as TimeStepUnit)}
						disabled={!sampledGraphOutput}
					>
						<SelectTrigger
							className={cn(
								ft.selectTrigger,
								'h-8 w-28 text-xs shadow-inner',
								!sampledGraphOutput && ft.inputDisabled
							)}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={ft.selectContent}>
							<SelectItem value="seconds" className={ft.selectItem}>
								{t('transits_granularity_seconds', { defaultValue: 'Seconds' })}
							</SelectItem>
							<SelectItem value="minutes" className={ft.selectItem}>
								{t('transits_granularity_minutes', { defaultValue: 'Minutes' })}
							</SelectItem>
							<SelectItem value="hours" className={ft.selectItem}>
								{t('transits_granularity_hours', { defaultValue: 'Hours' })}
							</SelectItem>
							<SelectItem value="days" className={ft.selectItem}>
								{t('transits_granularity_days', { defaultValue: 'Days' })}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						className={cn('h-8 px-3 text-xs', ft.bodyText)}
						onClick={editSetup}
					>
						{t('transits_edit_setup', { defaultValue: 'Edit setup' })}
					</Button>
					<Button type="button" variant="ghost" className={cn('h-8 px-3 text-xs', ft.bodyText)} onClick={reset}>
						{t('transits_reset', { defaultValue: 'Reset' })}
					</Button>
				</div>
			</div>

			{(transitError || transitWarnings.length > 0) && (
				<div className="space-y-1 border-b border-[color:var(--theme-panel-border)] px-4 py-2">
					{transitError && <p className="text-destructive text-xs">{transitError}</p>}
					{transitWarnings.map((warning, index) => (
						<p key={index} className={cn('text-xs', ft.muted)}>
							{warning}
						</p>
					))}
				</div>
			)}

			<div className="flex min-h-0 flex-1">
				<div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
					{resultsViewMode === 'chart' && (
						<p
							className={cn(
								'mb-4 shrink-0 rounded-lg border p-3 text-xs',
								ft.muted,
								ft.footerBorder
							)}
						>
							{t('aspect_timeline_mapping_note', {
								defaultValue:
									'Display mapping: the y-axis is the raw angular deviation from exact, in degrees, capped at a {{degrees}}° window — 0° at exact alignment, {{degrees}}° at the edge of what\'s shown. A wider configured orb only becomes visible once it closes to within range. Scroll to zoom, drag to pan.',
								degrees: chartYZoomDegrees
							})}
						</p>
					)}

					{visibleSeries.length === 0 ? (
						<p className={cn('py-10 text-center text-sm', ft.muted)}>
							{transitLoading
								? t('transit_loading')
								: !sampledGraphOutput
									? t('transits_sampled_graph_output_disabled_note', {
											defaultValue:
												'Sampled graph output is off — see Exact events / Multi-body configurations below.'
										})
									: t('aspect_timeline_no_pairs', {
											defaultValue: 'No aspects were detected within orb across this series.'
										})}
						</p>
					) : resultsViewMode === 'chart' ? (
						<div className="flex min-h-[28rem] flex-1 flex-col gap-3">
							<div className="min-h-0 flex-1">
								<TransitResonanceChart
									categories={categories}
									series={waveSeries.map((s) => ({
										id: s.key,
										label: pairGlyphLabel(s, t),
										color: colorByKey.get(s.key) ?? 'var(--theme-accent)'
									}))}
									values={values}
									markers={markers}
									tooltipExtra={tooltipExtra}
									yMaxDegrees={chartYZoomDegrees}
									visibleRange={chartVisibleRange}
									onVisibleRangeChange={setChartVisibleRange}
									highlightedKey={highlightedSeriesKey}
									onHighlightChange={setHighlightedSeriesKey}
									onActivate={setDetailSeriesKey}
									formatX={(x) => new Date(x).toLocaleString()}
									ariaLabel={t('aspect_timeline_subtitle', { defaultValue: 'Aspect timeline' })}
								/>
							</div>
							{tickerSeries.length > 0 && (
								<TransitMicroTicker
									categories={categories}
									series={tickerSeries}
									colorByKey={colorByKey}
									visibleRange={chartVisibleRange}
									onTickClick={setDetailSeriesKey}
								/>
							)}
						</div>
					) : (
						<div className="max-h-[32rem] overflow-auto rounded-md border">
							<Table>
								<TableHeader>
									{table.getHeaderGroups().map((headerGroup) => (
										<TableRow
											key={headerGroup.id}
											className="border-[color:var(--theme-panel-border)] hover:bg-transparent"
										>
											{headerGroup.headers.map((header) => {
												const sortState = header.column.getIsSorted();
												const SortIcon =
													sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;
												return (
													<TableHead
														key={header.id}
														className={cn(
															'bg-background sticky top-0 z-10 text-xs font-semibold',
															ft.bodyText
														)}
													>
														{header.isPlaceholder ? null : header.column.getCanSort() ? (
															<button
																type="button"
																className="inline-flex items-center gap-1"
																onClick={header.column.getToggleSortingHandler()}
															>
																{flexRender(header.column.columnDef.header, header.getContext())}
																<SortIcon
																	className={cn('size-3', sortState ? 'opacity-100' : 'opacity-40')}
																/>
															</button>
														) : (
															flexRender(header.column.columnDef.header, header.getContext())
														)}
													</TableHead>
												);
											})}
										</TableRow>
									))}
								</TableHeader>
								<TableBody>
									{table.getRowModel().rows.map((row) => (
										<TableRow key={row.id} className="border-b-0 hover:bg-accent/50">
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id} className="text-xs">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
							{hitRows.length === 0 && (
								<p className={cn('p-4 text-center text-xs', ft.muted)}>
									{t('aspect_timeline_no_hits', {
										defaultValue: 'No exact hits within this period for the selected pairs.'
									})}
								</p>
							)}
						</div>
					)}
				</div>

				<CycleAnalysisPanel
					theme={theme}
					glyphSet={glyphSet}
					series={visibleSeries}
					entries={transitSeries}
					colorByKey={colorByKey}
				/>
			</div>

			<EventSearchPanel ft={ft} glyphSet={glyphSet} t={t} />
			<ConfigurationMatchesPanel ft={ft} glyphSet={glyphSet} t={t} />

			<DetailSidePanel
				theme={theme}
				open={detailSeriesKey !== null}
				onOpenChange={(open) => {
					if (!open) closeDetailPanel();
				}}
				title={detailSeries ? pairGlyphLabel(detailSeries, t) : ''}
				description={
					detailSeries
						? `${objectLabel(detailSeries.from, t)} ${aspectLabel(detailSeries.aspectType, t)} ${objectLabel(detailSeries.to, t)}`
						: undefined
				}
			>
				{detailSeries && (
					<div className="flex flex-col gap-2">
						<p className={cn('text-xs', ft.muted)}>
							{t('transit_detail_hits_title', { defaultValue: 'Exact crossings in this series' })}
						</p>
						{detailSeries.hits.length === 0 ? (
							<p className={cn('text-xs', ft.muted)}>
								{t('transit_detail_hits_empty', {
									defaultValue: 'No exact alignment within this computed period.'
								})}
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{detailSeries.hits.map((hit: AspectExactHit) => (
									<li key={hit.timestampMs}>
										<button
											type="button"
											onClick={() => void openChartAtInstant(new Date(hit.timestampMs).toISOString())}
											className={cn(
												'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
												'hover:bg-[color:var(--theme-soft-bg)]',
												ft.bodyText
											)}
										>
											<span>{new Date(hit.timestampMs).toLocaleString()}</span>
											<span className={cn('tabular-nums', ft.muted)}>
												{hit.hitNumber}/{hit.hitCount}
												{hit.fromRetrograde ? ` · ${t('transits_event_search_retrograde', { defaultValue: 'retrograde' })}` : ''}
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</DetailSidePanel>
		</div>
	);
}
