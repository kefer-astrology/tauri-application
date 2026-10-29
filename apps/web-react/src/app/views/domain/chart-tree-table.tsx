import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import type {
	ColumnDef,
	ExpandedState,
	OnChangeFn,
	RowSelectionState,
	SortingState
} from '@tanstack/react-table';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { DataTable, DataTableExpander } from '@/app/views/data/data-table';
import type { ChartTreeRow } from '@/lib/astrology/chartQuery';
import { tagColor } from '@/lib/chartTags';
import { parseChartDateTime, splitChartDateTime } from '@/lib/chartDateTime';
import { chartTypeLabel } from '@/lib/chartTypes';

/**
 * Chart list as a parent/child tree: name (with expander and child count), type, tags, date,
 * time, place. Sorting reorders parents only; children keep the order they are given in.
 * Optional checkbox selection and favorites columns.
 */
export function ChartTreeTable({
	rows,
	childCount,
	focusedChartId,
	onFocusChart,
	onActivateChart,
	expanded,
	onExpandedChange,
	sorting,
	onSortingChange,
	rowSelection,
	onRowSelectionChange,
	favorites,
	onToggleFavorite,
	empty
}: {
	rows: ChartTreeRow[];
	/** Number of derived charts/analyses a parent has (shown as a badge); defaults to the rows'. */
	childCount?: (chartId: string) => number;
	focusedChartId: string | null;
	onFocusChart: (chartId: string) => void;
	onActivateChart: (chartId: string) => void;
	expanded: ExpandedState;
	onExpandedChange: OnChangeFn<ExpandedState>;
	sorting?: SortingState;
	onSortingChange?: OnChangeFn<SortingState>;
	/** Pass both to show a checkbox selection column. */
	rowSelection?: RowSelectionState;
	onRowSelectionChange?: OnChangeFn<RowSelectionState>;
	/** Pass both to show a favorites column. */
	favorites?: ReadonlySet<string>;
	onToggleFavorite?: (chartId: string) => void;
	empty: ReactNode;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const selectable = Boolean(rowSelection && onRowSelectionChange);
	const withFavorites = Boolean(favorites && onToggleFavorite);

	const columns = useMemo<ColumnDef<ChartTreeRow>[]>(() => {
		const list: ColumnDef<ChartTreeRow>[] = [];
		if (selectable) {
			list.push({
				id: 'select',
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && 'indeterminate')
						}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
						aria-label={t('open_select_all')}
					/>
				),
				cell: ({ row }) => (
					<div onClick={(event) => event.stopPropagation()}>
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={(value) => row.toggleSelected(!!value)}
						/>
					</div>
				),
				enableSorting: false,
				size: 40
			});
		}
		if (withFavorites) {
			list.push({
				id: 'favorite',
				accessorFn: ({ chart }) => favorites!.has(chart.id),
				header: '',
				cell: ({ row }) => (
					<div onClick={(event) => event.stopPropagation()}>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => onToggleFavorite!(row.original.chart.id)}
							aria-label={t('favorite')}
						>
							<Star
								className={cn(
									'size-4',
									favorites!.has(row.original.chart.id)
										? 'fill-[color:var(--theme-accent)] text-[color:var(--theme-accent)]'
										: ft.muted
								)}
							/>
						</Button>
					</div>
				),
				sortDescFirst: true,
				size: 40
			});
		}
		list.push(
			{
				id: 'name',
				accessorFn: ({ chart }) => chart.name,
				header: t('table_name'),
				cell: ({ row, getValue }) => {
					const count = childCount
						? childCount(row.original.chart.id)
						: (row.original.children?.length ?? 0);
					return (
						<DataTableExpander row={row}>
							<span className={cn('min-w-0 truncate', ft.bodyText)}>{getValue<string>()}</span>
							{row.depth === 0 && count > 0 && (
								<Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
									{count}
								</Badge>
							)}
						</DataTableExpander>
					);
				}
			},
			{
				id: 'type',
				accessorFn: ({ chart }) => chartTypeLabel(chart, t),
				header: t('table_chart_type'),
				cell: ({ getValue }) => (
					<div className={cn('min-w-0 truncate', ft.muted)}>{getValue<string>()}</div>
				)
			},
			{
				id: 'tags',
				accessorFn: ({ chart }) => chart.tags ?? [],
				header: t('table_tags'),
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex min-w-0 flex-wrap gap-1">
						{(row.original.chart.tags ?? []).map((tag, index) => (
							<Badge
								key={`${row.original.chart.id}-${tag}`}
								variant="outline"
								className="gap-1.5 px-2 py-0.5 text-xs"
							>
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: tagColor(row.original.chart.tagColors, tag, index) }}
								/>
								{tag}
							</Badge>
						))}
					</div>
				)
			},
			{
				id: 'date',
				accessorFn: ({ chart }) => parseChartDateTime(chart.dateTime)?.getTime() ?? 0,
				header: t('new_date'),
				cell: ({ row }) => (
					<div className={cn('truncate', ft.muted)}>
						{splitChartDateTime(row.original.chart.dateTime).date}
					</div>
				)
			},
			{
				id: 'time',
				accessorFn: ({ chart }) => parseChartDateTime(chart.dateTime)?.getTime() ?? 0,
				header: t('new_time'),
				cell: ({ row }) => (
					<div className={cn('truncate', ft.muted)}>
						{splitChartDateTime(row.original.chart.dateTime).time}
					</div>
				)
			},
			{
				id: 'location',
				accessorFn: ({ chart }) => chart.location,
				header: t('table_place'),
				cell: ({ getValue }) => (
					<div className={cn('min-w-0 truncate', ft.muted)}>{getValue<string>()}</div>
				)
			}
		);
		return list;
	}, [childCount, favorites, ft, onToggleFavorite, selectable, t, withFavorites]);

	return (
		<DataTable
			columns={columns}
			data={rows}
			getRowId={(row) => row.key}
			getSubRows={(row) => row.children}
			expanded={expanded}
			onExpandedChange={onExpandedChange}
			sortSubRows={false}
			sorting={sorting}
			onSortingChange={onSortingChange}
			rowSelection={rowSelection}
			onRowSelectionChange={onRowSelectionChange}
			isRowSelected={(row) => row.chart.id === focusedChartId}
			onRowClick={(row) => onFocusChart(row.chart.id)}
			onRowDoubleClick={(row) => onActivateChart(row.chart.id)}
			empty={empty}
		/>
	);
}
