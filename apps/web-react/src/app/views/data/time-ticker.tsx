import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/app/components/ui/utils';
import { formatDateTime } from '@/lib/time/format';
import { TIME_CHART_MARGIN as MARGIN, timeAxisTicks, timeWindow } from './time-axis';

export interface TimeTickerLane {
	id: string;
	/** Short text at the left edge (a glyph or abbreviation). */
	label: string;
	/** Full name, shown on hover. */
	title?: string;
}

export interface TimeTickerMark {
	id: string;
	laneId: string;
	/** Instant (epoch ms). */
	x: number;
	color: string;
	title?: string;
}

export interface TimeTickerProps {
	/** Shared X values of the chart above (epoch ms), ascending; set the window and axis ticks. */
	categories: number[];
	lanes: TimeTickerLane[];
	marks: TimeTickerMark[];
	/** Visible window (epoch ms); `null` shows the whole `categories` span. */
	visibleRange: [number, number] | null;
	onMarkClick?: (markId: string) => void;
	formatX?: (x: number) => string;
	title?: string;
	/** Shown in place of the lanes when there are none. */
	emptyLabel: string;
	ariaLabel?: string;
	className?: string;
}

const LANE_HEIGHT = 18;
const AXIS_HEIGHT = 22;

/** Instants on a time axis, one lane per row, under a `TimeSeriesChart` with the same window.
 *  Uses the chart's margins and ticks, so marks line up with the chart above. */
export function TimeTicker({
	categories,
	lanes,
	marks,
	visibleRange,
	onMarkClick,
	formatX = (x) => formatDateTime(x),
	title,
	emptyLabel,
	ariaLabel,
	className
}: TimeTickerProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(640);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect?.width) setWidth(rect.width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const [xMin, xMax] = timeWindow(categories, visibleRange);
	const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
	const xScale = (x: number) =>
		MARGIN.left + (xMax > xMin ? ((x - xMin) / (xMax - xMin)) * innerWidth : innerWidth / 2);
	const laneCount = Math.max(1, lanes.length);
	const plotTop = 4;
	const plotBottom = plotTop + laneCount * LANE_HEIGHT;
	const height = plotBottom + AXIS_HEIGHT;
	const laneIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
	const xTicks = timeAxisTicks(categories, [xMin, xMax]);

	return (
		<div className={cn('shrink-0', className)}>
			{title && (
				<p className="px-1 pb-1.5 text-[0.65rem] font-semibold tracking-wide text-[color:var(--theme-content-muted)] uppercase">
					{title}
				</p>
			)}
			<div
				ref={containerRef}
				className="w-full rounded-lg border border-[color:var(--theme-panel-border)]"
			>
				<svg
					width="100%"
					height={height}
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label={ariaLabel ?? title}
					className="block"
				>
					{xTicks.map((tick, i) => (
						<line
							key={`grid-${i}`}
							x1={xScale(tick)}
							x2={xScale(tick)}
							y1={plotTop}
							y2={plotBottom}
							stroke="var(--theme-panel-border)"
							strokeDasharray="2 3"
						/>
					))}

					{lanes.length === 0 ? (
						<text
							x={MARGIN.left + innerWidth / 2}
							y={plotTop + LANE_HEIGHT / 2 + 3}
							textAnchor="middle"
							fontSize={10}
							fill="var(--theme-content-muted)"
						>
							{emptyLabel}
						</text>
					) : (
						lanes.map((lane, index) => (
							<text
								key={lane.id}
								x={MARGIN.left - 8}
								y={plotTop + index * LANE_HEIGHT + LANE_HEIGHT / 2 + 4}
								textAnchor="end"
								fontSize={11}
								fill="var(--theme-content-secondary)"
							>
								{lane.title && <title>{lane.title}</title>}
								{lane.label}
							</text>
						))
					)}

					{marks
						.filter((mark) => mark.x >= xMin && mark.x <= xMax && laneIndex.has(mark.laneId))
						.map((mark) => (
							<rect
								key={mark.id}
								x={xScale(mark.x) - 1}
								y={plotTop + laneIndex.get(mark.laneId)! * LANE_HEIGHT + 3}
								width={2}
								height={LANE_HEIGHT - 6}
								fill={mark.color}
								className={onMarkClick ? 'cursor-pointer' : undefined}
								onClick={onMarkClick ? () => onMarkClick(mark.id) : undefined}
							>
								{mark.title && <title>{mark.title}</title>}
							</rect>
						))}

					<line
						x1={MARGIN.left}
						x2={width - MARGIN.right}
						y1={plotBottom}
						y2={plotBottom}
						stroke="var(--theme-content-muted)"
						strokeWidth={1}
					/>
					{xTicks.map((tick, i) => (
						<text
							key={`label-${i}`}
							x={xScale(tick)}
							y={plotBottom + 15}
							textAnchor="middle"
							fontSize={10}
							fill="var(--theme-content-muted)"
						>
							{formatX(tick)}
						</text>
					))}
				</svg>
			</div>
		</div>
	);
}
