import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent
} from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, PanelRightOpen, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type {
	ExpandedState,
	OnChangeFn,
	RowSelectionState,
	SortingState
} from '@tanstack/react-table';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/app-main-content';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { DetailSidePanel } from '@/app/components/detail-side-panel';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import { useWorkspace } from '@/app/providers/workspace';
import {
	CHART_FILTER_GROUPS,
	ChartFilterPanel
} from '@/app/views/domain/chart-filters/chart-filter-panel';
import { ChartTreeTable } from '@/app/views/domain/chart-tree-table';
import type { ChartTreeRow } from '@/lib/astrology/chartQuery';
import {
	persistChartFavorites,
	persistChartListSort,
	readStoredChartFavorites,
	readStoredChartListSort
} from '@/lib/chartListPreferences';
import { openChartFileDialog } from '@/lib/tauri/workspace';
import { useChartQuery, useFilterGroupVisibility } from './use-chart-query';

type OpenMode = 'my_radixes' | 'database';

const FILTER_GROUP_IDS = CHART_FILTER_GROUPS.map((group) => group.id);
const NO_ROWS: ChartTreeRow[] = [];

export type OpenWorkspaceViewProps = {
	onOpenWorkspace: () => void | Promise<void>;
	onActivateChart: (chartId: string) => void;
};

/** Open: the workspace chart archive — filter panel, chart tree, import and open actions. */
export function OpenWorkspaceView({ onOpenWorkspace, onActivateChart }: OpenWorkspaceViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { charts, selectedChartId } = useWorkspaceCharts();
	const { importChart } = useWorkspace();
	const { query, setQuery, resetQuery, forest, rows, autoExpanded } = useChartQuery(charts);
	const { visible: visibleFilterGroups, setGroupVisible } =
		useFilterGroupVisibility(FILTER_GROUP_IDS);

	const [openMode, setOpenMode] = useState<OpenMode>('my_radixes');
	const [filterSettingsOpen, setFilterSettingsOpen] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [favoriteIds, setFavoriteIds] = useState<string[]>(readStoredChartFavorites);
	const [sorting, setSorting] = useState<SortingState>(readStoredChartListSort);
	const [expanded, setExpanded] = useState<ExpandedState>({});
	const [focusedChartId, setFocusedChartId] = useState<string | null>(selectedChartId);

	const splitPaneRef = useRef<HTMLDivElement>(null);
	const [filterPaneWidth, setFilterPaneWidth] = useState<number | null>(null);
	const [resizingFilters, setResizingFilters] = useState(false);

	const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
	const childCount = useCallback(
		(chartId: string) => forest.childrenByParent.get(chartId)?.length ?? 0,
		[forest]
	);
	const availableTags = useMemo(
		() =>
			Array.from(new Set(charts.flatMap((chart) => chart.tags ?? [])))
				.filter(Boolean)
				.sort(),
		[charts]
	);
	const treeRows = openMode === 'database' ? NO_ROWS : rows;
	const visibleChartIds = useMemo(
		() => treeRows.flatMap((row) => [row.chart.id, ...(row.children ?? []).map((c) => c.chart.id)]),
		[treeRows]
	);

	useEffect(() => setExpanded(autoExpanded), [autoExpanded]);
	useEffect(() => {
		if (selectedChartId) setFocusedChartId(selectedChartId);
	}, [selectedChartId]);
	useEffect(() => {
		if (focusedChartId && visibleChartIds.includes(focusedChartId)) return;
		setFocusedChartId(visibleChartIds[0] ?? null);
	}, [visibleChartIds, focusedChartId]);

	const toggleFavorite = (chartId: string) =>
		setFavoriteIds((current) => {
			const next = current.includes(chartId)
				? current.filter((id) => id !== chartId)
				: [...current, chartId];
			persistChartFavorites(next);
			return next;
		});

	const handleSortingChange: OnChangeFn<SortingState> = (updater) =>
		setSorting((current) => {
			const next = typeof updater === 'function' ? updater(current) : updater;
			persistChartListSort(next);
			return next;
		});

	const importHoroscope = async () => {
		if (isImporting) return;
		try {
			const sourcePath = await openChartFileDialog();
			if (!sourcePath) return;
			setIsImporting(true);
			const chart = await importChart(sourcePath);
			toast.success(t('toast_chart_imported'), { description: chart.name });
		} catch (error) {
			toast.error(t('toast_chart_import_failed'), {
				description: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setIsImporting(false);
		}
	};

	const resizeFilterPane = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
		const bounds = splitPaneRef.current?.getBoundingClientRect();
		if (!bounds) return;
		const minWidth = 260;
		const maxWidth = Math.min(560, Math.max(minWidth, bounds.width * 0.48));
		setFilterPaneWidth(Math.min(maxWidth, Math.max(minWidth, event.clientX - bounds.left)));
	};
	const finishFilterResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		setResizingFilters(false);
	};

	return (
		<AppMainContentRoot className={cn(ft.formPageBg, 'h-full')} layout="edge-to-edge">
			<AppMainContentContainer width="full" className="flex h-full min-h-0 flex-1 flex-col">
				<div
					ref={splitPaneRef}
					className={cn(
						'flex h-full min-h-[calc(100vh-8rem)] flex-1 flex-col xl:min-h-[42rem] xl:flex-row',
						resizingFilters && 'xl:cursor-col-resize xl:select-none'
					)}
				>
					<aside
						data-titlebar-secondary-rail="responsive"
						className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b xl:w-[var(--open-filter-width)] xl:border-b-0"
						style={
							{
								'--open-filter-width':
									filterPaneWidth === null ? 'clamp(17rem, 30%, 30rem)' : `${filterPaneWidth}px`,
								background:
									'linear-gradient(to bottom, var(--theme-secondary-sidebar-start) 0%, var(--theme-secondary-sidebar-end) 100%)',
								borderColor: 'var(--theme-sidebar-border)',
								color: 'var(--theme-nav-text-primary)'
							} as CSSProperties
						}
					>
						<button
							type="button"
							className={cn(
								'absolute top-0 right-0 z-30 hidden h-full w-2 cursor-col-resize touch-none xl:block',
								'after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[color:var(--theme-sidebar-border)]',
								'hover:after:w-0.5 hover:after:bg-[color:var(--theme-accent)]',
								resizingFilters && 'after:w-0.5 after:bg-[color:var(--theme-accent)]'
							)}
							onPointerDown={(event) => {
								event.preventDefault();
								event.currentTarget.setPointerCapture(event.pointerId);
								setResizingFilters(true);
							}}
							onPointerMove={resizeFilterPane}
							onPointerUp={finishFilterResize}
							onPointerCancel={finishFilterResize}
							onLostPointerCapture={() => setResizingFilters(false)}
							onDoubleClick={() => setFilterPaneWidth(null)}
							aria-label={t('open_resize_filters')}
							title={t('open_resize_filters')}
						/>
						<div className={cn('shrink-0 border-b px-4 sm:px-6', ft.footerBorder)}>
							<div className="flex min-h-16 items-center">
								{[
									{ id: 'my_radixes', label: t('open_mode_my_radixes') },
									{ id: 'database', label: t('open_mode_database') }
								].map((tab) => (
									<Button
										key={tab.id}
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setOpenMode(tab.id as OpenMode)}
										className={cn(
											'relative h-16 min-w-0 flex-1 rounded-none px-2 text-center text-sm hover:text-[color:var(--theme-nav-text-primary)]',
											openMode === tab.id
												? 'text-[color:var(--theme-nav-text-primary)]'
												: 'text-[color:var(--theme-nav-text-secondary)]'
										)}
									>
										<span className="truncate">{tab.label}</span>
										{openMode === tab.id && (
											<span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[color:var(--theme-accent)]" />
										)}
									</Button>
								))}
							</div>
						</div>
						<div className="flex items-center gap-2 px-4 pt-3 pb-1 sm:px-6">
							<Input
								type="search"
								value={query.text}
								onChange={(event) => {
									const text = event.target.value;
									setQuery((current) => ({ ...current, text }));
								}}
								placeholder={t('open_filter_content_search')}
								className={ft.inputCompact}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="shrink-0"
								onClick={() => setFilterSettingsOpen(true)}
								aria-label={t('open_filter_visibility_title', { defaultValue: 'Visible filters' })}
							>
								<Pencil className={cn('size-4 shrink-0', ft.muted)} />
							</Button>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto pb-28">
							<ChartFilterPanel
								query={query}
								onQueryChange={setQuery}
								visibleGroups={visibleFilterGroups}
								availableTags={availableTags}
							/>
						</div>
						<div
							className="absolute right-0 bottom-0 left-0 z-10 space-y-2 p-3 sm:px-6"
							style={{
								background:
									'linear-gradient(to top, var(--theme-secondary-sidebar-end) 0%, var(--theme-overlay-bg) 65%, transparent 100%)'
							}}
						>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={cn('h-9 w-full text-xs', ft.footerPrimary)}
								onClick={resetQuery}
							>
								{t('open_clear_filters')}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={cn('h-9 w-full text-xs', ft.footerPrimary)}
								onClick={() => void importHoroscope()}
								disabled={isImporting}
							>
								<Upload />
								{t('open_import_horoscope')}
							</Button>
						</div>
					</aside>

					<DetailSidePanel
						open={filterSettingsOpen}
						onOpenChange={setFilterSettingsOpen}
						title={t('open_filter_visibility_title', { defaultValue: 'Visible filters' })}
					>
						<div className="flex flex-col gap-1">
							{CHART_FILTER_GROUPS.map((group) => (
								<Label
									key={group.id}
									htmlFor={`filter-group-${group.id}`}
									className={cn(
										'flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm',
										ft.bodyText
									)}
								>
									<Checkbox
										id={`filter-group-${group.id}`}
										checked={visibleFilterGroups.includes(group.id)}
										onCheckedChange={(checked) => setGroupVisible(group.id, checked === true)}
									/>
									{t(group.labelKey)}
								</Label>
							))}
						</div>
					</DetailSidePanel>

					<section className="relative flex min-w-0 flex-1 flex-col">
						<div className="flex-1 overflow-auto pb-16">
							{openMode === 'database' ? (
								<div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
									<p className={cn('text-lg font-medium', ft.title)}>{t('open_mode_database')}</p>
									<p className={cn('max-w-md text-sm', ft.muted)}>{t('database_placeholder')}</p>
								</div>
							) : (
								<ChartTreeTable
									rows={treeRows}
									childCount={childCount}
									focusedChartId={focusedChartId}
									onFocusChart={setFocusedChartId}
									onActivateChart={onActivateChart}
									expanded={expanded}
									onExpandedChange={setExpanded}
									sorting={sorting}
									onSortingChange={handleSortingChange}
									rowSelection={rowSelection}
									onRowSelectionChange={setRowSelection}
									favorites={favorites}
									onToggleFavorite={toggleFavorite}
									empty={
										<div className="flex min-h-full items-center justify-center p-8 text-center">
											<p className={cn('max-w-md text-sm', ft.muted)}>
												{charts.length === 0 ? t('open_table_empty') : t('open_search_no_results')}
											</p>
										</div>
									}
								/>
							)}
						</div>
						<div className="absolute right-3 bottom-3 z-20 flex gap-1.5 rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] p-1.5 shadow-lg">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className={cn('size-8', ft.footerCancel)}
								onClick={() => void onOpenWorkspace()}
								aria-label={t('open_workspace')}
								title={t('open_workspace')}
							>
								<FolderOpen className="size-4" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className={cn('size-8', ft.footerCancel)}
								disabled={!focusedChartId}
								onClick={() => focusedChartId && onActivateChart(focusedChartId)}
								aria-label={t('button_open_chart')}
								title={t('button_open_chart')}
							>
								<PanelRightOpen className="size-4" />
							</Button>
						</div>
					</section>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
