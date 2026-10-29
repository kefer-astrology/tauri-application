import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { SearchField } from '@/app/components/ui/search-field';

export type MultiSelectPopoverItem = {
	id: string;
	label: string;
	icon?: ReactNode;
	color?: string;
};

export interface MultiSelectPopoverLabels {
	/** Trigger text when everything is selected. */
	all: string;
	/** Trigger text when nothing is selected. */
	none: string;
	selectedCount: (count: number) => string;
	search: string;
	clearSearch: string;
	selectAll: string;
	clearAll: string;
	noResults: string;
}

/** Compact multi-select: a button that opens a searchable checklist with select-all / clear. */
export function MultiSelectPopover({
	items,
	selected,
	onSelectedChange,
	labels
}: {
	items: readonly MultiSelectPopoverItem[];
	selected: ReadonlySet<string>;
	onSelectedChange: (selected: Set<string>) => void;
	labels: MultiSelectPopoverLabels;
}) {
	const [query, setQuery] = useState('');
	const q = query.trim().toLocaleLowerCase();
	const visible = items.filter((item) => item.label.toLocaleLowerCase().includes(q));
	const selectedCount = items.filter((item) => selected.has(item.id)).length;
	const triggerLabel =
		selectedCount === 0
			? labels.none
			: selectedCount === items.length
				? labels.all
				: labels.selectedCount(selectedCount);

	const toggle = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onSelectedChange(next);
	};

	return (
		<Popover onOpenChange={(open) => !open && setQuery('')}>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
					<span className="max-w-40 truncate">{triggerLabel}</span>
					<ChevronDown className="size-3.5 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-0">
				<div className="border-b border-[color:var(--theme-panel-border)] p-2">
					<SearchField
						value={query}
						onValueChange={setQuery}
						placeholder={labels.search}
						clearLabel={labels.clearSearch}
						size="sm"
					/>
				</div>
				<div className="grid grid-cols-2 border-b border-[color:var(--theme-panel-border)]">
					<Button
						type="button"
						variant="ghost"
						className="h-8 rounded-none text-xs"
						onClick={() => onSelectedChange(new Set(items.map((item) => item.id)))}
					>
						{labels.selectAll}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-8 rounded-none border-l border-[color:var(--theme-panel-border)] text-xs"
						onClick={() => onSelectedChange(new Set())}
					>
						{labels.clearAll}
					</Button>
				</div>
				<div className="max-h-64 overflow-y-auto p-1">
					{visible.length === 0 ? (
						<p className="px-3 py-5 text-center text-xs text-[color:var(--theme-content-muted)]">
							{labels.noResults}
						</p>
					) : (
						visible.map((item) => (
							<Label
								key={item.id}
								className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-[color:var(--theme-soft-bg)]"
							>
								<Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
								{item.icon !== undefined && (
									<span
										className="flex size-5 items-center justify-center text-base"
										style={{ color: item.color }}
									>
										{item.icon}
									</span>
								)}
								<span className="min-w-0 truncate">{item.label}</span>
							</Label>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
