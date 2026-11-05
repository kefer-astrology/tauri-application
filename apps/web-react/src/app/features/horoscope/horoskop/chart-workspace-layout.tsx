import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Toolbar } from '@/app/components/ui/container';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';

/** Reserve at least 360px for the wheel beside both rails and their gaps/padding. */
const INLINE_PANELS_MIN_WIDTH = 960;

/** The Horoskop regions around the protected wheel centre: left and right widget columns. On
 *  narrow areas the left region moves into the right panel behind a toolbar button; the right
 *  region stays in place. */
export function ChartWorkspaceLayout({
	children,
	left,
	right,
	leftLabel,
	rightLabel,
	actions
}: {
	/** The wheel. */
	children: ReactNode;
	left: ReactNode;
	right: ReactNode;
	leftLabel: string;
	rightLabel: string;
	/** Workspace controls (profile, widget catalog) at the end of the toolbar. */
	actions?: ReactNode;
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
			{(compact || actions) && (
				<Toolbar padding="compact" align="between">
					<div className="flex items-center gap-2">
						{compact && (
							<Button
								variant="outline"
								size="sm"
								data-chart-panel-trigger="details"
								onClick={() => setDetailsOpen(true)}
							>
								<PanelLeft aria-hidden="true" />
								{leftLabel}
							</Button>
						)}
					</div>
					{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
					<aside aria-label={leftLabel} className="min-h-0 overflow-y-auto">
						{left}
					</aside>
				)}
				{children}
				<aside aria-label={rightLabel} className="min-h-0 min-w-0 overflow-hidden">
					{right}
				</aside>
			</div>
			{compact && (
				<DetailSidePanel
					open={detailsOpen}
					onOpenChange={setDetailsOpen}
					title={leftLabel}
					contentClassName="sm:max-w-sm"
					bodyClassName="overflow-y-auto"
				>
					{left}
				</DetailSidePanel>
			)}
		</div>
	);
}
