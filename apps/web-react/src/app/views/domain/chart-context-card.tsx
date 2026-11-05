import { X } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Surface } from '@/app/components/ui/container';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

export interface ChartContextTransit {
	/** "Transit overlay" and its end time line. */
	title: string;
	detail: string;
	clearLabel: string;
	onClear: () => void;
}

/** Who and when a chart is: its identity lines, tags, and an active transit overlay. */
export function ChartContextCard({
	lines,
	tags,
	transit
}: {
	/** Type, date, time, place, coordinates, zodiac / house system — one per line. */
	lines: readonly string[];
	tags: readonly { name: string; color: string }[];
	transit?: ChartContextTransit | null;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="space-y-3">
			<div className={cn('space-y-1 text-sm', ft.muted)}>
				{lines.map((line, index) => (
					<div key={index}>{line}</div>
				))}
			</div>

			{tags.length > 0 ? (
				<div className="flex flex-wrap gap-2 pt-2">
					{tags.map((tag) => (
						<Badge key={tag.name} variant="outline" className="gap-1.5 px-2 py-1 text-xs">
							<span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
							{tag.name}
						</Badge>
					))}
				</div>
			) : null}

			{transit ? (
				<Surface
					variant="soft"
					padding="none"
					className={cn(
						'mt-3 flex items-center justify-between gap-3 px-3 py-2',
						'border-[color:var(--token-border-subtle)] bg-[color:var(--theme-soft-bg)]/50'
					)}
				>
					<div className="min-w-0">
						<div className={cn('truncate text-xs font-semibold', ft.title)}>{transit.title}</div>
						<div className={cn('truncate text-xs', ft.muted)}>{transit.detail}</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-7 shrink-0 rounded-lg hover:bg-[color:var(--token-hover-subtle)]"
						onClick={(event) => {
							event.stopPropagation();
							transit.onClear();
						}}
						aria-label={transit.clearLabel}
					>
						<X className={cn('h-3.5 w-3.5', ft.muted)} />
					</Button>
				</Surface>
			) : null}
		</div>
	);
}
