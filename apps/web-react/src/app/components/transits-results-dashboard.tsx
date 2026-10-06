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
import { positionWithinSign } from '@/lib/astrology/objectDetail';
import { objectIcon, objectLabel, aspectLabel } from '@/lib/astrology/objectLabels';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatSignedDms } from '@/lib/astrology/dms';
import { categoricalPaletteForTheme } from '@/lib/dataviz/categoricalPalette';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ModeSwitcher } from './ui/mode-switcher';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { LineChart, type LineChartMarker } from './ui/line-chart';
import { cn } from './ui/utils';
import { useAppFormFieldTheme, type AppFormFieldTheme } from './form-field-theme';
import { useTransitsWorkspace, type TimeStepUnit } from '../providers/transits-workspace';
import { CycleAnalysisPanel } from './cycle-analysis-panel';
import type { Theme } from './astrology-sidebar';

interface TransitsResultsDashboardProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
}

/** The chart only ever shows the innermost slice of orb — wide configured orbs (e.g. an 8°
 *  trine) simply never appear until they close to within this window. Keeps every aspect type
 *  on one directly comparable, absolute-degree scale instead of each normalized to its own orb. */
const ORB_CHART_MAX_DEGREES = 6;

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

export function TransitsResultsDashboard({ theme, glyphSet }: TransitsResultsDashboardProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const palette = categoricalPaletteForTheme(theme);
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
		resultsViewMode,
		setResultsViewMode,
		selectedTransitedObjectId,
		handleComputeTransits,
		transitLoading,
		transitError,
		transitWarnings,
		transitResultsCountLabel,
		reset,
		editSetup
	} = useTransitsWorkspace();

	// What was actually submitted for the series behind these results — "Current" mode computes a
	// single instant by design, so this is the fastest way to tell "correctly one point" apart from
	// "silently degraded from many points to one".
	const periodSummary =
		periodModeId === 'current'
			? t('transits_period_current', { defaultValue: 'Current' })
			: `${t('transits_period_custom', { defaultValue: 'Custom' })}: ${fromDateTime.toLocaleString()} → ${toDateTime.toLocaleString()}`;

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

	const visibleSeries = useMemo(() => {
		const scoped = selectedTransitedObjectId
			? series.filter((s) => s.to === selectedTransitedObjectId || s.from === selectedTransitedObjectId)
			: series;
		return [...scoped]
			.sort((a, b) => b.hits.length - a.hits.length || a.key.localeCompare(b.key))
			.slice(0, palette.length);
	}, [series, selectedTransitedObjectId, palette.length]);

	const colorByKey = useMemo(() => {
		const map = new Map<string, string>();
		visibleSeries.forEach((s, index) => map.set(s.key, palette[index % palette.length]));
		return map;
	}, [visibleSeries, palette]);

	/** Raw orb (degrees), clipped to the 6° display window — null beyond it, same as out of orb. */
	const values = useMemo(() => {
		const result: Record<string, Array<number | null>> = {};
		for (const s of visibleSeries) {
			result[s.key] = s.orb.map((degrees) =>
				degrees === null || degrees > ORB_CHART_MAX_DEGREES ? null : degrees
			);
		}
		return result;
	}, [visibleSeries]);

	const markers = useMemo<LineChartMarker[]>(() => {
		const list: LineChartMarker[] = [];
		const seen = new Set<string>();
		for (const s of visibleSeries) {
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
	}, [visibleSeries, values, t]);

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
						{ value: 'chart', label: t('transits_folded_chart_view', { defaultValue: 'Chart view' }) },
						{ value: 'table', label: t('aspect_timeline_hits_view', { defaultValue: 'Exact hits' }) }
					]}
				/>

				<span className={cn('text-xs tabular-nums', ft.muted)}>
					{transitResultsCountLabel} · {periodSummary}
				</span>

				<div className="flex items-center gap-2">
					<span className={cn('text-xs', ft.muted)}>
						{t('transits_label_granularity', { defaultValue: 'Granularity' })}
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
						className={cn(ft.input, 'h-8 w-16 py-1 text-xs shadow-inner')}
					/>
					<Select value={timeStepUnit} onValueChange={(value) => changeTimeStepUnit(value as TimeStepUnit)}>
						<SelectTrigger className={cn(ft.selectTrigger, 'h-8 w-28 text-xs shadow-inner')}>
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
					<p
						className={cn(
							'mb-4 shrink-0 rounded-lg border p-3 text-xs',
							ft.muted,
							ft.footerBorder
						)}
					>
						{t('aspect_timeline_mapping_note', {
							defaultValue:
								'Display mapping: the y-axis is the raw angular deviation from exact, in degrees, capped at a 6° window — 0° at exact alignment, 6° at the edge of what\'s shown. A wider configured orb only becomes visible once it closes to within 6°.',
							degrees: ORB_CHART_MAX_DEGREES
						})}
					</p>

					{visibleSeries.length === 0 ? (
						<p className={cn('py-10 text-center text-sm', ft.muted)}>
							{transitLoading
								? t('transit_loading')
								: t('aspect_timeline_no_pairs', {
										defaultValue: 'No aspects were detected within orb across this series.'
									})}
						</p>
					) : resultsViewMode === 'chart' ? (
						<div className="min-h-[28rem] flex-1">
							<LineChart
								categories={categories}
								series={visibleSeries.map((s) => ({
									id: s.key,
									label: pairGlyphLabel(s, t),
									color: colorByKey.get(s.key) ?? palette[0]
								}))}
								values={values}
								markers={markers}
								tooltipExtra={tooltipExtra}
								area
								invertY
								yDomain={[0, ORB_CHART_MAX_DEGREES]}
								yTicks={Array.from({ length: ORB_CHART_MAX_DEGREES + 1 }, (_, i) => i)}
								formatY={(y) => `${Math.round(y)}°`}
								formatX={(x) => new Date(x).toLocaleString()}
								xLabel={t('column_time')}
								ariaLabel={t('aspect_timeline_subtitle', { defaultValue: 'Aspect timeline' })}
							/>
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
		</div>
	);
}
