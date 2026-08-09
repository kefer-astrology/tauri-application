import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, X } from 'lucide-react';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import {
	OBSERVABLE_OBJECTS,
	OBSERVABLE_OBJECT_CATEGORY_LABELS,
	getObservableCategoryLabel,
	getObservableObjectLabel,
	type ObservableObjectCategory,
	type ObservableObjectDefinition
} from '@/lib/astrology/observableObjects';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DetailSidePanel } from './detail-side-panel';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

const PLANET_GLYPH_FALLBACK: Record<string, string> = {
	sun: '☉',
	moon: '☽',
	mercury: '☿',
	venus: '♀',
	mars: '♂',
	jupiter: '♃',
	saturn: '♄',
	uranus: '♅',
	neptune: '♆',
	pluto: '♇'
};

const CATEGORY_ORDER = Object.keys(OBSERVABLE_OBJECT_CATEGORY_LABELS) as ObservableObjectCategory[];

/** Categories collapsed by default — exotic/aspirational groups, mirroring the reference design. */
const COLLAPSED_BY_DEFAULT = new Set<ObservableObjectCategory>([
	'asteroids',
	'sensitive_points',
	'geocentric_nodes',
	'trans_neptunian',
	'fixed_stars',
	'hypothetical'
]);

type BodySelectorProps = {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	subtitleKey: string;
	selectedBodyIds: string[];
	onSelectedBodyIdsChange: (ids: string[]) => void;
};

function Highlight({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return <>{text}</>;
	return (
		<>
			{text.slice(0, idx)}
			<mark className="rounded-[2px] bg-[color:var(--theme-accent)]/25 text-inherit">
				{text.slice(idx, idx + query.length)}
			</mark>
			{text.slice(idx + query.length)}
		</>
	);
}

function matchesQuery(item: ObservableObjectDefinition, label: string, query: string): boolean {
	const q = query.toLowerCase();
	return (
		label.toLowerCase().includes(q) ||
		item.fallbackLabel.toLowerCase().includes(q) ||
		(item.altName?.toLowerCase().includes(q) ?? false)
	);
}

export function BodySelector({
	theme,
	glyphSet,
	subtitleKey,
	selectedBodyIds,
	onSelectedBodyIdsChange
}: BodySelectorProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [query, setQuery] = useState('');
	const [manualOpen, setManualOpen] = useState<string[]>(
		CATEGORY_ORDER.filter((category) => !COLLAPSED_BY_DEFAULT.has(category))
	);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelQuery, setPanelQuery] = useState('');
	const [highlighted, setHighlighted] = useState<string | null>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const selected = useMemo(() => new Set(selectedBodyIds), [selectedBodyIds]);
	const labelFor = (item: ObservableObjectDefinition) => getObservableObjectLabel(item, t);

	const byCategory = useMemo(() => {
		const map = new Map<ObservableObjectCategory, ObservableObjectDefinition[]>();
		for (const item of OBSERVABLE_OBJECTS) {
			if (!map.has(item.category)) map.set(item.category, []);
			map.get(item.category)!.push(item);
		}
		return map;
	}, []);

	const trimmedQuery = query.trim();

	const groups = useMemo(
		() =>
			CATEGORY_ORDER.map((category) => {
				const items = byCategory.get(category) ?? [];
				const filtered = trimmedQuery
					? items.filter((item) => matchesQuery(item, labelFor(item), trimmedQuery))
					: items;
				const availableIds = items
					.filter((item) => item.status === 'available')
					.map((item) => item.id);
				const selectedCount = availableIds.filter((id) => selected.has(id)).length;
				return { category, items, filtered, availableIds, selectedCount };
			}).filter((group) => group.filtered.length > 0),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[byCategory, trimmedQuery, selected, t]
	);

	const openValues = trimmedQuery ? groups.map((group) => group.category) : manualOpen;

	function setBodySelection(id: string, checked: boolean) {
		const next = checked
			? Array.from(new Set([...selectedBodyIds, id]))
			: selectedBodyIds.filter((existing) => existing !== id);
		onSelectedBodyIdsChange(next);
	}

	function setGroupSelection(ids: string[], checked: boolean) {
		const next = checked
			? Array.from(new Set([...selectedBodyIds, ...ids]))
			: selectedBodyIds.filter((existing) => !ids.includes(existing));
		onSelectedBodyIdsChange(next);
	}

	function navigateTo(id: string, category: ObservableObjectCategory) {
		setPanelOpen(false);
		if (!manualOpen.includes(category)) {
			setManualOpen((prev) => [...prev, category]);
		}
		setHighlighted(id);
		window.setTimeout(() => {
			itemRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 80);
		window.setTimeout(() => setHighlighted(null), 2200);
	}

	const selectedItems = useMemo(
		() => OBSERVABLE_OBJECTS.filter((item) => selected.has(item.id)),
		[selected]
	);
	const panelGroups = useMemo(() => {
		const q = panelQuery.trim().toLowerCase();
		const filtered = q
			? selectedItems.filter(
					(item) =>
						labelFor(item).toLowerCase().includes(q) ||
						(item.altName?.toLowerCase().includes(q) ?? false)
				)
			: selectedItems;
		const map = new Map<ObservableObjectCategory, ObservableObjectDefinition[]>();
		for (const item of filtered) {
			if (!map.has(item.category)) map.set(item.category, []);
			map.get(item.category)!.push(item);
		}
		return CATEGORY_ORDER.map((category) => ({ category, items: map.get(category) ?? [] })).filter(
			(group) => group.items.length > 0
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedItems, panelQuery, t]);

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="p-6 md:p-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<p className={cn('text-sm', ft.muted)}>{t(subtitleKey)}</p>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => setPanelOpen(true)}
							className={cn(
								'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
								'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] text-[color:var(--theme-content-primary)]',
								'hover:brightness-95'
							)}
						>
							<Sparkles className="h-3.5 w-3.5 shrink-0" />
							{t('aspectarium_selected_count', { count: selectedBodyIds.length })}
						</button>
						{selectedBodyIds.length > 0 && (
							<button
								type="button"
								onClick={() => onSelectedBodyIdsChange([])}
								className={cn(
									'text-sm',
									ft.muted,
									'hover:text-[color:var(--theme-content-primary)]'
								)}
							>
								{t('aspectarium_clear_all')}
							</button>
						)}
					</div>
				</div>

				<div
					className={cn(
						'mb-6 flex items-center gap-3 rounded-xl border px-4 py-2.5',
						'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] backdrop-blur-sm'
					)}
				>
					<Search className={cn('h-4 w-4 shrink-0', ft.iconColor)} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t('aspectarium_search_planets')}
						className={cn(
							'flex-1 bg-transparent text-sm focus:outline-none',
							ft.bodyText,
							'placeholder:text-[color:var(--theme-content-muted)]'
						)}
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery('')}
							className={cn(ft.muted, 'hover:text-[color:var(--theme-content-primary)]')}
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{groups.length === 0 ? (
					<p className={cn('py-8 text-center text-sm', ft.muted)}>{t('open_search_no_results')}</p>
				) : (
					<Accordion
						type="multiple"
						value={openValues}
						onValueChange={setManualOpen}
						className="w-full"
					>
						{groups.map(({ category, filtered, availableIds, selectedCount, items }) => {
							const groupChecked = availableIds.length > 0 && selectedCount === availableIds.length;
							const groupIndeterminate = selectedCount > 0 && selectedCount < availableIds.length;

							return (
								<AccordionItem
									key={category}
									value={category}
									className="border-b border-[color:var(--theme-panel-border)] last:border-0"
								>
									<div className="flex items-center gap-2.5">
										<Checkbox
											checked={groupChecked ? true : groupIndeterminate ? 'indeterminate' : false}
											disabled={availableIds.length === 0}
											onCheckedChange={(checked) =>
												setGroupSelection(availableIds, checked === true)
											}
											className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
										/>
										<AccordionTrigger className="flex-1 py-3 hover:no-underline">
											<span className={cn('text-sm font-semibold', ft.title)}>
												{getObservableCategoryLabel(category, t)}
											</span>
											<span className={cn('ml-auto text-xs tabular-nums', ft.muted)}>
												{selectedCount}/{items.length}
											</span>
										</AccordionTrigger>
									</div>
									<AccordionContent className="pl-6">
										{category === 'fixed_stars' ? (
											<div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3">
												{filtered.map((item) => (
													<span
														key={item.id}
														title={t('transits_body_unsupported_hint')}
														className={cn(
															'cursor-not-allowed truncate text-sm opacity-50',
															ft.bodyText
														)}
													>
														<Highlight text={labelFor(item)} query={trimmedQuery} />
														{item.altName && (
															<span className={cn('ml-1 text-xs italic', ft.muted)}>
																({item.altName})
															</span>
														)}
													</span>
												))}
											</div>
										) : (
											<div className="flex flex-col gap-2">
												{filtered.map((item) => {
													const isPlanned = item.status === 'planned';
													const isChecked = selected.has(item.id);
													return (
														<div
															key={item.id}
															ref={(el) => {
																if (el) itemRefs.current.set(item.id, el);
																else itemRefs.current.delete(item.id);
															}}
														>
															<Label
																htmlFor={`body-${item.id}`}
																className={cn(
																	'flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors',
																	isPlanned ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
																	highlighted === item.id &&
																		'ring-2 ring-[color:var(--theme-accent)]',
																	isChecked && !isPlanned && 'bg-[color:var(--theme-soft-bg)]'
																)}
															>
																<Checkbox
																	id={`body-${item.id}`}
																	checked={isChecked}
																	disabled={isPlanned}
																	onCheckedChange={(checked) =>
																		setBodySelection(item.id, checked === true)
																	}
																	className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
																/>
																<AstrologyGlyph
																	glyphId={item.id}
																	glyphSet={glyphSet}
																	fallback={PLANET_GLYPH_FALLBACK[item.id] ?? item.icon}
																	size={16}
																	className={cn('shrink-0', ft.iconColor)}
																/>
																<span className={cn('text-sm', ft.bodyText)}>
																	<Highlight text={labelFor(item)} query={trimmedQuery} />
																</span>
																{item.altName && (
																	<span className={cn('truncate text-xs italic', ft.muted)}>
																		<Highlight text={item.altName} query={trimmedQuery} />
																	</span>
																)}
																{isPlanned && (
																	<span className={cn('text-xs italic', ft.muted)}>
																		({t('transits_body_unsupported_hint')})
																	</span>
																)}
															</Label>
														</div>
													);
												})}
											</div>
										)}
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				)}
			</CardContent>

			<DetailSidePanel
				theme={theme}
				open={panelOpen}
				onOpenChange={setPanelOpen}
				title={t('dashboard_positions_picker_title')}
				description={t('aspectarium_selected_count', { count: selectedBodyIds.length })}
			>
				<div className="flex h-full min-h-0 flex-col gap-3">
					{selectedBodyIds.length > 0 && (
						<div
							className={cn(
								'flex items-center gap-2 rounded-lg px-3 py-2',
								'bg-[color:var(--theme-soft-bg)]'
							)}
						>
							<Search className={cn('h-3.5 w-3.5 shrink-0', ft.iconColor)} />
							<input
								value={panelQuery}
								onChange={(event) => setPanelQuery(event.target.value)}
								placeholder={t('aspectarium_search_planets')}
								className={cn(
									'flex-1 bg-transparent text-xs focus:outline-none',
									ft.bodyText,
									'placeholder:text-[color:var(--theme-content-muted)]'
								)}
							/>
						</div>
					)}
					<div className="min-h-0 flex-1 overflow-y-auto">
						{panelGroups.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
								<p className={cn('text-sm font-medium', ft.title)}>{t('dashboard_no_positions')}</p>
							</div>
						) : (
							panelGroups.map(({ category, items }) => (
								<div key={category} className="mb-4">
									<div
										className={cn(
											'mb-1.5 text-[10px] font-semibold tracking-widest uppercase',
											ft.muted
										)}
									>
										{getObservableCategoryLabel(category, t)}
									</div>
									{items.map((item) => (
										<div key={item.id} className="group flex items-center gap-2.5 py-1.5">
											<button
												type="button"
												onClick={() => navigateTo(item.id, item.category)}
												className={cn(
													'min-w-0 flex-1 truncate text-left text-sm',
													ft.bodyText,
													'hover:text-[color:var(--theme-accent)]'
												)}
											>
												{labelFor(item)}
											</button>
											<button
												type="button"
												onClick={() => setBodySelection(item.id, false)}
												className={cn(
													'shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
													ft.muted,
													'hover:text-destructive'
												)}
											>
												<X className="h-3.5 w-3.5" />
											</button>
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
