import { Text } from '@/app/components/ui/typography';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme, type AppFormFieldTheme } from '@/app/components/form-field-theme';
import { DataTable } from '@/app/views/data/data-table';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatSignedDms } from '@/lib/astrology/dms';
import { objectIcon } from '@/lib/astrology/objectLabels';
import type { HitRow } from '@/lib/astrology/transitResults';
import { signPosition } from '@/lib/astrology/zodiac';
import { formatDate, formatTime } from '@/lib/time/format';
import { AstrologyGlyph } from '@/ui/astrology-glyph';

const INITIAL_SORTING: SortingState = [{ id: 'date', desc: false }];

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Longitude as degrees, sign glyph, minutes and seconds. */
function LongitudeCell({ longitude, ft }: { longitude: number; ft: AppFormFieldTheme }) {
	const pos = signPosition(longitude);
	return (
		<span
			className={cn('inline-flex items-center gap-1 whitespace-nowrap tabular-nums', ft.bodyText)}
		>
			{pos.degrees}
			<AstrologyGlyph
				glyphId={pos.signZodiacId}
				domain="zodiac"
				fallback={pos.signGlyphFallback}
				size={13}
			/>
			{pos.minutes}'{pos.seconds}"
		</span>
	);
}

function hitColumns(ft: AppFormFieldTheme, t: Translate): ColumnDef<HitRow>[] {
	return [
		{
			id: 'date',
			accessorFn: (row) => row.hit.timestampMs,
			header: t('aspect_timeline_col_date', { defaultValue: 'Date' }),
			cell: ({ getValue }) => (
				<div className={cn('whitespace-nowrap', ft.bodyText)}>{formatDate(getValue<number>())}</div>
			)
		},
		{
			id: 'time',
			accessorFn: (row) => row.hit.timestampMs,
			header: t('aspect_timeline_col_time', { defaultValue: 'Time' }),
			cell: ({ getValue }) => (
				<div className={cn('whitespace-nowrap', ft.bodyText)}>{formatTime(getValue<number>())}</div>
			)
		},
		{
			id: 'aspect',
			enableSorting: false,
			header: t('aspect_timeline_col_aspect', { defaultValue: 'Aspect' }),
			cell: ({ row }) => {
				const { series: s, hit } = row.original;
				return (
					<span className="inline-flex items-center gap-1">
						<AstrologyGlyph glyphId={s.from} fallback={objectIcon(s.from)} size={14} />
						<AstrologyGlyph
							glyphId={s.aspectType}
							domain="aspect"
							fallback={ASPECT_GLYPHS[s.aspectType] ?? '•'}
							size={14}
						/>
						<AstrologyGlyph glyphId={s.to} fallback={objectIcon(s.to)} size={14} />
						{hit.hitCount > 1 && (
							<span className={cn('tabular-nums', ft.muted)}>
								({hit.hitNumber}/{hit.hitCount})
							</span>
						)}
					</span>
				);
			}
		},
		{
			id: 'transiting',
			enableSorting: false,
			header: t('aspect_timeline_col_transiting', { defaultValue: 'Transiting' }),
			cell: ({ row }) => <LongitudeCell longitude={row.original.hit.fromLongitude} ft={ft} />
		},
		{
			id: 'natal',
			enableSorting: false,
			header: t('aspect_timeline_col_natal', { defaultValue: 'Natal' }),
			cell: ({ row }) => <LongitudeCell longitude={row.original.hit.toLongitude} ft={ft} />
		},
		{
			id: 'speed',
			accessorFn: (row) => row.hit.fromSpeed ?? 0,
			header: t('aspect_timeline_col_speed', { defaultValue: 'Speed' }),
			cell: ({ row }) => {
				const { hit } = row.original;
				return (
					<span className={cn('whitespace-nowrap tabular-nums', ft.bodyText)}>
						{hit.fromSpeed === undefined ? '—' : formatSignedDms(hit.fromSpeed)}
						{hit.fromRetrograde && (
							<Text variant="caption" as="span" tone="muted" className="ml-1">
								{t('aspect_timeline_retrograde_tag', { defaultValue: 'R' })}
							</Text>
						)}
					</span>
				);
			}
		}
	];
}

/** Exact hits approximated from the sampled series, by date. */
export function ExactHitsTable({ rows }: { rows: HitRow[] }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const columns = useMemo(() => hitColumns(ft, t), [ft, t]);

	return (
		<div className="max-h-[32rem] overflow-auto rounded-md border">
			<DataTable
				columns={columns}
				data={rows}
				initialSorting={INITIAL_SORTING}
				density="compact"
				empty={
					<Text variant="caption" tone="muted" className="p-4 text-center">
						{t('aspect_timeline_no_hits', {
							defaultValue: 'No exact hits within this period for the selected pairs.'
						})}
					</Text>
				}
			/>
		</div>
	);
}
