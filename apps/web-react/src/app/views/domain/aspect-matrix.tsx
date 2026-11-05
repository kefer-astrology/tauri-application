import { ChoiceButton } from '@/app/components/ui/choice';
import { Table, TableBody, TableCell, TableRow } from '@/app/components/ui/table';
import { Text } from '@/app/components/ui/typography';
import { cn } from '@/app/components/ui/utils';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatOrb, matrixCell, type AspectariumData } from '@/lib/astrology/aspectarium';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { ObjectGlyph } from './object-glyph';
import { ZodiacPosition } from './zodiac-position';

const cellBorder = 'border border-[color:var(--theme-panel-border)]';
const headCell = cn(cellBorder, 'bg-[color:var(--theme-panel-bg-solid)] p-0');

/**
 * The aspect matrix: bodies on both axes, one aspect cell per pair (glyph and orb). The radix
 * matrix is a triangle with each body on the diagonal; with a transit overlay, transiting rows
 * meet radix columns. Data and labels come from the caller.
 */
export function AspectMatrix({
	data,
	selectedId,
	onSelect,
	bodyLabel,
	bodyColor,
	aspectColor,
	rowLongitude,
	columnLongitude,
	cornerLabel,
	missingPositionLabel
}: {
	data: Pick<AspectariumData, 'transit' | 'rowIds' | 'columnIds' | 'cells' | 'order'>;
	selectedId: string | null;
	onSelect: (entryId: string) => void;
	bodyLabel: (id: string) => string;
	bodyColor: (id: string) => string;
	aspectColor: (type: string) => string;
	rowLongitude: (id: string) => number | null;
	columnLongitude: (id: string) => number | null;
	/** Shown in the top-left cell of the transit matrix. */
	cornerLabel: string;
	missingPositionLabel: string;
}) {
	const header = (id: string, longitude: number | null, compact: boolean) => (
		<div
			className={cn(
				'flex items-center gap-3 bg-transparent',
				compact ? 'min-w-20 flex-col gap-1 px-2 py-2 text-center' : 'min-w-36 px-3 py-2'
			)}
		>
			<ObjectGlyph id={id} size={compact ? 18 : 22} color={bodyColor(id)} title={bodyLabel(id)} />
			<div className="min-w-0">
				<Text variant="label" tone="primary" className="truncate">
					{bodyLabel(id)}
				</Text>
				<Text variant="caption" tone="muted" className="truncate">
					{longitude === null ? missingPositionLabel : <ZodiacPosition longitude={longitude} />}
				</Text>
			</div>
		</div>
	);

	return (
		<div dir="rtl" className="min-h-0 overflow-auto bg-[color:var(--theme-panel-bg)]/40">
			<div dir="ltr" className="mr-auto w-max min-w-full">
				<Table className="w-auto border-collapse">
					<TableBody>
						{data.transit ? (
							<TableRow className="border-0 hover:bg-transparent">
								<TableCell className={cn(headCell, 'sticky left-0 z-20 min-w-36')}>
									<Text variant="caption" tone="muted" className="px-3 py-2 font-semibold">
										{cornerLabel}
									</Text>
								</TableCell>
								{data.columnIds.map((columnId) => (
									<TableCell key={`head:${columnId}`} className={cn(headCell, 'align-bottom')}>
										{header(columnId, columnLongitude(columnId), true)}
									</TableCell>
								))}
							</TableRow>
						) : null}
						{data.rowIds.map((rowId, rowIndex) => (
							<TableRow key={rowId} className="border-0 hover:bg-transparent">
								<TableCell className={cn(headCell, 'sticky left-0 z-10 min-w-36')}>
									{header(rowId, rowLongitude(rowId), false)}
								</TableCell>
								{data.columnIds.map((columnId, columnIndex) => {
									const cell = matrixCell(data, rowIndex, columnIndex, rowId, columnId);
									const key = `${rowId}:${columnId}`;
									if (cell.kind === 'blank') {
										return <TableCell key={key} className="h-14 w-14 min-w-14 p-0" />;
									}
									if (cell.kind === 'diagonal') {
										return (
											<TableCell
												key={key}
												className={cn(
													cellBorder,
													'h-14 w-14 min-w-14 bg-[color:var(--theme-soft-bg)] p-0 text-center'
												)}
											>
												<ObjectGlyph
													id={cell.bodyId}
													size={22}
													className="mx-auto opacity-80"
													color={bodyColor(cell.bodyId)}
												/>
											</TableCell>
										);
									}
									if (cell.kind === 'empty') {
										return (
											<TableCell key={key} className={cn(cellBorder, 'h-14 w-14 min-w-14 p-0')} />
										);
									}
									const { entry } = cell;
									return (
										<TableCell key={key} className={cn(cellBorder, 'h-14 w-14 min-w-14 p-0')}>
											<ChoiceButton
												selected={selectedId === entry.id}
												emphasis="inset"
												type="button"
												onClick={() => onSelect(entry.id)}
												variant="cell"
												className="aspect-square min-h-14 w-full min-w-14 flex-col px-1.5 py-1"
											>
												<span
													className="text-lg leading-none"
													style={{ color: aspectColor(entry.aspect.type) }}
												>
													<AstrologyGlyph
														glyphId={entry.aspect.type}
														domain="aspect"
														fallback={ASPECT_GLYPHS[entry.aspect.type] ?? '•'}
														size={18}
													/>
												</span>
												<Text variant="caption" as="span" tone="muted" className="mt-1">
													{formatOrb(entry.aspect.orb)}
												</Text>
											</ChoiceButton>
										</TableCell>
									);
								})}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
