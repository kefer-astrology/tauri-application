import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from './utils';

export interface LineChartSeriesDef {
	id: string;
	label: string;
	/** Any CSS color (hex or `var(...)`). Assign in a fixed categorical order — never cycled. */
	color: string;
}

export interface LineChartMarker {
	seriesId: string;
	/** Index into `categories`/`values[seriesId]`. */
	index: number;
	/** `hit` draws a filled dot (an exact alignment); `entry`/`exit` draw a small ring (crossing
	 *  the orb boundary). Purely presentational — callers decide what counts as which. */
	kind: 'hit' | 'entry' | 'exit';
	title?: string;
}

export interface LineChartProps {
	/** X values shared across all series (e.g. epoch milliseconds), ascending. */
	categories: number[];
	series: LineChartSeriesDef[];
	/** series.id -> values aligned 1:1 with `categories`; `null` breaks the line (missing sample). */
	values: Record<string, Array<number | null>>;
	/** Always-visible annotations (exact hits, orb entry/exit) drawn on top of the lines. */
	markers?: LineChartMarker[];
	/** Extra tooltip line per hovered (series, index) pair — e.g. an applying/separating tag. */
	tooltipExtra?: (seriesId: string, index: number) => string | null | undefined;
	/** Fills each series down to the y-axis baseline (low-opacity, stroke stays full-opacity on
	 *  top) — reads as a magnitude/intensity envelope rather than a bare trend line. Use for a
	 *  single bounded quantity per series (e.g. 0..1 closeness); still one surface per series, so
	 *  it stays legible with the same series cap as a plain line chart. */
	area?: boolean;
	/** Flips the vertical mapping so `yDomain[0]` plots at the top and `yDomain[1]` at the
	 *  bottom — e.g. a deviation-from-exact scale where 0 (best) reads as "up". The area fill's
	 *  baseline follows (still `yDomain[0]`), so it still closes against the new top edge. */
	invertY?: boolean;
	/** A fixed pixel height, or omitted to fill the parent's rendered height instead (the parent
	 *  must actually be sized — e.g. a flex child with its own height/flex-1 — for that to mean
	 *  anything; a plain block parent sized only by its content has nothing to fill). */
	height?: number;
	yDomain?: [number, number];
	yTicks?: number[];
	formatX?: (x: number) => string;
	formatY?: (y: number) => string;
	xLabel?: string;
	yLabel?: string;
	className?: string;
	ariaLabel?: string;
}

const MARGIN = { top: 12, right: 16, bottom: 34, left: 40 };

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

function niceTicks(min: number, max: number, count: number): number[] {
	if (max <= min) return [min];
	const step = (max - min) / Math.max(1, count - 1);
	return Array.from({ length: count }, (_, i) => min + step * i);
}

export function LineChart({
	categories,
	series,
	values,
	markers,
	tooltipExtra,
	area = false,
	invertY = false,
	height: fixedHeight,
	yDomain,
	yTicks,
	formatX = (x) => new Date(x).toLocaleString(),
	formatY = (y) => String(Math.round(y * 10) / 10),
	xLabel,
	yLabel,
	className,
	ariaLabel
}: LineChartProps) {
	const uid = useId();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(640);
	const [measuredHeight, setMeasuredHeight] = useState(360);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

	const xMin = categories[0] ?? 0;
	const xMax = categories[categories.length - 1] ?? 1;
	const [yMin, yMax] = useMemo<[number, number]>(() => {
		if (yDomain) return yDomain;
		let min = Infinity;
		let max = -Infinity;
		for (const id of Object.keys(values)) {
			for (const value of values[id]) {
				if (value === null || value === undefined || Number.isNaN(value)) continue;
				if (value < min) min = value;
				if (value > max) max = value;
			}
		}
		if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
		if (min === max) return [min - 1, max + 1];
		return [min, max];
	}, [values, yDomain]);

	const xScale = (x: number) =>
		MARGIN.left + (xMax > xMin ? ((x - xMin) / (xMax - xMin)) * innerWidth : innerWidth / 2);
	const yScale = (y: number) => {
		const fraction = (y - yMin) / (yMax - yMin || 1);
		return MARGIN.top + (invertY ? fraction : 1 - fraction) * innerHeight;
	};

	const resolvedYTicks = yTicks ?? niceTicks(yMin, yMax, 5);
	const xTickCount = Math.min(6, categories.length);
	const xTickIndices =
		categories.length <= 1
			? [0]
			: Array.from({ length: xTickCount }, (_, i) =>
					Math.round((i * (categories.length - 1)) / Math.max(1, xTickCount - 1))
				);

	function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
		if (categories.length === 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const relativeX = event.clientX - rect.left;
		const ratio = innerWidth > 0 ? Math.min(1, Math.max(0, relativeX / innerWidth)) : 0;
		const idx = Math.round(ratio * (categories.length - 1));
		setHoverIndex(idx);
	}

	const hoverCategory = hoverIndex !== null ? categories[hoverIndex] : null;
	const hoverEntries =
		hoverIndex !== null
			? series
					.map((s) => ({ ...s, value: values[s.id]?.[hoverIndex!] ?? null }))
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
				{xLabel ?? 'No data'}
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

				{xTickIndices.map((idx) => (
					<text
						key={idx}
						x={xScale(categories[idx])}
						y={height - MARGIN.bottom + 16}
						textAnchor="middle"
						fontSize={10}
						fill="var(--theme-content-muted)"
					>
						{formatX(categories[idx])}
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

				{area &&
					series.map((s) => (
						<path
							key={`${s.id}-area`}
							d={areaPathForSeries(categories, values[s.id] ?? [], xScale, yScale, yScale(yMin))}
							fill={s.color}
							fillOpacity={0.16}
							stroke="none"
						/>
					))}

				{series.map((s) => (
					<path
						key={s.id}
						d={pathForSeries(categories, values[s.id] ?? [], xScale, yScale)}
						fill="none"
						stroke={s.color}
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}

				{(markers ?? []).map((marker, markerIndex) => {
					const value = values[marker.seriesId]?.[marker.index];
					if (value === null || value === undefined) return null;
					const color = series.find((s) => s.id === marker.seriesId)?.color ?? 'currentColor';
					const cx = xScale(categories[marker.index]);
					const cy = yScale(value);
					return (
						<circle
							key={`${marker.seriesId}-${marker.index}-${markerIndex}`}
							cx={cx}
							cy={cy}
							r={marker.kind === 'hit' ? 5 : 3.5}
							fill={marker.kind === 'hit' ? color : 'var(--theme-panel-bg-solid)'}
							stroke={color}
							strokeWidth={marker.kind === 'hit' ? 2 : 1.5}
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

				<rect
					x={MARGIN.left}
					y={MARGIN.top}
					width={innerWidth}
					height={innerHeight}
					fill="transparent"
					onPointerMove={handlePointerMove}
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
									<span className="font-medium tabular-nums">
										{formatY(entry.value as number)}
									</span>
								</div>
								{extra && (
									<div
										className="pl-4 text-[10px]"
										style={{ color: 'var(--theme-content-muted)' }}
									>
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
