import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './ui/utils';
import { objectLabel, aspectLabel } from '@/lib/astrology/objectLabels';
import type { AspectExactHit, AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';

export interface TransitMicroTickerProps {
	/** X values shared with the main resonance chart (epoch ms), ascending. */
	categories: number[];
	/** Personal-planet (fast transiting body) series — one tick per `hits` entry. */
	series: AspectTimelineSeries[];
	colorByKey: Map<string, string>;
	/** Same visible X window as the main chart; `null` shows the full `categories` span. */
	visibleRange: [number, number] | null;
	onTickClick: (key: string) => void;
	ariaLabel?: string;
	className?: string;
}

/** Matches `transit-resonance-chart.tsx`'s own `MARGIN.left`/`MARGIN.right` exactly, so a tick
 *  here lands under the same X position as the main chart's wave at that instant. Not shared via
 *  import — the chart doesn't export its scale, and both strips render edge-to-edge in the same
 *  parent width, so independent measurement still stays pixel-aligned. */
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 16;
const BAR_HEIGHT = 32;

function formatTickTitle(
	series: AspectTimelineSeries,
	hit: AspectExactHit,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	const when = new Date(hit.timestampMs).toLocaleString();
	return `${objectLabel(series.from, t)} ${aspectLabel(series.aspectType, t)} ${objectLabel(series.to, t)} — ${when}`;
}

/** TR-08: a horizontal strip of exact-hit tick marks for fast "personal planet" transiting
 *  bodies, below the main resonance chart — those produce many brief, narrow waves that clutter
 *  the main chart next to the slower outer/social planets' sustained curves, so they're shown
 *  here instead as simple instants on the same time axis. Clicking a tick opens the same detail
 *  panel a wave click on the main chart does (`onTickClick` -> `setDetailSeriesKey`). */
export function TransitMicroTicker({
	categories,
	series,
	colorByKey,
	visibleRange,
	onTickClick,
	ariaLabel,
	className
}: TransitMicroTickerProps) {
	const { t } = useTranslation();
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

	const dataMin = categories[0] ?? 0;
	const dataMax = categories[categories.length - 1] ?? 1;
	const [xMin, xMax] = visibleRange ?? [dataMin, dataMax];
	const innerWidth = Math.max(10, width - MARGIN_LEFT - MARGIN_RIGHT);
	const xScale = (x: number) =>
		MARGIN_LEFT + (xMax > xMin ? ((x - xMin) / (xMax - xMin)) * innerWidth : innerWidth / 2);

	const ticks = series.flatMap((s) =>
		s.hits
			.filter((hit) => hit.timestampMs >= xMin && hit.timestampMs <= xMax)
			.map((hit) => ({ series: s, hit }))
	);

	return (
		<div className={cn('shrink-0', className)}>
			<p className="px-1 pb-1.5 text-[0.65rem] font-semibold tracking-wide text-[color:var(--theme-content-muted)] uppercase">
				{t('transit_micro_ticker_title', { defaultValue: 'Micro ticker (personal planets)' })}
			</p>
			<div
				ref={containerRef}
				className="w-full rounded-lg border border-[color:var(--theme-panel-border)]"
			>
				<svg
					width="100%"
					height={BAR_HEIGHT}
					viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
					role="img"
					aria-label={ariaLabel ?? t('transit_micro_ticker_title', { defaultValue: 'Micro ticker (personal planets)' })}
					className="block"
				>
					{ticks.map(({ series: s, hit }) => {
						const x = xScale(hit.timestampMs);
						const color = colorByKey.get(s.key) ?? 'var(--theme-accent)';
						return (
							<rect
								key={`${s.key}-${hit.timestampMs}`}
								x={x - 1}
								y={4}
								width={2}
								height={BAR_HEIGHT - 8}
								fill={color}
								className="cursor-pointer"
								onClick={() => onTickClick(s.key)}
							>
								<title>{formatTickTitle(s, hit, t)}</title>
							</rect>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
