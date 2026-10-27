import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnDef,
	type OnChangeFn,
	type RowSelectionState,
	type SortingState
} from '@tanstack/react-table';
import { Button } from '@/app/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/app/components/ui/table';
import { cn } from '@/app/components/ui/utils';

export type DataTableDensity = 'comfortable' | 'compact';

export interface DataTableProps<T> {
	columns: ColumnDef<T>[];
	data: T[];
	getRowId?: (row: T) => string;
	/** Controlled sorting; pass both or neither. Uncontrolled tables start from `initialSorting`. */
	sorting?: SortingState;
	onSortingChange?: OnChangeFn<SortingState>;
	initialSorting?: SortingState;
	/** Controlled checkbox selection, for a `select` column built from the row/table context. */
	rowSelection?: RowSelectionState;
	onRowSelectionChange?: OnChangeFn<RowSelectionState>;
	/** Row drawn with the selected-state background. */
	selectedRowId?: string | null;
	/** Makes rows interactive (pointer cursor, strong hover). */
	onRowClick?: (row: T) => void;
	onRowDoubleClick?: (row: T) => void;
	/** Rendered instead of the table when `data` is empty. */
	empty?: ReactNode;
	density?: DataTableDensity;
	className?: string;
}

const DENSITY = {
	comfortable: {
		head: 'px-4 sm:px-6 text-sm font-medium',
		headInner: 'py-1.5',
		sortIcon: 'size-3.5',
		cell: 'px-4 text-sm sm:px-6',
		row: 'border-[color:var(--theme-panel-border)]'
	},
	compact: {
		head: 'text-xs font-semibold',
		headInner: '',
		sortIcon: 'size-3',
		cell: 'text-xs',
		row: 'border-b-0'
	}
} as const;

export function DataTable<T>({
	columns,
	data,
	getRowId,
	sorting,
	onSortingChange,
	initialSorting,
	rowSelection,
	onRowSelectionChange,
	selectedRowId,
	onRowClick,
	onRowDoubleClick,
	empty,
	density = 'comfortable',
	className
}: DataTableProps<T>) {
	const table = useReactTable({
		data,
		columns,
		getRowId,
		initialState: initialSorting ? { sorting: initialSorting } : undefined,
		state: {
			...(sorting ? { sorting } : {}),
			...(rowSelection ? { rowSelection } : {})
		},
		onSortingChange,
		onRowSelectionChange,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	if (data.length === 0 && empty !== undefined) return <>{empty}</>;

	const d = DENSITY[density];
	const interactive = Boolean(onRowClick || onRowDoubleClick);

	return (
		<Table className={className}>
			<TableHeader>
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow
						key={headerGroup.id}
						className="border-[color:var(--theme-panel-border)] hover:bg-transparent"
					>
						{headerGroup.headers.map((header) => {
							const sortState = header.column.getIsSorted();
							const SortIcon =
								sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;
							const content = header.isPlaceholder
								? null
								: flexRender(header.column.columnDef.header, header.getContext());
							return (
								<TableHead
									key={header.id}
									className={cn(
										'sticky top-0 z-10 bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-secondary)]',
										d.head
									)}
									style={
										header.column.columnDef.size
											? { width: header.column.columnDef.size }
											: undefined
									}
								>
									<div className={d.headInner}>
										{!header.isPlaceholder && header.column.getCanSort() ? (
											<Button
												type="button"
												variant="ghost"
												className="h-auto gap-1 p-0 font-[inherit] text-inherit hover:bg-transparent hover:text-inherit"
												onClick={header.column.getToggleSortingHandler()}
											>
												{content}
												<SortIcon
													className={cn(d.sortIcon, sortState ? 'opacity-100' : 'opacity-40')}
												/>
											</Button>
										) : (
											content
										)}
									</div>
								</TableHead>
							);
						})}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getRowModel().rows.map((row) => {
					const selected = selectedRowId != null && row.id === selectedRowId;
					return (
						<TableRow
							key={row.id}
							className={cn(
								d.row,
								interactive && 'cursor-pointer',
								selected
									? 'bg-[color:var(--theme-selected-bg)] hover:bg-[color:var(--theme-selected-bg)]'
									: interactive
										? 'hover:bg-[color:var(--token-hover-strong)]'
										: 'hover:bg-[color:var(--token-hover-subtle)]'
							)}
							onClick={onRowClick ? () => onRowClick(row.original) : undefined}
							onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original) : undefined}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id} className={d.cell}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
