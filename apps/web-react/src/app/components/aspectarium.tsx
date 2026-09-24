import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Grid3X3, List, Search } from 'lucide-react';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableRow } from './ui/table';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Theme } from './astrology-sidebar';
import { DetailSidePanel } from './detail-side-panel';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import {
	DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS,
	DEFAULT_OBSERVABLE_OBJECT_IDS
} from '@/lib/astrology/observableObjects';
import {
	ASPECT_GLYPHS,
	ASPECT_ROWS,
	DEFAULT_ASPECT_COLORS,
	DEFAULT_ENABLED_ASPECT_IDS
} from '@/lib/astrology/aspects';
import { signIndexToZodiacId, type AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { normalizeLongitude } from '@/lib/astrology/chartSearch';
import { aspectLabel, objectIcon, objectLabel } from '@/lib/astrology/objectLabels';
import { parseComputedAspect, type ParsedAspect } from '@/lib/astrology/aspectParsing';
import { buildObjectDetailViewModel } from '@/lib/astrology/objectDetail';
import { AspectDetailPanel } from './aspect-detail-panel';

interface AspectariumProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	workspaceDefaults: WorkspaceDefaultsState;
}

type AspectLayer = 'radix' | 'transit';
type AspectariumView = 'table' | 'list';
type OrbPreset = 'default' | 'tight' | 'normal' | 'wide' | 'custom';

interface AspectEntry {
	id: string;
	aspect: ParsedAspect;
	fromLayer: AspectLayer;
	toLayer: AspectLayer;
}

const ZODIAC_UNICODE_FALLBACK = [
	'♈',
	'♉',
	'♊',
	'♋',
	'♌',
	'♍',
	'♎',
	'♏',
	'♐',
	'♑',
	'♒',
	'♓'
] as const;

const ORB_PRESETS: Array<{ id: OrbPreset; labelKey: string; maxOrb: number }> = [
	{ id: 'default', labelKey: 'aspectarium_orb_default', maxOrb: 5 },
	{ id: 'tight', labelKey: 'aspectarium_orb_tight', maxOrb: 1 },
	{ id: 'normal', labelKey: 'aspectarium_orb_normal', maxOrb: 3 },
	{ id: 'wide', labelKey: 'aspectarium_orb_wide', maxOrb: 8 },
	{ id: 'custom', labelKey: 'aspectarium_orb_custom', maxOrb: 5 }
];

function canonicalPairKey(idA: string, idB: string, orderIndex: Map<string, number>) {
	const idxA = orderIndex.get(idA) ?? Number.MAX_SAFE_INTEGER;
	const idxB = orderIndex.get(idB) ?? Number.MAX_SAFE_INTEGER;
	return idxA <= idxB ? `${idA}::${idB}` : `${idB}::${idA}`;
}

function directionalPairKey(from: string, to: string) {
	return `${from}::${to}`;
}

function aspectIdentity(aspect: ParsedAspect, orderIndex: Map<string, number>, layer: AspectLayer) {
	return layer === 'transit'
		? `transit::${directionalPairKey(aspect.from, aspect.to)}::${aspect.type}`
		: `radix::${canonicalPairKey(aspect.from, aspect.to, orderIndex)}::${aspect.type}`;
}

function formatOrb(orb: number | undefined) {
	if (!Number.isFinite(orb)) return null;
	return `${Math.abs(orb!).toFixed(2)}°`;
}

function positionParts(longitude: number | null) {
	if (longitude === null) return null;
	const normalized = ((longitude % 360) + 360) % 360;
	const signIndex = Math.floor(normalized / 30) % 12;
	const withinSign = normalized % 30;
	const totalMinutes = Math.round(withinSign * 60);
	const degrees = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return {
		zodiacId: signIndexToZodiacId(signIndex),
		fallback: ZODIAC_UNICODE_FALLBACK[signIndex] ?? '♈',
		text: `${degrees}°${String(minutes).padStart(2, '0')}′`
	};
}

function BodyGlyph({
	bodyId,
	glyphSet,
	className,
	size = 20
}: {
	bodyId: string;
	glyphSet: AstrologyGlyphSetId;
	className?: string;
	size?: number;
}) {
	const fallback = objectIcon(bodyId);

	return (
		<AstrologyGlyph
			glyphId={bodyId}
			glyphSet={glyphSet}
			fallback={fallback}
			size={size}
			className={className}
			title={fallback}
		/>
	);
}

function PositionValue({
	longitude,
	glyphSet
}: {
	longitude: number | null;
	glyphSet: AstrologyGlyphSetId;
}) {
	const position = positionParts(longitude);
	if (!position) return null;

	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<AstrologyGlyph
				glyphId={position.zodiacId}
				glyphSet={glyphSet}
				domain="zodiac"
				fallback={position.fallback}
				size={13}
			/>
			<span>{position.text}</span>
		</span>
	);
}

function AspectCellButton({
	aspect,
	glyphSet,
	isSelected,
	onSelect,
	color
}: {
	aspect: ParsedAspect;
	glyphSet: AstrologyGlyphSetId;
	isSelected: boolean;
	onSelect: () => void;
	color: string;
}) {
	return (
		<Button
			type="button"
			onClick={onSelect}
			variant="ghost"
			className={cn(
				'flex aspect-square min-h-14 w-full min-w-14 flex-col items-center justify-center rounded-none px-1.5 py-1 transition-colors',
				isSelected
					? 'bg-[color:var(--theme-selected-bg)] ring-1 ring-[color:var(--theme-accent)] ring-inset'
					: 'bg-transparent hover:bg-[color:var(--theme-soft-bg)]'
			)}
			aria-pressed={isSelected}
		>
			<span className="text-lg leading-none" style={{ color }}>
				<AstrologyGlyph
					glyphId={aspect.type}
					glyphSet={glyphSet}
					domain="aspect"
					fallback={ASPECT_GLYPHS[aspect.type] ?? '•'}
					size={18}
				/>
			</span>
			<span className="mt-1 text-[11px] text-[color:var(--theme-content-muted)]">
				{formatOrb(aspect.orb)}
			</span>
		</Button>
	);
}

type FilterItem = { id: string; label: string; icon: ReactNode; color?: string };

function MultiSelectFilter({
	items,
	selected,
	label,
	noneLabel,
	selectedLabel,
	searchPlaceholder,
	selectAllLabel,
	clearAllLabel,
	noResultsLabel,
	inputClassName,
	onChange
}: {
	items: FilterItem[];
	selected: Set<string>;
	label: string;
	noneLabel: string;
	selectedLabel: (count: number) => string;
	searchPlaceholder: string;
	selectAllLabel: string;
	clearAllLabel: string;
	noResultsLabel: string;
	inputClassName: string;
	onChange: (next: Set<string>) => void;
}) {
	const [query, setQuery] = useState('');
	const filteredItems = items.filter((item) =>
		item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
	);
	const selectedCount = items.filter((item) => selected.has(item.id)).length;
	const triggerLabel =
		selectedCount === 0
			? noneLabel
			: selectedCount === items.length
				? label
				: selectedLabel(selectedCount);

	return (
		<Popover onOpenChange={(open) => !open && setQuery('')}>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
					<span className="max-w-40 truncate">{triggerLabel}</span>
					<ChevronDown className="size-3.5 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-0">
				<div className="relative border-b border-[color:var(--theme-panel-border)] p-2">
					<Search className="absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-[color:var(--theme-content-muted)]" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
						className={cn(inputClassName, 'h-8 pl-8')}
					/>
				</div>
				<div className="grid grid-cols-2 border-b border-[color:var(--theme-panel-border)]">
					<Button
						type="button"
						variant="ghost"
						className="h-8 rounded-none text-xs"
						onClick={() => onChange(new Set(items.map((item) => item.id)))}
					>
						{selectAllLabel}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-8 rounded-none border-l border-[color:var(--theme-panel-border)] text-xs"
						onClick={() => onChange(new Set())}
					>
						{clearAllLabel}
					</Button>
				</div>
				<div className="max-h-64 overflow-y-auto p-1">
					{filteredItems.length === 0 ? (
						<p className="px-3 py-5 text-center text-xs text-[color:var(--theme-content-muted)]">
							{noResultsLabel}
						</p>
					) : (
						filteredItems.map((item) => (
							<Label
								key={item.id}
								className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-[color:var(--theme-soft-bg)]"
							>
								<Checkbox
									checked={selected.has(item.id)}
									onCheckedChange={() => {
										const next = new Set(selected);
										if (next.has(item.id)) next.delete(item.id);
										else next.add(item.id);
										onChange(next);
									}}
								/>
								<span
									className="flex size-5 items-center justify-center text-base"
									style={{ color: item.color }}
								>
									{item.icon}
								</span>
								<span className="min-w-0 truncate">{item.label}</span>
							</Label>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function Aspectarium({ theme, glyphSet, workspaceDefaults }: AspectariumProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const { selectedChart, transitOverlay } = useWorkspaceCharts();
	const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null);
	const [view, setView] = useState<AspectariumView>('table');
	const [selectedBodyIds, setSelectedBodyIds] = useState<Set<string>>(
		() =>
			new Set(
				workspaceDefaults.defaultBodies.length > 0
					? workspaceDefaults.defaultBodies
					: DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS
			)
	);
	const [selectedAspectTypes, setSelectedAspectTypes] = useState<Set<string>>(
		() =>
			new Set(
				workspaceDefaults.defaultAspects.length > 0
					? workspaceDefaults.defaultAspects
					: DEFAULT_ENABLED_ASPECT_IDS
			)
	);
	const [orbPreset, setOrbPreset] = useState<OrbPreset>('default');

	useEffect(() => {
		setSelectedBodyIds(
			new Set(
				workspaceDefaults.defaultBodies.length > 0
					? workspaceDefaults.defaultBodies
					: DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS
			)
		);
	}, [workspaceDefaults.defaultBodies]);

	useEffect(() => {
		setSelectedAspectTypes(
			new Set(
				workspaceDefaults.defaultAspects.length > 0
					? workspaceDefaults.defaultAspects
					: DEFAULT_ENABLED_ASPECT_IDS
			)
		);
	}, [workspaceDefaults.defaultAspects]);

	const positions = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
	const motion = selectedChart?.computed?.motion ?? {};
	// Chart-wide only: Rust records which shapes/configurations the whole chart has, not which
	// bodies belong to each one (see the radix wheel's own object-detail panel for the same note).
	const chartShapeIds = selectedChart?.computed?.shapes ?? [];
	const chartConfigurationIds = selectedChart?.computed?.configurations ?? [];
	const activeTransitOverlay =
		transitOverlay && transitOverlay.sourceChartId === selectedChart?.id ? transitOverlay : null;
	const transitPositions = (activeTransitOverlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;
	const transitMotion = activeTransitOverlay?.transitChart.computed?.motion ?? {};
	// Unfiltered (not narrowed by the current orb/body/aspect-type filters): an object's own
	// detail view should list every aspect it actually has, matching the radix wheel's own
	// planet-click panel, not just the ones the matrix/list currently shows.
	const fullRadixAspects: ParsedAspect[] = (selectedChart?.computed?.aspects ?? [])
		.map(parseComputedAspect)
		.filter((aspect): aspect is ParsedAspect => aspect !== null);
	const fullTransitAspects: ParsedAspect[] = (activeTransitOverlay?.aspects ?? [])
		.map(parseComputedAspect)
		.filter((aspect): aspect is ParsedAspect => aspect !== null);
	const availableBodyOrder = useMemo(
		() =>
			(activeTransitOverlay?.transitedBodies ?? DEFAULT_OBSERVABLE_OBJECT_IDS).filter((id) => {
				const value = positions[id];
				return normalizeLongitude(value) !== null;
			}),
		[activeTransitOverlay?.transitedBodies, positions]
	);
	const availableTransitBodyOrder = useMemo(
		() =>
			(activeTransitOverlay?.transitingBodies ?? []).filter((id) => {
				const value = transitPositions[id];
				return normalizeLongitude(value) !== null;
			}),
		[activeTransitOverlay?.transitingBodies, transitPositions]
	);
	const bodyOrder = useMemo(
		() => availableBodyOrder.filter((id) => selectedBodyIds.has(id)),
		[availableBodyOrder, selectedBodyIds]
	);
	const transitBodyOrder = useMemo(
		() => availableTransitBodyOrder.filter((id) => selectedBodyIds.has(id)),
		[availableTransitBodyOrder, selectedBodyIds]
	);
	const rowBodyOrder = activeTransitOverlay ? transitBodyOrder : bodyOrder;
	const columnBodyOrder = bodyOrder;
	const enabledBodySet = useMemo(() => new Set(bodyOrder), [bodyOrder]);
	const enabledTransitBodySet = useMemo(() => new Set(transitBodyOrder), [transitBodyOrder]);
	const maxOrb = ORB_PRESETS.find((preset) => preset.id === orbPreset)?.maxOrb ?? 5;
	const bodyOrderIndex = useMemo(
		() => new Map(bodyOrder.map((id, index) => [id, index] as const)),
		[bodyOrder]
	);

	const visibleRadixAspects = useMemo(() => {
		return (selectedChart?.computed?.aspects ?? [])
			.map(parseComputedAspect)
			.filter((aspect): aspect is ParsedAspect => aspect !== null)
			.filter(
				(aspect) =>
					selectedAspectTypes.has(aspect.type) &&
					enabledBodySet.has(aspect.from) &&
					enabledBodySet.has(aspect.to) &&
					Math.abs(aspect.orb) <= maxOrb
			);
	}, [enabledBodySet, maxOrb, selectedAspectTypes, selectedChart?.computed?.aspects]);

	const visibleTransitAspects = useMemo(() => {
		return (activeTransitOverlay?.aspects ?? [])
			.map(parseComputedAspect)
			.filter((aspect): aspect is ParsedAspect => aspect !== null)
			.filter(
				(aspect) =>
					selectedAspectTypes.has(aspect.type) &&
					enabledTransitBodySet.has(aspect.from) &&
					enabledBodySet.has(aspect.to) &&
					Math.abs(aspect.orb) <= maxOrb
			);
	}, [
		activeTransitOverlay?.aspects,
		enabledBodySet,
		enabledTransitBodySet,
		maxOrb,
		selectedAspectTypes
	]);

	const visibleAspects = activeTransitOverlay ? visibleTransitAspects : visibleRadixAspects;

	const aspectMap = useMemo(() => {
		const next = new Map<string, AspectEntry>();
		if (activeTransitOverlay) {
			for (const aspect of visibleTransitAspects) {
				next.set(directionalPairKey(aspect.from, aspect.to), {
					id: aspectIdentity(aspect, bodyOrderIndex, 'transit'),
					aspect,
					fromLayer: 'transit',
					toLayer: 'radix'
				});
			}
		} else {
			for (const aspect of visibleRadixAspects) {
				next.set(canonicalPairKey(aspect.from, aspect.to, bodyOrderIndex), {
					id: aspectIdentity(aspect, bodyOrderIndex, 'radix'),
					aspect,
					fromLayer: 'radix',
					toLayer: 'radix'
				});
			}
		}
		return next;
	}, [activeTransitOverlay, bodyOrderIndex, visibleRadixAspects, visibleTransitAspects]);

	const aspectEntries = useMemo(() => Array.from(aspectMap.values()), [aspectMap]);

	const selectedAspectEntry = aspectEntries.find((entry) => entry.id === selectedAspectId) ?? null;
	const selectedAspect = selectedAspectEntry?.aspect ?? null;

	useEffect(() => {
		if (selectedAspectId && !aspectEntries.some((entry) => entry.id === selectedAspectId)) {
			setSelectedAspectId(null);
		}
	}, [aspectEntries, selectedAspectId]);

	const availableSelectorBodyIds = Array.from(
		new Set([...availableBodyOrder, ...availableTransitBodyOrder])
	);
	const bodyFilterItems: FilterItem[] = availableSelectorBodyIds.map((id) => ({
		id,
		label: objectLabel(id, t),
		icon: (
			<BodyGlyph
				bodyId={id}
				glyphSet={glyphSet}
				size={18}
				className="text-[color:var(--theme-content-primary)]"
			/>
		)
	}));
	const aspectFilterItems: FilterItem[] = ASPECT_ROWS.map((aspect) => ({
		id: aspect.id,
		label: t(aspect.labelKey),
		icon: (
			<AstrologyGlyph
				glyphId={aspect.id}
				glyphSet={glyphSet}
				domain="aspect"
				fallback={ASPECT_GLYPHS[aspect.id] ?? '•'}
				size={16}
			/>
		),
		color:
			workspaceDefaults.defaultAspectColors[aspect.id] ??
			DEFAULT_ASPECT_COLORS[aspect.id] ??
			'var(--theme-accent)'
	}));

	const positionsForLayer = (layer: AspectLayer) =>
		layer === 'transit' ? transitPositions : positions;

	const renderBodyLabel = (bodyId: string, layer: AspectLayer, compact = false) => (
		<div
			className={cn(
				'flex items-center gap-3',
				compact ? 'min-w-20 flex-col gap-1 px-2 py-2 text-center' : 'min-w-36 px-3 py-2',
				'bg-transparent'
			)}
		>
			<BodyGlyph
				bodyId={bodyId}
				glyphSet={glyphSet}
				size={compact ? 18 : 22}
				className="text-[color:var(--theme-content-primary)]"
			/>
			<div className="min-w-0">
				<p className={cn('truncate text-sm font-medium', ft.title)}>{objectLabel(bodyId, t)}</p>
				<p className={cn('truncate text-xs', ft.muted)}>
					{normalizeLongitude(positionsForLayer(layer)[bodyId]) === null ? (
						t('loading_positions')
					) : (
						<PositionValue
							longitude={normalizeLongitude(positionsForLayer(layer)[bodyId])}
							glyphSet={glyphSet}
						/>
					)}
				</p>
			</div>
		</div>
	);

	const renderMatrix = () => (
		<Card
			variant="themed"
			theme={theme}
			className="flex h-full min-h-0 gap-0 overflow-hidden border-0 shadow-none ring-0"
		>
			<CardContent className="flex min-h-0 flex-1 flex-col p-0">
				<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--theme-panel-border)] px-4 py-3 md:px-5">
					<MultiSelectFilter
						items={bodyFilterItems}
						selected={selectedBodyIds}
						label={t('aspectarium_all_planets')}
						noneLabel={t('aspectarium_none_selected')}
						selectedLabel={(count) => t('aspectarium_selected_count', { count })}
						searchPlaceholder={t('aspectarium_search_planets')}
						selectAllLabel={t('aspectarium_select_all')}
						clearAllLabel={t('aspectarium_clear_all')}
						noResultsLabel={t('open_search_no_results')}
						inputClassName={ft.inputCompact}
						onChange={setSelectedBodyIds}
					/>
					<MultiSelectFilter
						items={aspectFilterItems}
						selected={selectedAspectTypes}
						label={t('aspectarium_all_aspects')}
						noneLabel={t('aspectarium_none_selected')}
						selectedLabel={(count) => t('aspectarium_selected_count', { count })}
						searchPlaceholder={t('aspectarium_search_aspects')}
						selectAllLabel={t('aspectarium_select_all')}
						clearAllLabel={t('aspectarium_clear_all')}
						noResultsLabel={t('open_search_no_results')}
						inputClassName={ft.inputCompact}
						onChange={setSelectedAspectTypes}
					/>
					<Select value={orbPreset} onValueChange={(value) => setOrbPreset(value as OrbPreset)}>
						<SelectTrigger className={cn(ft.selectTrigger, 'h-9 min-h-9 w-auto min-w-36 py-1')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={ft.selectContent}>
							{ORB_PRESETS.map((preset) => (
								<SelectItem key={preset.id} value={preset.id} className={ft.selectItem}>
									{t('label_orb')}: {t(preset.labelKey)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="min-w-2 flex-1" />
					<Tabs value={view} onValueChange={(value) => setView(value as AspectariumView)}>
						<TabsList>
							<TabsTrigger value="table">
								<Grid3X3 />
								{t('aspectarium_view_table')}
							</TabsTrigger>
							<TabsTrigger value="list">
								<List />
								{t('aspectarium_view_list')}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{view === 'table' ? (
					<div
						dir="rtl"
						className="min-h-0 flex-1 overflow-auto bg-[color:var(--theme-panel-bg)]/40"
					>
						<div dir="ltr" className="mr-auto w-max min-w-full">
							<Table className="w-auto border-collapse">
								<TableBody>
									{activeTransitOverlay ? (
										<TableRow className="border-0 hover:bg-transparent">
											<TableCell className="sticky left-0 z-20 min-w-36 border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] p-0">
												<div className={cn('px-3 py-2 text-xs font-semibold', ft.muted)}>
													{t('transit_overlay_aspectarium_hint')}
												</div>
											</TableCell>
											{columnBodyOrder.map((colId) => (
												<TableCell
													key={`head:${colId}`}
													className="border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] p-0 align-bottom"
												>
													{renderBodyLabel(colId, 'radix', true)}
												</TableCell>
											))}
										</TableRow>
									) : null}
									{rowBodyOrder.map((rowId, rowIndex) => (
										<TableRow key={rowId} className="border-0 hover:bg-transparent">
											<TableCell className="sticky left-0 z-10 min-w-36 border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] p-0">
												{renderBodyLabel(rowId, activeTransitOverlay ? 'transit' : 'radix')}
											</TableCell>
											{columnBodyOrder.map((colId, colIndex) => {
												if (!activeTransitOverlay && colIndex > rowIndex) {
													return (
														<TableCell
															key={`${rowId}:${colId}`}
															className="h-14 w-14 min-w-14 p-0"
														/>
													);
												}
												if (!activeTransitOverlay && colIndex === rowIndex) {
													return (
														<TableCell
															key={`${rowId}:${colId}`}
															className="h-14 w-14 min-w-14 border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] p-0 text-center"
														>
															<BodyGlyph
																bodyId={rowId}
																glyphSet={glyphSet}
																size={22}
																className="mx-auto opacity-80"
															/>
														</TableCell>
													);
												}
												const pairKey = activeTransitOverlay
													? directionalPairKey(rowId, colId)
													: canonicalPairKey(rowId, colId, bodyOrderIndex);
												const entry = aspectMap.get(pairKey);
												if (!entry) {
													return (
														<TableCell
															key={`${rowId}:${colId}`}
															className="h-14 w-14 min-w-14 border border-[color:var(--theme-panel-border)] p-0"
														/>
													);
												}
												const aspectColor =
													workspaceDefaults.defaultAspectColors[entry.aspect.type] ??
													DEFAULT_ASPECT_COLORS[
														entry.aspect.type as keyof typeof DEFAULT_ASPECT_COLORS
													] ??
													'var(--theme-accent)';
												return (
													<TableCell
														key={`${rowId}:${colId}`}
														className="h-14 w-14 min-w-14 border border-[color:var(--theme-panel-border)] p-0"
													>
														<AspectCellButton
															aspect={entry.aspect}
															glyphSet={glyphSet}
															isSelected={selectedAspectId === entry.id}
															onSelect={() => setSelectedAspectId(entry.id)}
															color={aspectColor}
														/>
													</TableCell>
												);
											})}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				) : (
					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="mx-auto max-w-3xl">
							{aspectEntries.length === 0 ? (
								<p className={cn('px-6 py-16 text-center text-sm', ft.muted)}>
									{activeTransitOverlay
										? t('transit_overlay_no_aspects')
										: t('aspectarium_no_aspects')}
								</p>
							) : (
								aspectEntries.map((entry) => {
									const color =
										workspaceDefaults.defaultAspectColors[entry.aspect.type] ??
										DEFAULT_ASPECT_COLORS[
											entry.aspect.type as keyof typeof DEFAULT_ASPECT_COLORS
										] ??
										'var(--theme-accent)';
									return (
										<Button
											key={entry.id}
											type="button"
											variant="ghost"
											className={cn(
												'h-auto w-full justify-start rounded-none border-b border-[color:var(--theme-panel-border)] px-5 py-3.5 text-left',
												selectedAspectId === entry.id && 'bg-[color:var(--theme-selected-bg)]'
											)}
											onClick={() => setSelectedAspectId(entry.id)}
										>
											<span
												className="flex w-8 shrink-0 items-center justify-center text-2xl"
												style={{ color }}
											>
												<AstrologyGlyph
													glyphId={entry.aspect.type}
													glyphSet={glyphSet}
													domain="aspect"
													fallback={ASPECT_GLYPHS[entry.aspect.type] ?? '•'}
													size={22}
												/>
											</span>
											<span className="min-w-0 flex-1">
												<span className={cn('block truncate text-sm font-medium', ft.title)}>
													{objectLabel(entry.aspect.from, t)} — {objectLabel(entry.aspect.to, t)}
												</span>
												<span className={cn('block text-xs', ft.muted)}>
													{aspectLabel(entry.aspect.type, t)}
												</span>
											</span>
											<span className={cn('shrink-0 font-mono text-sm', ft.muted)}>
												{formatOrb(entry.aspect.orb)}
											</span>
										</Button>
									);
								})
							)}
						</div>
					</div>
				)}

				<div
					className={cn(
						'shrink-0 border-t border-[color:var(--theme-panel-border)] px-4 py-2 text-xs',
						ft.muted
					)}
				>
					{visibleAspects.length > 0
						? t('aspectarium_select_aspect_hint')
						: activeTransitOverlay
							? t('transit_overlay_no_aspects')
							: t('aspectarium_no_aspects')}
				</div>
			</CardContent>
		</Card>
	);

	/** The exact same view-model + panel the radix wheel's own aspect-click detail uses (see
	 *  `horoscope-dashboard.tsx`): aspect facts, then each side's full body detail, each in its
	 *  own collapsed accordion item. */
	const selectedAspectDetail = useMemo(() => {
		if (!selectedAspect || !selectedAspectEntry) return null;
		const buildSide = (bodyId: string, layer: AspectLayer) => {
			const sourcePositions = layer === 'transit' ? transitPositions : positions;
			const sourceMotion = layer === 'transit' ? transitMotion : motion;
			const layerLabel =
				layer === 'transit'
					? t('transits_general_transit_transit')
					: (selectedChart?.name ?? t('new_type_radix'));
			return buildObjectDetailViewModel(
				{
					bodyId,
					rawPosition: sourcePositions[bodyId],
					motion: sourceMotion[bodyId],
					extendedMaps: layer === 'transit' ? activeTransitOverlay?.transitChart.computed : selectedChart?.computed,
					houseCusps: selectedChart?.computed?.houseCusps ?? [],
					chartShapeIds,
					chartConfigurationIds,
					allAspects: layer === 'transit' ? fullTransitAspects : fullRadixAspects,
					layerLabel
				},
				i18n.language,
				t
			);
		};
		const fromObject = buildSide(selectedAspect.from, selectedAspectEntry.fromLayer);
		const toObject = buildSide(selectedAspect.to, selectedAspectEntry.toLayer);
		if (!fromObject || !toObject) return null;
		return { aspect: selectedAspect, fromObject, toObject };
	}, [
		activeTransitOverlay?.transitChart.computed,
		chartConfigurationIds,
		chartShapeIds,
		fullRadixAspects,
		fullTransitAspects,
		i18n.language,
		motion,
		positions,
		selectedAspect,
		selectedAspectEntry,
		selectedChart?.computed,
		selectedChart?.name,
		t,
		transitMotion,
		transitPositions
	]);

	const renderDetailContent = () =>
		selectedAspectDetail ? (
			<div className="h-full min-h-0 overflow-y-auto rounded-2xl bg-[color:var(--theme-soft-bg)]/42 p-4 pr-2">
				<AspectDetailPanel
					theme={theme}
					glyphSet={glyphSet}
					aspect={selectedAspectDetail.aspect}
					fromObject={selectedAspectDetail.fromObject}
					toObject={selectedAspectDetail.toObject}
				/>
			</div>
		) : null;

	return (
		<>
			<div className="flex h-full min-h-0 flex-col p-4 md:p-6">{renderMatrix()}</div>

			<DetailSidePanel
				theme={theme}
				open={selectedAspect !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedAspectId(null);
				}}
				title={t('details')}
				description={
					activeTransitOverlay
						? t('transit_overlay_aspectarium_hint')
						: t('aspectarium_reported_aspects')
				}
			>
				{renderDetailContent()}
			</DetailSidePanel>
		</>
	);
}
