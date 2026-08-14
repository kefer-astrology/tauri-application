import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, X } from 'lucide-react';
import { ASPECT_GLYPHS, ASPECT_ROWS, type AspectRowId } from '@/lib/astrology/aspects';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { DetailSidePanel } from './detail-side-panel';
import { HighlightText } from './highlight-text';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

type AspectSelectorProps = {
	theme: Theme;
	selectedAspectIds: string[];
	onSelectedAspectIdsChange: (ids: string[]) => void;
};

type ViewMode = 'type' | 'harmonic';

const PRESETS: { key: string; aspectIds: AspectRowId[] }[] = [
	{
		key: 'traditional',
		aspectIds: ['conjunction', 'sextile', 'square', 'trine', 'opposition']
	},
	{
		key: 'modern',
		aspectIds: [
			'conjunction',
			'sextile',
			'square',
			'trine',
			'opposition',
			'quincunx',
			'semisextile',
			'semisquare',
			'sesquiquadrate'
		]
	},
	{ key: 'transits', aspectIds: ['conjunction', 'sextile', 'square', 'trine', 'opposition'] },
	{ key: 'stars', aspectIds: ['conjunction'] },
	{
		key: 'harmonic',
		aspectIds: ['quintile', 'biquintile', 'septile', 'novile', 'binovile', 'quadrinovile']
	}
];

function formatDegree(angle: number): string {
	const rounded = Math.round(angle * 100) / 100;
	if (Number.isInteger(rounded)) return `${rounded}°`;
	const whole = Math.floor(rounded);
	const minutes = Math.round((rounded - whole) * 60);
	return `${whole}°${minutes.toString().padStart(2, '0')}'`;
}

export function AspectSelector({
	theme,
	selectedAspectIds,
	onSelectedAspectIdsChange
}: AspectSelectorProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [query, setQuery] = useState('');
	const [viewMode, setViewMode] = useState<ViewMode>('type');
	const [openHarmonics, setOpenHarmonics] = useState<string[]>(() =>
		Array.from(new Set(ASPECT_ROWS.map((row) => `h${row.harmonic}`)))
	);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelQuery, setPanelQuery] = useState('');
	const [highlighted, setHighlighted] = useState<string | null>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const selected = useMemo(() => new Set(selectedAspectIds), [selectedAspectIds]);
	const trimmedQuery = query.trim();

	const labelFor = (row: (typeof ASPECT_ROWS)[number]) => t(row.labelKey);

	const matchesQuery = (row: (typeof ASPECT_ROWS)[number]) => {
		if (!trimmedQuery) return true;
		const q = trimmedQuery.toLowerCase();
		return (
			labelFor(row).toLowerCase().includes(q) ||
			formatDegree(row.angle).toLowerCase().includes(q) ||
			t('transits_aspects_harmonic_series', { n: row.harmonic }).toLowerCase().includes(q)
		);
	};

	const majorRows = useMemo(
		() => ASPECT_ROWS.filter((row) => row.type === 'major' && matchesQuery(row)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[trimmedQuery, t]
	);
	const minorRows = useMemo(
		() => ASPECT_ROWS.filter((row) => row.type === 'minor' && matchesQuery(row)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[trimmedQuery, t]
	);

	const harmonicGroups = useMemo(() => {
		const byHarmonic = new Map<number, (typeof ASPECT_ROWS)[number][]>();
		for (const row of ASPECT_ROWS) {
			if (!byHarmonic.has(row.harmonic)) byHarmonic.set(row.harmonic, []);
			byHarmonic.get(row.harmonic)!.push(row);
		}
		return Array.from(byHarmonic.entries())
			.sort(([a], [b]) => a - b)
			.map(([harmonic, rows]) => ({
				harmonic,
				value: `h${harmonic}`,
				rows: rows.filter(matchesQuery)
			}))
			.filter((group) => group.rows.length > 0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [trimmedQuery, t]);

	const harmonicOpenValues = trimmedQuery
		? harmonicGroups.map((group) => group.value)
		: openHarmonics;

	function toggleAspect(id: string, checked: boolean) {
		const next = checked
			? Array.from(new Set([...selectedAspectIds, id]))
			: selectedAspectIds.filter((existing) => existing !== id);
		onSelectedAspectIdsChange(next);
	}

	function applyPreset(aspectIds: string[]) {
		onSelectedAspectIdsChange(aspectIds);
	}

	function navigateTo(id: string) {
		setPanelOpen(false);
		setViewMode('type');
		setHighlighted(id);
		window.setTimeout(() => {
			itemRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 80);
		window.setTimeout(() => setHighlighted(null), 2200);
	}

	const renderRow = (row: (typeof ASPECT_ROWS)[number]) => {
		const isChecked = selected.has(row.id);
		return (
			<div
				key={row.id}
				ref={(el) => {
					if (el) itemRefs.current.set(row.id, el);
					else itemRefs.current.delete(row.id);
				}}
			>
				<Label
					htmlFor={`aspect-${row.id}`}
					className={cn(
						'flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors',
						highlighted === row.id && 'ring-2 ring-[color:var(--theme-accent)]',
						isChecked && 'bg-[color:var(--theme-soft-bg)]'
					)}
				>
					<Checkbox
						id={`aspect-${row.id}`}
						checked={isChecked}
						onCheckedChange={(checked) => toggleAspect(row.id, checked === true)}
						className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
					/>
					<span className={cn('w-8 shrink-0 text-center text-xs', ft.muted)}>
						{ASPECT_GLYPHS[row.id] ?? '•'}
					</span>
					<span className={cn('flex-1 text-sm', ft.bodyText)}>
						<HighlightText text={labelFor(row)} query={trimmedQuery} />
					</span>
					<span className={cn('w-16 shrink-0 text-right text-xs tabular-nums', ft.muted)}>
						{formatDegree(row.angle)}
					</span>
					{row.type === 'minor' && (
						<span className={cn('w-32 shrink-0 text-right text-xs', ft.muted)}>
							{t('transits_aspects_harmonic_series', { n: row.harmonic })}
						</span>
					)}
				</Label>
			</div>
		);
	};

	const selectedRows = useMemo(() => ASPECT_ROWS.filter((row) => selected.has(row.id)), [selected]);
	const panelGroups = useMemo(() => {
		const q = panelQuery.trim().toLowerCase();
		const filtered = q
			? selectedRows.filter((row) => labelFor(row).toLowerCase().includes(q))
			: selectedRows;
		return [
			{
				key: 'major',
				labelKey: 'transits_aspects_major',
				rows: filtered.filter((r) => r.type === 'major')
			},
			{
				key: 'minor',
				labelKey: 'transits_aspects_minor',
				rows: filtered.filter((r) => r.type === 'minor')
			}
		].filter((group) => group.rows.length > 0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedRows, panelQuery, t]);

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="p-6 md:p-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						<span className={cn('text-xs font-medium', ft.muted)}>
							{t('transits_aspects_view_label')}
						</span>
						<div
							className={cn(
								'flex rounded-lg border p-0.5',
								'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)]'
							)}
						>
							{(['type', 'harmonic'] as const).map((mode) => (
								<button
									key={mode}
									type="button"
									onClick={() => setViewMode(mode)}
									className={cn(
										'rounded-md px-3 py-1 text-xs font-medium transition-all',
										viewMode === mode
											? 'bg-[color:var(--theme-panel-bg)] shadow-sm'
											: 'hover:brightness-95',
										ft.bodyText
									)}
								>
									{mode === 'type'
										? t('transits_aspects_view_type')
										: t('transits_aspects_view_harmonic')}
								</button>
							))}
						</div>
					</div>
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
							{t('aspectarium_selected_count', { count: selectedAspectIds.length })}
						</button>
						{selectedAspectIds.length > 0 && (
							<button
								type="button"
								onClick={() => onSelectedAspectIdsChange([])}
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
						placeholder={t('aspectarium_search_aspects')}
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

				{viewMode === 'type' ? (
					<div className="space-y-5">
						{majorRows.length > 0 && (
							<div>
								<div
									className={cn(
										'mb-2 text-[11px] font-semibold tracking-widest uppercase',
										ft.muted
									)}
								>
									{t('transits_aspects_major')}
								</div>
								<div className="flex flex-col gap-1">{majorRows.map(renderRow)}</div>
							</div>
						)}
						{minorRows.length > 0 && (
							<div>
								<div
									className={cn(
										'mb-2 text-[11px] font-semibold tracking-widest uppercase',
										ft.muted
									)}
								>
									{t('transits_aspects_minor')}
								</div>
								<div className="flex flex-col gap-1">{minorRows.map(renderRow)}</div>
							</div>
						)}
						{majorRows.length === 0 && minorRows.length === 0 && (
							<p className={cn('py-8 text-center text-sm', ft.muted)}>
								{t('open_search_no_results')}
							</p>
						)}
					</div>
				) : (
					<Accordion
						type="multiple"
						value={harmonicOpenValues}
						onValueChange={setOpenHarmonics}
						className="w-full"
					>
						{harmonicGroups.map((group) => (
							<AccordionItem
								key={group.value}
								value={group.value}
								className="border-b border-[color:var(--theme-panel-border)] last:border-0"
							>
								<AccordionTrigger className="py-2.5 hover:no-underline">
									<span className={cn('text-xs font-semibold tracking-widest uppercase', ft.muted)}>
										{t('transits_aspects_harmonic_series', { n: group.harmonic })}
									</span>
									<span className={cn('ml-auto text-xs tabular-nums', ft.muted)}>
										{group.rows.filter((row) => selected.has(row.id)).length}/{group.rows.length}
									</span>
								</AccordionTrigger>
								<AccordionContent className="flex flex-col gap-1 pl-3">
									{group.rows.map(renderRow)}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				)}

				<Accordion
					type="single"
					collapsible
					className="mt-6 w-full border-t border-[color:var(--theme-panel-border)] pt-2"
				>
					<AccordionItem value="presets" className="border-0">
						<AccordionTrigger className="py-2.5 hover:no-underline">
							<span className={cn('text-sm font-semibold', ft.title)}>
								{t('transits_aspects_presets_title')}
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<div className="divide-y divide-[color:var(--theme-panel-border)]">
								{PRESETS.map((preset) => (
									<div key={preset.key} className="flex items-center justify-between gap-4 py-3">
										<div>
											<div className={cn('text-sm font-medium', ft.bodyText)}>
												{t(`transits_aspects_preset_${preset.key}_name`)}
											</div>
											<div className={cn('mt-0.5 text-xs', ft.muted)}>
												{t(`transits_aspects_preset_${preset.key}_desc`)}
											</div>
										</div>
										<button
											type="button"
											onClick={() => applyPreset(preset.aspectIds)}
											className={cn(
												'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-95',
												ft.iconColor
											)}
										>
											{t('transits_aspects_apply_preset')}
										</button>
									</div>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</CardContent>

			<DetailSidePanel
				theme={theme}
				open={panelOpen}
				onOpenChange={setPanelOpen}
				title={t('transits_aspects_panel_title')}
				description={t('aspectarium_selected_count', { count: selectedAspectIds.length })}
			>
				<div className="flex h-full min-h-0 flex-col gap-3">
					{selectedAspectIds.length > 0 && (
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
								placeholder={t('aspectarium_search_aspects')}
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
							<div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
								<p className={cn('text-sm font-medium', ft.title)}>
									{t('transits_aspects_empty_title')}
								</p>
								<p className={cn('max-w-[220px] text-xs', ft.muted)}>
									{t('transits_aspects_empty_hint')}
								</p>
							</div>
						) : (
							panelGroups.map((group) => (
								<div key={group.key} className="mb-4">
									<div
										className={cn(
											'mb-1.5 text-[10px] font-semibold tracking-widest uppercase',
											ft.muted
										)}
									>
										{t(group.labelKey)}
									</div>
									{group.rows.map((row) => (
										<div key={row.id} className="group flex items-center gap-2.5 py-1.5">
											<button
												type="button"
												onClick={() => navigateTo(row.id)}
												className={cn(
													'min-w-0 flex-1 truncate text-left text-sm',
													ft.bodyText,
													'hover:text-[color:var(--theme-accent)]'
												)}
											>
												{labelFor(row)}
											</button>
											<span className={cn('shrink-0 text-xs tabular-nums', ft.muted)}>
												{formatDegree(row.angle)}
											</span>
											<button
												type="button"
												onClick={() => toggleAspect(row.id, false)}
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
