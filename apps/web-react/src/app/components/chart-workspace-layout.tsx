import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Toolbar } from './ui/container';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';

/** Reserve at least 360px for the wheel beside both rails and their gaps/padding. */
const INLINE_PANELS_MIN_WIDTH = 960;

export function ChartWorkspaceLayout({
	children,
	details,
	positions,
	detailsLabel,
	positionsLabel
}: {
	children: ReactNode;
	details: ReactNode;
	positions: ReactNode;
	detailsLabel: string;
	positionsLabel: string;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [compact, setCompact] = useState(true);
	const [detailsOpen, setDetailsOpen] = useState(false);

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const measure = () => {
			const nextCompact = root.getBoundingClientRect().width < INLINE_PANELS_MIN_WIDTH;
			setCompact(nextCompact);
			if (!nextCompact) setDetailsOpen(false);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={rootRef}
			className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
			data-tour="radix-workspace"
			data-panel-layout={compact ? 'overlay' : 'inline'}
		>
			{compact && (
				<Toolbar padding="compact" align="start">
					<Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
						<SheetTrigger asChild>
							<Button variant="outline" size="sm" data-chart-panel-trigger="details">
								<PanelLeft aria-hidden="true" />
								{detailsLabel}
							</Button>
						</SheetTrigger>
						<SheetContent
							side="right"
							className="w-full max-w-sm gap-0"
							aria-describedby={undefined}
						>
							<SheetHeader className="shrink-0 border-b pr-12">
								<SheetTitle>{detailsLabel}</SheetTitle>
							</SheetHeader>
							<div className="min-h-0 flex-1 overflow-y-auto p-4">{details}</div>
						</SheetContent>
					</Sheet>
				</Toolbar>
			)}
			<div
				className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden p-3 sm:gap-6 sm:p-4"
				style={{
					gridTemplateColumns: compact
						? 'minmax(0, 1fr) clamp(10rem, 28%, 14rem)'
						: '288px minmax(0, 1fr) 224px'
				}}
			>
				{!compact && (
					<aside aria-label={detailsLabel} className="min-h-0 overflow-y-auto">
						{details}
					</aside>
				)}
				{children}
				<aside aria-label={positionsLabel} className="min-h-0 min-w-0 overflow-hidden">
					{positions}
				</aside>
			</div>
		</div>
	);
}
