import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from './ui/utils';

export interface TransitResonanceSeriesDef {
	id: string;
	label: string;
	color: string;
}

export interface TransitResonanceMarker {
	seriesId: string;
	index: number;
	kind: 'hit' | 'entry' | 'exit';
	title?: string;
}

export interface TransitResonanceChartProps {
	/** X values shared across all series (epoch ms), ascending. */
	categories: number[];
	series: TransitResonanceSeriesDef[];
	/** series.id -> degrees-from-exact aligned 1:1 with `categories`; `null` = out of orb (breaks
	 *  the line — a narrower-orb aspect's wave only appears once inside its own orb). */
	values: Record<string, Array<number | null>>;
	markers?: TransitResonanceMarker[];
	tooltipExtra?: (seriesId: string, index: number) => string | null | undefined;
	/** Y-axis span in degrees — `[0, yMaxDegrees]`, 0 at the top (exact). */
	yMaxDegrees: number;
	/** Visible X window (epoch ms); `null` shows the full `categories` span. */
	visibleRange: [number, number] | null;
	onVisibleRangeChange: (range: [number, number] | null) => void;
	highlightedKey: string | null;
	onHighlightChange: (key: string | null) => void;
	/** Fired instead of un-highlighting when the user clicks an already-highlighted series —
	 *  "second click opens the detail panel" (TR-07/TR-10). */
	onActivate?: (key: string) => void;
	formatX?: (x: number) => string;
	ariaLabel?: string;
	className?: string;
}

const MARGIN = { top: 12, right: 16, bottom: 34, left: 40 };
/** Never zoom in past ~12 visible samples — a narrower window stops being readable as a wave. */
const MIN_VISIBLE_SAMPLES = 12;

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
		if (value === null || value === undefined || Number.isNaN(value)) {
			open = false;
			continue;
		}
		const x = xScale(categories[i]);
		const y = yScale(value);
		d += `${open ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
		open = true;
	}
	return d.trim();
}

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
		runs.push(`M${firstX},${baselineY.toFixed(2)} L${run.join(' L')} L${lastX},${baselineY.toFixed(2)} Z`);
		run = [];
	};
	for (let i = 0; i < categories.length; i += 1) {
		const value = values[i];
		if (value === null || value === undefined || Number.isNaN(value)) {
			flush();
			continue;
		}
		run.push(`${xScale(categories[i]).toFixed(2)},${yScale(value).toFixed(2)}`);
	}
	flush();
	return runs.join(' ');
}

/** Degree gridline step for a given Y span — finer spacing once zoomed in, so gridlines stay
 *  legibly spaced rather than bunching up or thinning out (TR-06a). */
function gridStepForYMax(yMaxDegrees: number): number {
	if (yMaxDegrees <= 1) return 0.1;
	if (yMaxDegrees <= 2) return 0.25;
	if (yMaxDegrees <= 4) return 0.5;
	return 1;
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

export function TransitResonanceChart({
	categories,
	series,
	values,
	markers,
	tooltipExtra,
	yMaxDegrees,
	visibleRange,
	onVisibleRangeChange,
	highlightedKey,
	onHighlightChange,
	onActivate,
	formatX = (x) => new Date(x).toLocaleString(),
	ariaLabel,
	className
}: TransitResonanceChartProps) {
	const uid = useId();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(640);
	const [measuredHeight, setMeasuredHeight] = useState(360);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const dragRef = useRef<{ startClientX: number; startRange: [number, number] } | null>(null);

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

	const height = measuredHeight;
	const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
	const innerHeight = Math.max(10, height - MARGIN.top - MARGIN.bottom);

	const dataMin = categories[0] ?? 0;
	const dataMax = categories[categories.length - 1] ?? 1;
	const [xMin, xMax] = visibleRange ?? [dataMin, dataMax];

	const averageStepMs =
		categories.length > 1 ? (dataMax - dataMin) / (categories.length - 1) : 1;
	const minSpanMs = Math.max(1, averageStepMs * MIN_VISIBLE_SAMPLES);

	const yMin = 0;
	const yMax = yMaxDegrees;
	const gridStep = gridStepForYMax(yMaxDegrees);
	const resolvedYTicks = useMemo(() => {
		const ticks: number[] = [];
		for (let tick = 0; tick <= yMax + 1e-9; tick += gridStep) ticks.push(Math.round(tick * 100) / 100);
		return ticks;
	}, [yMax, gridStep]);

	const xScale = (x: number) =>
		MARGIN.left + (xMax > xMin ? ((x - xMin) / (xMax - xMin)) * innerWidth : innerWidth / 2);
	const yScale = (y: number) => {
		const fraction = (y - yMin) / (yMax - yMin || 1);
		return MARGIN.top + fraction * innerHeight; // 0° (exact) at the top, matching the degree-deviation convention.
	};

	/** Clipped-to-window values: outside `[0, yMaxDegrees]` reads the same as out-of-orb. */
	const clippedValues = useMemo(() => {
		const result: Record<string, Array<number | null>> = {};
		for (const s of series) {
			result[s.id] = (values[s.id] ?? []).map((degrees) =>
				degrees === null || degrees > yMaxDegrees ? null : degrees
			);
		}
		return result;
	}, [series, values, yMaxDegrees]);

	function applyRange(nextStart: number, nextEnd: number) {
		onVisibleRangeChange(clampRange(nextStart, nextEnd, dataMin, dataMax));
	}

	function handleWheel(event: React.WheelEvent<SVGRectElement>) {
		event.preventDefault();
		const rect = event.currentTarget.getBoundingClientRect();
		const relativeX = event.clientX - rect.left;
		const ratio = innerWidth > 0 ? Math.min(1, Math.max(0, relativeX / innerWidth)) : 0.5;
		const anchorTime = xMin + ratio * (xMax - xMin);
		const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
		const span = Math.min(dataMax - dataMin, Math.max(minSpanMs, (xMax - xMin) * factor));
		const nextStart = anchorTime - (anchorTime - xMin) * (span / (xMax - xMin || 1));
		applyRange(nextStart, nextStart + span);
	}

	function handlePointerDown(event: React.PointerEvent<SVGRectElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = { startClientX: event.clientX, startRange: [xMin, xMax] };
	}

	function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
		if (dragRef.current) {
			const deltaPx = event.clientX - dragRef.current.startClientX;
			const [startRangeMin, startRangeMax] = dragRef.current.startRange;
			const span = startRangeMax - startRangeMin;
			const deltaTime = innerWidth > 0 ? -(deltaPx / innerWidth) * span : 0;
			applyRange(startRangeMin + deltaTime, startRangeMax + deltaTime);
			return;
		}
		if (categories.length === 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const relativeX = event.clientX - rect.left;
		const ratio = innerWidth > 0 ? Math.min(1, Math.max(0, relativeX / innerWidth)) : 0;
		const hoveredTime = xMin + ratio * (xMax - xMin);
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
		// clicking a series itself is a separate handler (`handleSeriesClick`) that stops propagation.
		if (dragRef.current && Math.abs(event.clientX - dragRef.current.startClientX) < 3) {
			onHighlightChange(null);
		}
		dragRef.current = null;
	}

	function handleSeriesClick(seriesId: string) {
		if (highlightedKey === seriesId) {
			onActivate?.(seriesId);
			return;
		}
		onHighlightChange(seriesId);
	}

	const hoverCategory = hoverIndex !== null ? categories[hoverIndex] : null;
	const hoverEntries =
		hoverIndex !== null
			? series
					.map((s) => ({ ...s, value: clippedValues[s.id]?.[hoverIndex!] ?? null }))
					.filter((entry) => entry.value !== null)
			: [];

	const tooltipLeft = hoverCategory !== null ? xScale(hoverCategory) : 0;
	const tooltipAlignRight = tooltipLeft > width - 180;

	if (categories.length === 0) {
		return (
			<div
				className={cn(
					'flex h-full items-center justify-center rounded-lg border text-sm',
					'border-[color:var(--theme-panel-border)] text-[color:var(--theme-content-muted)]',
					className
				)}
			>
				{ariaLabel ?? 'No data'}
			</div>
		);
	}

	return (
		<div ref={containerRef} className={cn('relative h-full w-full', className)}>
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
							{tick}°
						</text>
					</g>
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
					{series.map((s) => {
						const dimmed = highlightedKey !== null && highlightedKey !== s.id;
						return (
							<path
								key={`${s.id}-area`}
								d={areaPathForSeries(categories, clippedValues[s.id] ?? [], xScale, yScale, yScale(yMin))}
								fill={s.color}
								fillOpacity={dimmed ? 0.05 : 0.16}
								stroke="none"
							/>
						);
					})}

					{series.map((s) => {
						const dimmed = highlightedKey !== null && highlightedKey !== s.id;
						return (
							<path
								key={s.id}
								d={pathForSeries(categories, clippedValues[s.id] ?? [], xScale, yScale)}
								fill="none"
								stroke={s.color}
								strokeOpacity={dimmed ? 0.25 : 1}
								strokeWidth={highlightedKey === s.id ? 3 : 2}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="cursor-pointer"
								pointerEvents="stroke"
								onClick={() => handleSeriesClick(s.id)}
							/>
						);
					})}

					{(markers ?? []).map((marker, markerIndex) => {
						const value = clippedValues[marker.seriesId]?.[marker.index];
						if (value === null || value === undefined) return null;
						const color = series.find((s) => s.id === marker.seriesId)?.color ?? 'currentColor';
						const dimmed = highlightedKey !== null && highlightedKey !== marker.seriesId;
						return (
							<circle
								key={`${marker.seriesId}-${marker.index}-${markerIndex}`}
								cx={xScale(categories[marker.index])}
								cy={yScale(value)}
								r={marker.kind === 'hit' ? 5 : 3.5}
								fill={marker.kind === 'hit' ? color : 'var(--theme-panel-bg-solid)'}
								stroke={color}
								strokeWidth={marker.kind === 'hit' ? 2 : 1.5}
								opacity={dimmed ? 0.3 : 1}
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

				{categories.length > 1 &&
					(() => {
						const tickCount = Math.min(6, categories.length);
						const span = xMax - xMin || 1;
						return Array.from({ length: tickCount }, (_, i) => {
							const t = xMin + (i / Math.max(1, tickCount - 1)) * span;
							return (
								<text
									key={i}
									x={xScale(t)}
									y={height - MARGIN.bottom + 16}
									textAnchor="middle"
									fontSize={10}
									fill="var(--theme-content-muted)"
								>
									{formatX(t)}
								</text>
							);
						});
					})()}

				<rect
					x={MARGIN.left}
					y={MARGIN.top}
					width={innerWidth}
					height={innerHeight}
					fill="transparent"
					className="cursor-grab active:cursor-grabbing"
					onWheel={handleWheel}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={() => setHoverIndex(null)}
				/>
			</svg>

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
									<span className="font-medium tabular-nums">
										{Math.round((entry.value as number) * 100) / 100}°
									</span>
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

			<div className="sr-only" id={`${uid}-legend`}>
				{series.map((s) => s.label).join(', ')}
			</div>
		</div>
	);
}
