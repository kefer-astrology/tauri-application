import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TransitSeriesEntry } from '@/lib/tauri/types';
import { normalizeLongitude } from '@/lib/astrology/transits';
import { foldTo180 } from '@/lib/astrology/foldedAngle';
import {
	OBSERVABLE_OBJECTS,
	getObservableObjectLabel,
	type ObservableObjectDefinition
} from '@/lib/astrology/observableObjects';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { CATEGORICAL_PALETTE_SIZE, categoricalPaletteForTheme } from '@/lib/dataviz/categoricalPalette';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { LineChart } from './ui/line-chart';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

const MAX_VISIBLE_SERIES = CATEGORICAL_PALETTE_SIZE;

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

const PREFERRED_DEFAULT_ORDER = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

interface FoldedAngleViewProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	transitSeries: TransitSeriesEntry[];
	availableBodyIds: string[];
	loading: boolean;
}

function bodyDefinition(id: string): ObservableObjectDefinition | undefined {
	return OBSERVABLE_OBJECTS.find((item) => item.id === id);
}

export function FoldedAngleView({
	theme,
	glyphSet,
	transitSeries,
	availableBodyIds,
	loading
}: FoldedAngleViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const palette = categoricalPaletteForTheme(theme);

	const orderedBodyIds = useMemo(() => {
		const available = new Set(availableBodyIds);
		const preferred = PREFERRED_DEFAULT_ORDER.filter((id) => available.has(id));
		const rest = availableBodyIds.filter((id) => !preferred.includes(id)).sort();
		return [...preferred, ...rest];
	}, [availableBodyIds]);

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

	useEffect(() => {
		setSelectedIds((prev) => {
			const stillAvailable = prev.filter((id) => orderedBodyIds.includes(id));
			if (stillAvailable.length > 0) return stillAvailable;
			return orderedBodyIds.slice(0, MAX_VISIBLE_SERIES);
		});
	}, [orderedBodyIds]);

	const colorById = useMemo(() => {
		const map = new Map<string, string>();
		selectedIds.forEach((id, index) => {
			map.set(id, palette[index % palette.length]);
		});
		return map;
	}, [selectedIds, palette]);

	const labelFor = (id: string): string => {
		const def = bodyDefinition(id);
		return def ? getObservableObjectLabel(def, t) : id;
	};

	const categories = useMemo(
		() => transitSeries.map((entry) => new Date(entry.datetime).getTime()),
		[transitSeries]
	);

	const values = useMemo(() => {
		const result: Record<string, Array<number | null>> = {};
		for (const id of selectedIds) {
			result[id] = transitSeries.map((entry) => {
				const longitude = normalizeLongitude(entry.transit_positions?.[id]);
				return longitude === null ? null : foldTo180(longitude);
			});
		}
		return result;
	}, [transitSeries, selectedIds]);

	function toggleBody(id: string, checked: boolean) {
		setSelectedIds((prev) => {
			if (!checked) return prev.filter((existing) => existing !== id);
			if (prev.includes(id)) return prev;
			if (prev.length >= MAX_VISIBLE_SERIES) return prev;
			return [...prev, id];
		});
	}

	const atCap = selectedIds.length >= MAX_VISIBLE_SERIES;

	return (
		<div className="space-y-6">
			<Card variant="ghost" className="w-full rounded-xl">
				<CardContent className="space-y-4 p-6 md:p-8">
					<p className={cn('text-sm', ft.muted)}>
						{t('transits_folded_subtitle', {
							defaultValue:
								'Observer-relative planetary angular positions over time, folded onto a 0°–180° scale.'
						})}
					</p>
					<p className={cn('rounded-lg border p-3 text-xs', ft.muted, ft.footerBorder)}>
						{t('transits_folded_coordinate_note', {
							defaultValue:
								'Coordinate system: geocentric ecliptic longitude (tropical zodiac), θ measured eastward from 0° Aries (the vernal equinox). Folded as f(θ) = min(θ, 360° − θ), so each revolution reads 0° → 180° → 0°. Actual planetary motion is preserved — the curve is not forced sinusoidal.'
						})}
					</p>

					<div>
						<Label className={cn('mb-2 block', ft.label)}>
							{t('transits_folded_bodies_label', { defaultValue: 'Bodies shown' })}
						</Label>
						<div className="flex flex-wrap gap-2">
							{orderedBodyIds.map((id) => {
								const checked = selectedIds.includes(id);
								const def = bodyDefinition(id);
								const color = colorById.get(id);
								const disabled = !checked && atCap;
								return (
									<Label
										key={id}
										htmlFor={`folded-body-${id}`}
										className={cn(
											'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
											'border-[color:var(--theme-panel-border)]',
											disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
											checked && 'bg-[color:var(--theme-soft-bg)]'
										)}
									>
										<Checkbox
											id={`folded-body-${id}`}
											checked={checked}
											disabled={disabled}
											onCheckedChange={(value) => toggleBody(id, value === true)}
											className="h-3.5 w-3.5 shrink-0 rounded"
										/>
										{checked && color && (
											<span
												className="inline-block h-0.5 w-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: color }}
											/>
										)}
										{def && (
											<AstrologyGlyph
												glyphId={id}
												glyphSet={glyphSet}
												fallback={PLANET_GLYPH_FALLBACK[id] ?? def.icon}
												size={13}
												className={cn('shrink-0', ft.iconColor)}
											/>
										)}
										<span className={ft.bodyText}>{labelFor(id)}</span>
									</Label>
								);
							})}
						</div>
						{atCap && (
							<p className={cn('mt-2 text-xs', ft.muted)}>
								{t('transits_folded_max_bodies_hint', {
									count: MAX_VISIBLE_SERIES,
									defaultValue: `Showing the first ${MAX_VISIBLE_SERIES} selected bodies to keep lines distinguishable. Deselect one to add another.`
								})}
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			<Card variant="ghost" className="w-full rounded-xl">
				<CardContent className="p-6 md:p-8">
					<div className="mb-4 flex items-center justify-between gap-3">
						<span className={cn('text-xs font-medium', ft.muted)}>
							{t('transits_folded_axis_angle', { defaultValue: 'Folded angle (°)' })}
						</span>
						<Button
							type="button"
							variant="ghost"
							className={cn('h-8 px-3 text-xs', ft.bodyText)}
							onClick={() => setViewMode((prev) => (prev === 'chart' ? 'table' : 'chart'))}
							disabled={categories.length === 0}
						>
							{viewMode === 'chart'
								? t('transits_folded_table_view', { defaultValue: 'Table view' })
								: t('transits_folded_chart_view', { defaultValue: 'Chart view' })}
						</Button>
					</div>

					{categories.length === 0 ? (
						<p className={cn('py-10 text-center text-sm', ft.muted)}>
							{loading
								? t('transit_loading')
								: t('transits_folded_empty', {
										defaultValue: 'Compute a transit series to see folded trajectories here.'
									})}
						</p>
					) : viewMode === 'chart' ? (
						<LineChart
							categories={categories}
							series={selectedIds.map((id) => ({
								id,
								label: labelFor(id),
								color: colorById.get(id) ?? palette[0]
							}))}
							values={values}
							height={280}
							yDomain={[0, 180]}
							yTicks={[0, 45, 90, 135, 180]}
							formatY={(y) => `${Math.round(y)}°`}
							formatX={(x) => new Date(x).toLocaleString()}
							xLabel={t('column_time')}
							ariaLabel={t('transits_folded_subtitle')}
						/>
					) : (
						<div className="max-h-96 overflow-auto rounded-md border">
							<table className="w-full border-collapse text-xs">
								<thead className="bg-background sticky top-0 border-b">
									<tr>
										<th className={cn('p-2 text-left font-semibold', ft.bodyText)}>
											{t('column_time')}
										</th>
										{selectedIds.map((id) => (
											<th key={id} className={cn('p-2 text-left font-semibold', ft.bodyText)}>
												{labelFor(id)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{transitSeries.map((entry, rowIndex) => (
										<tr
											key={entry.datetime}
											className="hover:bg-accent/50 border-b transition-colors"
										>
											<td className={cn('p-2', ft.bodyText)}>{entry.datetime}</td>
											{selectedIds.map((id) => {
												const value = values[id]?.[rowIndex];
												return (
													<td key={id} className={cn('p-2 tabular-nums', ft.bodyText)}>
														{value === null || value === undefined
															? '—'
															: `${Math.round(value * 100) / 100}°`}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
