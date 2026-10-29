import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Sparkles, X } from 'lucide-react';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/app/components/ui/accordion';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { HighlightText } from '@/app/components/ui/highlight-text';
import { Label } from '@/app/components/ui/label';
import { SearchField } from '@/app/components/ui/search-field';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { DetailSidePanel } from '@/app/components/detail-side-panel';

/**
 * Grouped multi-select list: search, per-group select-all (accordion layout), a count chip that
 * opens a side panel of the selection (jump to an item, remove it), and "clear all". Item
 * rendering and all copy come from the caller.
 */

export interface SelectionListItem {
	id: string;
	label: string;
	/** Extra strings the search also matches (alternative names, angles, …). */
	searchTerms?: readonly string[];
	/** Shown but not selectable (e.g. not supported by the engine). */
	disabled?: boolean;
}

export interface SelectionListGroup<T extends SelectionListItem> {
	id: string;
	label: string;
	items: T[];
}

export interface SelectionListLabels {
	search: string;
	clearSearch: string;
	selectedCount: (count: number) => string;
	clearAll: string;
	noResults: string;
	panelTitle: string;
	panelEmpty: string;
	panelEmptyHint?: string;
	remove: (label: string) => string;
}

/** Helpers passed to custom renderers. */
export interface SelectionListContext {
	query: string;
	highlight: (text: string) => ReactNode;
}

const matches = (item: SelectionListItem, query: string) => {
	const q = query.toLowerCase();
	return [item.label, ...(item.searchTerms ?? [])].some((term) => term.toLowerCase().includes(q));
};

export function SelectionList<T extends SelectionListItem>({
	groups,
	selectedIds,
	onSelectedIdsChange,
	labels,
	layout = 'accordion',
	collapsedGroupIds = [],
	renderItem,
	renderTrailing,
	renderGroupContent,
	renderPanelMeta,
	headerStart,
	footer
}: {
	groups: SelectionListGroup<T>[];
	selectedIds: readonly string[];
	onSelectedIdsChange: (ids: string[]) => void;
	labels: SelectionListLabels;
	/** `accordion`: collapsible groups with select-all; `sections`: plain headed sections. */
	layout?: 'accordion' | 'sections';
	/** Accordion groups closed initially (while no search is active). */
	collapsedGroupIds?: readonly string[];
	/** Row content after the checkbox; defaults to the highlighted label. */
	renderItem?: (item: T, context: SelectionListContext) => ReactNode;
	/** Control after the row's label area (outside the clickable label), e.g. a color input. */
	renderTrailing?: (item: T) => ReactNode;
	/** Replaces a group's rows (e.g. a non-selectable catalog with its own filters). */
	renderGroupContent?: (
		group: SelectionListGroup<T>,
		visibleItems: T[],
		context: SelectionListContext
	) => ReactNode | undefined;
	/** Extra text for an item in the selection panel. */
	renderPanelMeta?: (item: T) => ReactNode;
	headerStart?: ReactNode;
	footer?: ReactNode;
}) {
	const ft = useAppFormFieldTheme();
	const [query, setQuery] = useState('');
	// Closed rather than open groups are tracked, so groups that appear later start open.
	const [closedGroups, setClosedGroups] = useState<string[]>(() => [...collapsedGroupIds]);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelQuery, setPanelQuery] = useState('');
	const [highlighted, setHighlighted] = useState<string | null>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
	const trimmedQuery = query.trim();
	const context: SelectionListContext = {
		query: trimmedQuery,
		highlight: (text) => <HighlightText text={text} query={trimmedQuery} />
	};

	const visibleGroups = useMemo(
		() =>
			groups
				.map((group) => ({
					group,
					visible: trimmedQuery
						? group.items.filter((item) => matches(item, trimmedQuery))
						: group.items
				}))
				.filter(({ visible }) => visible.length > 0),
		[groups, trimmedQuery]
	);
	const openValues = visibleGroups
		.map(({ group }) => group.id)
		.filter((id) => trimmedQuery || !closedGroups.includes(id));
	const setOpenValues = (open: string[]) =>
		setClosedGroups(groups.map((group) => group.id).filter((id) => !open.includes(id)));

	const setSelection = (ids: readonly string[], checked: boolean) =>
		onSelectedIdsChange(
			checked
				? Array.from(new Set([...selectedIds, ...ids]))
				: selectedIds.filter((existing) => !ids.includes(existing))
		);

	const navigateTo = (item: T) => {
		setPanelOpen(false);
		const group = groups.find((candidate) => candidate.items.some((i) => i.id === item.id));
		if (group) setClosedGroups((prev) => prev.filter((id) => id !== group.id));
		setHighlighted(item.id);
		window.setTimeout(() => {
			itemRefs.current.get(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 80);
		window.setTimeout(() => setHighlighted(null), 2200);
	};

	const renderRow = (item: T) => {
		const isChecked = selected.has(item.id);
		return (
			<div
				key={item.id}
				ref={(el) => {
					if (el) itemRefs.current.set(item.id, el);
					else itemRefs.current.delete(item.id);
				}}
				className="flex items-center gap-2"
			>
				<Label
					htmlFor={`selection-${item.id}`}
					className={cn(
						'flex flex-1 items-center gap-2.5 rounded-md px-1 py-1 transition-colors',
						item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
						highlighted === item.id && 'ring-2 ring-[color:var(--theme-accent)]',
						isChecked && !item.disabled && 'bg-[color:var(--theme-soft-bg)]'
					)}
				>
					<Checkbox
						id={`selection-${item.id}`}
						checked={isChecked}
						disabled={item.disabled}
						onCheckedChange={(checked) => setSelection([item.id], checked === true)}
						className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
					/>
					{renderItem ? (
						renderItem(item, context)
					) : (
						<span className={cn('text-sm', ft.bodyText)}>{context.highlight(item.label)}</span>
					)}
				</Label>
				{!item.disabled && renderTrailing?.(item)}
			</div>
		);
	};

	const groupBody = (group: SelectionListGroup<T>, visible: T[]) =>
		renderGroupContent?.(group, visible, context) ?? (
			<div className="flex flex-col gap-1">{visible.map(renderRow)}</div>
		);

	const panelGroups = useMemo(() => {
		const q = panelQuery.trim();
		return groups
			.map((group) => ({
				group,
				items: group.items.filter((item) => selected.has(item.id) && (!q || matches(item, q)))
			}))
			.filter(({ items }) => items.length > 0);
	}, [groups, panelQuery, selected]);

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="p-6 md:p-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">{headerStart}</div>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setPanelOpen(true)}
							className="h-auto gap-2 rounded-full border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] px-3 py-1.5 text-sm text-[color:var(--theme-content-primary)]"
						>
							<Sparkles className="size-3.5 shrink-0" />
							{labels.selectedCount(selectedIds.length)}
						</Button>
						{selectedIds.length > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => onSelectedIdsChange([])}
								className={cn(
									'h-auto px-1 text-sm hover:bg-transparent hover:text-[color:var(--theme-content-primary)]',
									ft.muted
								)}
							>
								{labels.clearAll}
							</Button>
						)}
					</div>
				</div>

				<SearchField
					value={query}
					onValueChange={setQuery}
					placeholder={labels.search}
					clearLabel={labels.clearSearch}
					className="mb-6"
				/>

				{visibleGroups.length === 0 ? (
					<p className={cn('py-8 text-center text-sm', ft.muted)}>{labels.noResults}</p>
				) : layout === 'accordion' ? (
					<Accordion
						type="multiple"
						value={openValues}
						onValueChange={setOpenValues}
						className="w-full"
					>
						{visibleGroups.map(({ group, visible }) => {
							const selectable = group.items
								.filter((item) => !item.disabled)
								.map((item) => item.id);
							const selectedCount = selectable.filter((id) => selected.has(id)).length;
							const all = selectable.length > 0 && selectedCount === selectable.length;
							return (
								<AccordionItem
									key={group.id}
									value={group.id}
									className="border-b border-[color:var(--theme-panel-border)] last:border-0"
								>
									<div className="flex items-center gap-2.5">
										<Checkbox
											checked={all ? true : selectedCount > 0 ? 'indeterminate' : false}
											disabled={selectable.length === 0}
											onCheckedChange={(checked) => setSelection(selectable, checked === true)}
											aria-label={group.label}
											className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
										/>
										<AccordionTrigger className="flex-1 py-3 hover:no-underline">
											<span className={cn('text-sm font-semibold', ft.title)}>{group.label}</span>
											<span className={cn('ml-auto text-xs tabular-nums', ft.muted)}>
												{selectedCount}/{group.items.length}
											</span>
										</AccordionTrigger>
									</div>
									<AccordionContent className="pl-6">{groupBody(group, visible)}</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				) : (
					<div className="space-y-5">
						{visibleGroups.map(({ group, visible }) => (
							<div key={group.id}>
								<div
									className={cn(
										'mb-2 text-[11px] font-semibold tracking-widest uppercase',
										ft.muted
									)}
								>
									{group.label}
								</div>
								{groupBody(group, visible)}
							</div>
						))}
					</div>
				)}

				{footer}
			</CardContent>

			<DetailSidePanel
				open={panelOpen}
				onOpenChange={setPanelOpen}
				title={labels.panelTitle}
				description={labels.selectedCount(selectedIds.length)}
			>
				<div className="flex h-full min-h-0 flex-col gap-3">
					{selectedIds.length > 0 && (
						<SearchField
							value={panelQuery}
							onValueChange={setPanelQuery}
							placeholder={labels.search}
							clearLabel={labels.clearSearch}
							size="sm"
						/>
					)}
					<div className="min-h-0 flex-1 overflow-y-auto">
						{panelGroups.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
								<p className={cn('text-sm font-medium', ft.title)}>{labels.panelEmpty}</p>
								{labels.panelEmptyHint && (
									<p className={cn('max-w-[220px] text-xs', ft.muted)}>{labels.panelEmptyHint}</p>
								)}
							</div>
						) : (
							panelGroups.map(({ group, items }) => (
								<div key={group.id} className="mb-4">
									<div
										className={cn(
											'mb-1.5 text-[10px] font-semibold tracking-widest uppercase',
											ft.muted
										)}
									>
										{group.label}
									</div>
									{items.map((item) => (
										<div key={item.id} className="group flex items-center gap-2.5 py-1">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => navigateTo(item)}
												className={cn(
													'h-auto min-w-0 flex-1 justify-start truncate px-0 py-0.5 text-left text-sm font-normal hover:bg-transparent hover:text-[color:var(--theme-accent)]',
													ft.bodyText
												)}
											>
												{item.label}
											</Button>
											{renderPanelMeta && (
												<span className={cn('shrink-0 text-xs tabular-nums', ft.muted)}>
													{renderPanelMeta(item)}
												</span>
											)}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => setSelection([item.id], false)}
												aria-label={labels.remove(item.label)}
												className={cn(
													'hover:text-destructive size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
													ft.muted
												)}
											>
												<X className="size-3.5" />
											</Button>
										</div>
									))}
								</div>
							))
						)}
					</div>
				</div>
			</DetailSidePanel>
		</Card>
	);
}
