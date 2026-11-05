import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GRID_COLUMNS, type Breakpoint, type GridPlacement } from '@/lib/widgets/types';

/** Container widths at which the grid switches layouts. */
const TABLET_MIN_WIDTH = 640;
const DESKTOP_MIN_WIDTH = 1024;

export function breakpointForWidth(width: number): Breakpoint {
	if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
	if (width >= TABLET_MIN_WIDTH) return 'tablet';
	return 'mobile';
}

/**
 * A free widget grid: 12 columns on desktop, 6 on tablet, 1 on mobile, chosen from the
 * container's own width. Each item gets its placement for the current size; rows grow with their
 * content and the page scrolls vertically rather than shrinking cards.
 */
export function WidgetGrid<T extends { placement: GridPlacement; key: string }>({
	items,
	renderItem,
	className
}: {
	/** The items of every screen size; the grid shows those of the current one. */
	items: Record<Breakpoint, T[]>;
	renderItem: (item: T) => ReactNode;
	className?: string;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const measure = () => setBreakpoint(breakpointForWidth(root.getBoundingClientRect().width));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={rootRef}
			data-grid-breakpoint={breakpoint}
			className={className}
			style={{
				display: 'grid',
				gap: '1rem',
				gridTemplateColumns: `repeat(${GRID_COLUMNS[breakpoint]}, minmax(0, 1fr))`,
				gridAutoRows: 'minmax(2.5rem, auto)'
			}}
		>
			{items[breakpoint].map((item) => (
				<div
					key={item.key}
					className="min-h-0 min-w-0"
					style={{
						gridColumn: `${item.placement.x + 1} / span ${item.placement.w}`,
						gridRow: `${item.placement.y + 1} / span ${item.placement.h}`
					}}
				>
					{renderItem(item)}
				</div>
			))}
		</div>
	);
}
