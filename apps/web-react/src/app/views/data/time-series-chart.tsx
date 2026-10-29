import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/app/components/ui/utils';
import { formatDateTime } from '@/lib/time/format';

export interface TimeSeriesDef {
	id: string;
	label: string;
	/** Any CSS color (hex or `var(...)`). Assign in a fixed categorical order — never cycled. */
	color: string;
}

export interface TimeSeriesMarker {
	seriesId: string;
	/** Index into `categories`/`values[seriesId]`. */
	index: number;
	/** `hit` draws a filled dot (an exact alignment); `entry`/`exit` draw a small ring (crossing
	 *  the orb boundary). Purely presentational — callers decide what counts as which. */
	kind: 'hit' | 'entry' | 'exit';
	title?: string;
}

export interface TimeSeriesChartProps {
	/** X values shared across all series (epoch milliseconds), ascending. */
	categories: number[];
	series: TimeSeriesDef[];
	/** series.id -> values aligned 1:1 with `categories`; `null` breaks the line (missing sample). */
	values: Record<string, Array<number | null>>;
	/** Always-visible annotations (exact hits, orb entry/exit) drawn on top of the lines. */
	markers?: TimeSeriesMarker[];
	/** Extra tooltip line per hovered (series, index) pair — e.g. an applying/separating tag. */
	tooltipExtra?: (seriesId: string, index: number) => string | null | undefined;
	/** Fills each series down to the y-axis baseline (low-opacity, stroke stays full-opacity on
	 *  top) — reads as a magnitude/intensity envelope rather than a bare trend line. */
	area?: boolean;
	/** Flips the vertical mapping so `yDomain[0]` plots at the top and `yDomain[1]` at the
	 *  bottom — e.g. a deviation-from-exact scale where 0 (best) reads as "up". */
	invertY?: boolean;
	/** Treats values outside `yDomain` as missing (breaks the line) instead of drawing them
	 *  past the plot edge. */
	clipToYDomain?: boolean;
	/** A fixed pixel height, or omitted to fill the parent's rendered height instead (the parent
	 *  must actually be sized — e.g. a flex child with its own height/flex-1). */
	height?: number;
	yDomain?: [number, number];
	yTicks?: number[];
	formatX?: (x: number) => string;
	formatY?: (y: number) => string;
	xLabel?: string;
	yLabel?: string;
	/** Shown instead of the chart when `categories` is empty. */
	emptyLabel?: string;
	className?: string;
	ariaLabel?: string;

	/** Zoom/pan: visible X window (epoch ms), `null` = full span. Providing
	 *  `onVisibleRangeChange` enables wheel zoom and drag pan. */
	visibleRange?: [number, number] | null;
	onVisibleRangeChange?: (range: [number, number] | null) => void;
	/** Never zoom in past this many visible samples. */
	minVisibleSamples?: number;

	/** Highlight: providing `onHighlightChange` makes series clickable; a background click clears
	 *  the highlight. */
	highlightedSeriesId?: string | null;
	onHighlightChange?: (seriesId: string | null) => void;
	/** Fired instead of re-highlighting when the already-highlighted series is clicked. */
	onActivate?: (seriesId: string) => void;
}

const MARGIN = { top: 12, right: 16, bottom: 34, left: 40 };

function isMissing(value: number | null | undefined): value is null | undefined {
	return value === null || value === undefined || Number.isNaN(value);
}

function pathForSeries(
	categories: number[],
	values: Array<number | null>,
	xScale: (x: number) => number,
	yScale: (y: number) => number
): string {
	let d = '';
	let open = false;
	for (let i = 0; i < categories.length; i += 1) {
		const value = values[i];
		if (isMissing(value)) {
			open = false;
			continue;
		}
		d += `${open ? 'L' : 'M'}${xScale(categories[i]).toFixed(2)},${yScale(value).toFixed(2)} `;
		open = true;
	}
	return d.trim();
}

/** Same run-breaking as `pathForSeries`, but each contiguous run closes down to `baselineY` for
 *  an area fill instead of staying an open stroke. */
function areaPathForSeries(
	categories: number[],
	values: Array<number | null>,
	xScale: (x: number) => number,
	yScale: (y: number) => number,
	baselineY: number
): string {
	const runs: string[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length < 2) {
			run = [];
			return;
		}
		const firstX = run[0].split(',')[0];
		const lastX = run[run.length - 1].split(',')[0];
		runs.push(
			`M${firstX},${baselineY.toFixed(2)} L${run.join(' L')} L${lastX},${baselineY.toFixed(2)} Z`
		);
		run = [];
	};
	for (let i = 0; i < categories.length; i += 1) {
		const value = values[i];
		if (isMissing(value)) {
			flush();
			continue;
		}
		run.push(`${xScale(categories[i]).toFixed(2)},${yScale(value).toFixed(2)}`);
	}
	flush();
	return runs.join(' ');
}

function evenTicks(min: number, max: number, count: number): number[] {
	if (max <= min) return [min];
	const step = (max - min) / Math.max(1, count - 1);
	return Array.from({ length: count }, (_, i) => min + step * i);
}

function clampRange(
	start: number,
	end: number,
	dataMin: number,
	dataMax: number
): [number, number] {
	const span = end - start;
	if (span >= dataMax - dataMin) return [dataMin, dataMax];
	let nextStart = start;
	let nextEnd = end;
	if (nextStart < dataMin) {
		nextStart = dataMin;
		nextEnd = nextStart + span;
	}
	if (nextEnd > dataMax) {
		nextEnd = dataMax;
		nextStart = nextEnd - span;
	}
	return [nextStart, nextEnd];
}

export function TimeSeriesChart({
	categories,
	series,
	values,
	markers,
	tooltipExtra,
	area = false,
	invertY = false,
	clipToYDomain = false,
	height: fixedHeight,
	yDomain,
	yTicks,
	formatX = (x) => formatDateTime(x),
	formatY = (y) => String(Math.round(y * 10) / 10),
	xLabel,
	yLabel,
	emptyLabel = 'No data',
	className,
	ariaLabel,
	visibleRange = null,
	onVisibleRangeChange,
	minVisibleSamples = 12,
	highlightedSeriesId = null,
	onHighlightChange,
	onActivate
}: TimeSeriesChartProps) {
	const uid = useId();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(640);
	const [measuredHeight, setMeasuredHeight] = useState(360);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const dragRef = useRef<{ startClientX: number; startRange: [number, number] } | null>(null);

	const zoomable = onVisibleRangeChange !== undefined;
	const highlightable = onHighlightChange !== undefined;

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect?.width) setWidth(rect.width);
			if (rect?.height) setMeasuredHeight(rect.height);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const height = fixedHeight ?? measuredHeight;
	const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
	const innerHeight = Math.max(10, height - MARGIN.top - MARGIN.bottom);

	const dataMin = categories[0] ?? 0;
	const dataMax = categories[categories.length - 1] ?? 1;
	const [xMin, xMax] = visibleRange ?? [dataMin, dataMax];

	const [yMin, yMax] = useMemo<[number, number]>(() => {
		if (yDomain) return yDomain;
		let min = Infinity;
		let max = -Infinity;
		for (const id of Object.keys(values)) {
			for (const value of values[id]) {
				if (isMissing(value)) continue;
				if (value < min) min = value;
				if (value > max) max = value;
			}
		}
		if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
		if (min === max) return [min - 1, max + 1];
		return [min, max];
	}, [values, yDomain]);

	const plotValues = useMemo(() => {
		if (!clipToYDomain) return values;
		const result: Record<string, Array<number | null>> = {};
		for (const s of series) {
			result[s.id] = (values[s.id] ?? []).map((value) =>
				isMissing(value) || value < yMin || value > yMax ? null : value
			);
		}
		return result;
	}, [clipToYDomain, series, values, yMin, yMax]);

	const xScale = (x: number) =>
		MARGIN.left + (xMax > xMin ? ((x - xMin) / (xMax - xMin)) * innerWidth : innerWidth / 2);
	const yScale = (y: number) => {
		const fraction = (y - yMin) / (yMax - yMin || 1);
		return MARGIN.top + (invertY ? fraction : 1 - fraction) * innerHeight;
	};

	const resolvedYTicks = yTicks ?? evenTicks(yMin, yMax, 5);
	const xTicks =
		categories.length <= 1 ? [dataMin] : evenTicks(xMin, xMax, Math.min(6, categories.length));

	function ratioFromEvent(
		event: React.PointerEvent<SVGRectElement> | React.WheelEvent<SVGRectElement>
	) {
		const rect = event.currentTarget.getBoundingClientRect();
		const relativeX = event.clientX - rect.left;
		return innerWidth > 0 ? Math.min(1, Math.max(0, relativeX / innerWidth)) : 0.5;
	}

	function applyRange(nextStart: number, nextEnd: number) {
		onVisibleRangeChange?.(clampRange(nextStart, nextEnd, dataMin, dataMax));
	}

	function handleWheel(event: React.WheelEvent<SVGRectElement>) {
		if (!zoomable) return;
		event.preventDefault();
		const averageStepMs = categories.length > 1 ? (dataMax - dataMin) / (categories.length - 1) : 1;
		const minSpanMs = Math.max(1, averageStepMs * minVisibleSamples);
		const anchorTime = xMin + ratioFromEvent(event) * (xMax - xMin);
		const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
		const span = Math.min(dataMax - dataMin, Math.max(minSpanMs, (xMax - xMin) * factor));
		const nextStart = anchorTime - (anchorTime - xMin) * (span / (xMax - xMin || 1));
		applyRange(nextStart, nextStart + span);
	}

	function handlePointerDown(event: React.PointerEvent<SVGRectElement>) {
		if (!zoomable && !highlightable) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = { startClientX: event.clientX, startRange: [xMin, xMax] };
	}

	function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
		if (dragRef.current && zoomable) {
			const deltaPx = event.clientX - dragRef.current.startClientX;
			const [startRangeMin, startRangeMax] = dragRef.current.startRange;
			const span = startRangeMax - startRangeMin;
			const deltaTime = innerWidth > 0 ? -(deltaPx / innerWidth) * span : 0;
			applyRange(startRangeMin + deltaTime, startRangeMax + deltaTime);
			return;
		}
		if (categories.length === 0) return;
		const hoveredTime = xMin + ratioFromEvent(event) * (xMax - xMin);
		let closest = 0;
		let closestDelta = Infinity;
		for (let i = 0; i < categories.length; i += 1) {
			const delta = Math.abs(categories[i] - hoveredTime);
			if (delta < closestDelta) {
				closestDelta = delta;
				closest = i;
			}
		}
		setHoverIndex(closest);
	}

	function handlePointerUp(event: React.PointerEvent<SVGRectElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		// A plain click on the background (negligible movement, not a pan) clears the highlight —
		// clicking a series itself is handled on the series path.
		if (dragRef.current && Math.abs(event.clientX - dragRef.current.startClientX) < 3) {
			onHighlightChange?.(null);
		}
		dragRef.current = null;
	}

	function handleSeriesClick(seriesId: string) {
		if (highlightedSeriesId === seriesId) {
			onActivate?.(seriesId);
			return;
		}
		onHighlightChange?.(seriesId);
	}

	const isDimmed = (seriesId: string) =>
		highlightedSeriesId !== null && highlightedSeriesId !== seriesId;

	const hoverCategory = hoverIndex !== null ? categories[hoverIndex] : null;
	const hoverEntries =
		hoverIndex !== null
			? series
					.map((s) => ({ ...s, value: plotValues[s.id]?.[hoverIndex] ?? null }))
					.filter((entry) => entry.value !== null)
			: [];

	const tooltipLeft = hoverCategory !== null ? xScale(hoverCategory) : 0;
	const tooltipAlignRight = tooltipLeft > width - 180;

	if (categories.length === 0) {
		return (
			<div
				className={cn(
					'flex items-center justify-center rounded-lg border text-sm',
					'border-[color:var(--theme-panel-border)] text-[color:var(--theme-content-muted)]',
					fixedHeight === undefined && 'h-full',
					className
				)}
				style={fixedHeight === undefined ? undefined : { height }}
			>
				{emptyLabel}
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn('relative w-full', fixedHeight === undefined && 'h-full', className)}
		>
			<svg
				width="100%"
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				role="img"
				aria-label={ariaLabel}
				className="block"
			>
				<clipPath id={`${uid}-plot-clip`}>
					<rect x={MARGIN.left} y={MARGIN.top} width={innerWidth} height={innerHeight} />
				</clipPath>

				{resolvedYTicks.map((tick) => (
					<g key={tick}>
						<line
							x1={MARGIN.left}
							x2={width - MARGIN.right}
							y1={yScale(tick)}
							y2={yScale(tick)}
							stroke="var(--theme-panel-border)"
							strokeWidth={1}
						/>
						<text
							x={MARGIN.left - 8}
							y={yScale(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							fontSize={10}
							fill="var(--theme-content-muted)"
						>
							{formatY(tick)}
						</text>
					</g>
				))}

				{xTicks.map((tick, i) => (
					<text
						key={i}
						x={xScale(tick)}
						y={height - MARGIN.bottom + 16}
						textAnchor="middle"
						fontSize={10}
						fill="var(--theme-content-muted)"
					>
						{formatX(tick)}
					</text>
				))}

				<line
					x1={MARGIN.left}
					x2={width - MARGIN.right}
					y1={height - MARGIN.bottom}
					y2={height - MARGIN.bottom}
					stroke="var(--theme-content-muted)"
					strokeWidth={1}
				/>

				<g clipPath={`url(#${uid}-plot-clip)`}>
					{area &&
						series.map((s) => (
							<path
								key={`${s.id}-area`}
								d={areaPathForSeries(
									categories,
									plotValues[s.id] ?? [],
									xScale,
									yScale,
									yScale(yMin)
								)}
								fill={s.color}
								fillOpacity={isDimmed(s.id) ? 0.05 : 0.16}
								stroke="none"
							/>
						))}

					{series.map((s) => (
						<path
							key={s.id}
							d={pathForSeries(categories, plotValues[s.id] ?? [], xScale, yScale)}
							fill="none"
							stroke={s.color}
							strokeOpacity={isDimmed(s.id) ? 0.25 : 1}
							strokeWidth={highlightedSeriesId === s.id ? 3 : 2}
							strokeLinecap="round"
							strokeLinejoin="round"
							className={highlightable ? 'cursor-pointer' : undefined}
							pointerEvents={highlightable ? 'stroke' : 'none'}
							onClick={highlightable ? () => handleSeriesClick(s.id) : undefined}
						/>
					))}

					{(markers ?? []).map((marker, markerIndex) => {
						const value = plotValues[marker.seriesId]?.[marker.index];
						if (isMissing(value)) return null;
						const color = series.find((s) => s.id === marker.seriesId)?.color ?? 'currentColor';
						return (
							<circle
								key={`${marker.seriesId}-${marker.index}-${markerIndex}`}
								cx={xScale(categories[marker.index])}
								cy={yScale(value)}
								r={marker.kind === 'hit' ? 5 : 3.5}
								fill={marker.kind === 'hit' ? color : 'var(--theme-panel-bg-solid)'}
								stroke={color}
								strokeWidth={marker.kind === 'hit' ? 2 : 1.5}
								opacity={isDimmed(marker.seriesId) ? 0.3 : 1}
							>
								{marker.title && <title>{marker.title}</title>}
							</circle>
						);
					})}

					{hoverIndex !== null && (
						<g>
							<line
								x1={xScale(categories[hoverIndex])}
								x2={xScale(categories[hoverIndex])}
								y1={MARGIN.top}
								y2={height - MARGIN.bottom}
								stroke="var(--theme-content-muted)"
								strokeWidth={1}
								strokeDasharray="3 3"
							/>
							{hoverEntries.map((entry) => (
								<circle
									key={entry.id}
									cx={xScale(categories[hoverIndex])}
									cy={yScale(entry.value as number)}
									r={4}
									fill={entry.color}
									stroke="var(--theme-panel-bg-solid)"
									strokeWidth={2}
								/>
							))}
						</g>
					)}
				</g>

				<rect
					x={MARGIN.left}
					y={MARGIN.top}
					width={innerWidth}
					height={innerHeight}
					fill="transparent"
					className={zoomable ? 'cursor-grab active:cursor-grabbing' : undefined}
					onWheel={zoomable ? handleWheel : undefined}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={() => setHoverIndex(null)}
				/>
			</svg>

			{yLabel && (
				<div
					className="pointer-events-none absolute top-1 left-1 text-[10px]"
					style={{ color: 'var(--theme-content-muted)' }}
				>
					{yLabel}
				</div>
			)}

			{hoverIndex !== null && hoverCategory !== null && hoverEntries.length > 0 && (
				<div
					className={cn(
						'pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border px-3 py-2 text-xs shadow-lg',
						'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]'
					)}
					style={{
						top: MARGIN.top,
						left: tooltipAlignRight ? undefined : tooltipLeft + 10,
						right: tooltipAlignRight ? width - tooltipLeft + 10 : undefined
					}}
				>
					<div className="mb-1 font-medium" style={{ color: 'var(--theme-content-muted)' }}>
						{formatX(hoverCategory)}
					</div>
					{hoverEntries.map((entry) => {
						const extra = tooltipExtra?.(entry.id, hoverIndex);
						return (
							<div key={entry.id} className="py-0.5">
								<div className="flex items-center gap-1.5 whitespace-nowrap">
									<span
										className="inline-block h-0.5 w-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: entry.color }}
									/>
									<span className="min-w-0 flex-1 truncate">{entry.label}</span>
									<span className="font-medium tabular-nums">{formatY(entry.value as number)}</span>
								</div>
								{extra && (
									<div className="pl-4 text-[10px]" style={{ color: 'var(--theme-content-muted)' }}>
										{extra}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{xLabel && (
				<div
					className="pointer-events-none absolute right-2 bottom-0 text-[10px]"
					style={{ color: 'var(--theme-content-muted)' }}
				>
					{xLabel}
				</div>
			)}

			<div className="sr-only" id={`${uid}-legend`}>
				{series.map((s) => s.label).join(', ')}
			</div>
		</div>
	);
}
