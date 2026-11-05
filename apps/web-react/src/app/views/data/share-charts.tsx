import { Button } from '@/app/components/ui/button';
import { Surface } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
import { cn } from '@/app/components/ui/utils';

/** One counted category: its label, count and share (0–1) of the whole. */
export interface ShareItem {
	id: string;
	label: string;
	count: number;
	share: number;
	color: string;
}

/** Hover previews an item, a click selects (locks) it; `activeId` marks the shown one. Every
 *  item is a button, so keyboard focus previews it too. */
export interface ShareInteraction {
	activeId?: string | null;
	onItemHover?: (id: string | null) => void;
	onItemSelect?: (id: string) => void;
}

const percent = (share: number) => `${Math.round(share * 100)} %`;

function itemHandlers(id: string, { onItemHover, onItemSelect }: ShareInteraction) {
	return {
		onMouseEnter: () => onItemHover?.(id),
		onMouseLeave: () => onItemHover?.(null),
		onFocus: () => onItemHover?.(id),
		onBlur: () => onItemHover?.(null),
		onClick: () => onItemSelect?.(id)
	};
}

/** Vertical columns, one per item, height by share; zero items show an empty outline. */
export function ShareColumns({
	items,
	...interaction
}: { items: readonly ShareItem[] } & ShareInteraction) {
	return (
		<div className="flex h-28 items-end justify-between gap-1">
			{items.map((item) => (
				<Button
					key={item.id}
					type="button"
					variant="ghost"
					aria-pressed={interaction.activeId === item.id}
					className={cn(
						'flex h-full flex-1 flex-col items-center justify-end gap-0.5 px-0.5 py-1 font-normal',
						interaction.activeId === item.id && 'bg-[color:var(--theme-soft-bg)]'
					)}
					{...itemHandlers(item.id, interaction)}
				>
					<span
						className={cn(
							'w-full rounded-t-lg',
							item.count === 0 && 'border-2 border-dashed border-[color:var(--theme-panel-border)]'
						)}
						style={
							item.count === 0
								? { height: '8%' }
								: { height: `${Math.max(8, item.share * 100)}%`, backgroundColor: item.color }
						}
					/>
					<Text variant="compactLabel" as="span">
						{item.count} · {percent(item.share)}
					</Text>
					<Text variant="caption" as="span" tone="muted" className="truncate">
						{item.label}
					</Text>
				</Button>
			))}
		</div>
	);
}

/** One bar split by share, with a legend of the items below. */
export function StackedShareBar({
	items,
	...interaction
}: { items: readonly ShareItem[] } & ShareInteraction) {
	return (
		<div>
			<Surface variant="soft" padding="none" className="flex h-3 w-full overflow-hidden">
				{items.map((item) =>
					item.share > 0 ? (
						<span
							key={item.id}
							title={item.label}
							style={{ width: `${item.share * 100}%`, backgroundColor: item.color }}
							className={cn(
								interaction.activeId && interaction.activeId !== item.id && 'opacity-40'
							)}
						/>
					) : null
				)}
			</Surface>
			<div className="mt-1 flex flex-wrap gap-1">
				{items.map((item) => (
					<Button
						key={item.id}
						type="button"
						variant="ghost"
						size="sm"
						aria-pressed={interaction.activeId === item.id}
						className={cn(
							'h-auto gap-1.5 px-1.5 py-0.5 text-xs font-normal',
							item.count === 0 && 'text-[color:var(--theme-content-muted)]',
							interaction.activeId === item.id && 'bg-[color:var(--theme-soft-bg)]'
						)}
						{...itemHandlers(item.id, interaction)}
					>
						<span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
						{item.label} {item.count} ({percent(item.share)})
					</Button>
				))}
			</div>
		</div>
	);
}

/** A ring split by share, with its items listed beside it. */
export function ShareDonut({
	items,
	...interaction
}: { items: readonly ShareItem[] } & ShareInteraction) {
	let start = 0;
	const stops = items.map((item) => {
		const end = start + item.share * 100;
		const stop = `${item.color} ${start}% ${end}%`;
		start = end;
		return stop;
	});
	const background =
		start > 0
			? `conic-gradient(${stops.join(', ')}${start < 100 ? `, var(--theme-soft-bg) ${start}% 100%` : ''})`
			: 'var(--theme-soft-bg)';
	return (
		<div className="flex items-center gap-3">
			<div className="h-16 w-16 shrink-0 rounded-full" style={{ background }} aria-hidden="true" />
			<div className="grid flex-1 grid-cols-2 gap-1">
				{items.map((item) => (
					<Button
						key={item.id}
						type="button"
						variant="outline"
						size="sm"
						aria-pressed={interaction.activeId === item.id}
						className={cn(
							'h-auto justify-between px-1.5 py-0.5 text-xs font-normal',
							interaction.activeId === item.id && 'bg-[color:var(--theme-soft-bg)]'
						)}
						{...itemHandlers(item.id, interaction)}
					>
						<span>{item.label}</span>
						<span className="text-[color:var(--theme-content-muted)]">{percent(item.share)}</span>
					</Button>
				))}
			</div>
		</div>
	);
}

/** Horizontal bars, one row per item, length relative to the largest count. */
export function ShareRows({
	items,
	...interaction
}: { items: readonly ShareItem[] } & ShareInteraction) {
	const max = Math.max(1, ...items.map((item) => item.count));
	return (
		<div className="space-y-1">
			{items.map((item) => (
				<Button
					key={item.id}
					type="button"
					variant="ghost"
					size="sm"
					aria-pressed={interaction.activeId === item.id}
					className={cn(
						'h-auto w-full gap-2 px-1 py-0.5 font-normal',
						interaction.activeId === item.id && 'bg-[color:var(--theme-soft-bg)]'
					)}
					{...itemHandlers(item.id, interaction)}
				>
					<Text variant="caption" as="span" tone="muted" className="w-24 truncate text-left">
						{item.label}
					</Text>
					<Surface variant="soft" padding="none" className="h-4 flex-1 overflow-hidden">
						<span
							className={cn(
								'block h-full rounded-r',
								item.count === 0 && 'border border-dashed border-[color:var(--theme-panel-border)]'
							)}
							style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color }}
						/>
					</Surface>
					<Text variant="caption" as="span" className="w-5 text-right tabular-nums">
						{item.count}
					</Text>
				</Button>
			))}
		</div>
	);
}

/** Cells shaded by value relative to the largest (e.g. planets per house I–XII). */
export function HeatGrid({
	cells,
	columns = 6,
	color = 'var(--token-viz-1)'
}: {
	cells: readonly { id: string; label: string; value: number }[];
	columns?: number;
	color?: string;
}) {
	const max = Math.max(1, ...cells.map((cell) => cell.value));
	return (
		<div
			className="grid gap-0.5"
			style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
		>
			{cells.map((cell) => (
				<div
					key={cell.id}
					title={`${cell.label}: ${cell.value}`}
					className="flex aspect-square flex-col items-center justify-center rounded-lg border text-xs"
					style={{
						backgroundColor: `color-mix(in srgb, ${color} ${Math.round((cell.value / max) * 70)}%, transparent)`
					}}
				>
					<span>{cell.label}</span>
					<span className="text-[0.65rem] text-[color:var(--theme-content-muted)]">
						{cell.value}
					</span>
				</div>
			))}
		</div>
	);
}

/** Two shares side by side as one balance bar, the left share filled. */
export function BalanceBar({
	left,
	right
}: {
	left: { label: string; share: number };
	right: { label: string; share: number };
}) {
	return (
		<div>
			<Surface variant="soft" padding="none" className="h-2 w-full overflow-hidden">
				<div
					className="h-full rounded-l-full bg-[color:var(--theme-accent)]/70 transition-all"
					style={{ width: `${left.share * 100}%` }}
				/>
			</Surface>
			<div className="mt-1 flex justify-between text-xs text-[color:var(--theme-content-muted)]">
				<span>
					{left.label} {percent(left.share)}
				</span>
				<span>
					{right.label} {percent(right.share)}
				</span>
			</div>
		</div>
	);
}
