import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Text } from '@/app/components/ui/typography';
import { DataTable } from '@/app/views/data/data-table';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatOrb } from '@/lib/astrology/aspectarium';
import type { Midpoint, MidpointContact } from '@/lib/astrology/midpoints';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { ZodiacPosition } from './zodiac-position';

export interface MidpointTableLabels {
	pair: string;
	position: string;
	opposite: string;
	ambiguous: string;
	ambiguousHint: string;
}

/** Midpoints of object pairs: the pair, the midpoint, its opposite point, and whether the pair is
 *  ~180° apart (both points equally valid). */
export function MidpointTable({
	midpoints,
	bodyLabel,
	labels,
	empty
}: {
	midpoints: readonly Midpoint[];
	bodyLabel: (id: string) => string;
	labels: MidpointTableLabels;
	empty: React.ReactNode;
}) {
	const columns = useMemo<ColumnDef<Midpoint>[]>(
		() => [
			{
				id: 'pair',
				accessorFn: (m) => `${bodyLabel(m.object_a)} / ${bodyLabel(m.object_b)}`,
				header: labels.pair
			},
			{
				id: 'position',
				accessorFn: (m) => m.position,
				header: labels.position,
				cell: ({ row }) => <ZodiacPosition longitude={row.original.position} />
			},
			{
				id: 'opposite',
				accessorFn: (m) => m.opposite,
				header: labels.opposite,
				cell: ({ row }) => <ZodiacPosition longitude={row.original.opposite} />
			},
			{
				id: 'ambiguous',
				enableSorting: false,
				header: '',
				cell: ({ row }) =>
					row.original.ambiguous ? (
						<Text
							variant="caption"
							as="span"
							tone="muted"
							className="italic"
							title={labels.ambiguousHint}
						>
							{labels.ambiguous}
						</Text>
					) : null
			}
		],
		[bodyLabel, labels]
	);
	return (
		<DataTable
			columns={columns}
			data={[...midpoints]}
			getRowId={(m) => `${m.object_a}:${m.object_b}`}
			empty={empty}
			density="compact"
		/>
	);
}

export interface MidpointContactTableLabels {
	object: string;
	pair: string;
	aspect: string;
	orb: string;
}

/** Objects in aspect to a midpoint: the contacting object, the pair, the aspect and its orb. */
export function MidpointContactTable({
	contacts,
	bodyLabel,
	aspectLabel,
	labels,
	empty
}: {
	contacts: readonly MidpointContact[];
	bodyLabel: (id: string) => string;
	aspectLabel: (type: string) => string;
	labels: MidpointContactTableLabels;
	empty: React.ReactNode;
}) {
	const columns = useMemo<ColumnDef<MidpointContact>[]>(
		() => [
			{ id: 'object', accessorFn: (c) => bodyLabel(c.contact_object), header: labels.object },
			{
				id: 'pair',
				accessorFn: (c) => `${bodyLabel(c.object_a)} / ${bodyLabel(c.object_b)}`,
				header: labels.pair
			},
			{
				id: 'aspect',
				accessorFn: (c) => aspectLabel(c.aspect_type),
				header: labels.aspect,
				cell: ({ row }) => (
					<span className="inline-flex items-center gap-1.5">
						<AstrologyGlyph
							glyphId={row.original.aspect_type}
							domain="aspect"
							fallback={ASPECT_GLYPHS[row.original.aspect_type] ?? '•'}
							size={16}
						/>
						{aspectLabel(row.original.aspect_type)}
					</span>
				)
			},
			{
				id: 'orb',
				accessorFn: (c) => Math.abs(c.orb),
				header: labels.orb,
				cell: ({ row }) => <span className="font-mono text-xs">{formatOrb(row.original.orb)}</span>
			}
		],
		[bodyLabel, aspectLabel, labels]
	);
	return <DataTable columns={columns} data={[...contacts]} empty={empty} density="compact" />;
}
