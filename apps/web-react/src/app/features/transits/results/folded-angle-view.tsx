import { typographyVariants } from '@/app/components/ui/typography';
import { Surface } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
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
import {
	CATEGORICAL_PALETTE_SIZE,
	categoricalPaletteForTheme
} from '@/lib/dataviz/categoricalPalette';
import { Card, CardContent } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { TimeSeriesChart } from '@/app/views/data/time-series-chart';
import { cn } from '@/app/components/ui/utils';
import { CheckChips } from '@/app/views/data/check-chips';
import { ObjectGlyph } from '@/app/views/domain/object-glyph';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useAppTheme } from '@/app/providers/app-theme';

const MAX_VISIBLE_SERIES = CATEGORICAL_PALETTE_SIZE;

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
	transitSeries: TransitSeriesEntry[];
	availableBodyIds: string[];
	loading: boolean;
}

function bodyDefinition(id: string): ObservableObjectDefinition | undefined {
	return OBSERVABLE_OBJECTS.find((item) => item.id === id);
}

export function FoldedAngleView({
	transitSeries,
	availableBodyIds,
	loading
}: FoldedAngleViewProps) {
	const { t } = useTranslation();
	const { theme } = useAppTheme();
	const ft = useAppFormFieldTheme();
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
					<Text variant="body" tone="muted">
						{t('transits_folded_subtitle', {
							defaultValue:
								'Observer-relative planetary angular positions over time, folded onto a 0°–180° scale.'
						})}
					</Text>
					<Surface
						padding="compact"
						as="p"
						variant="soft"

						className={cn(typographyVariants({ variant: 'caption', tone: 'muted' }), '')}
					>
						{t('transits_folded_coordinate_note', {
							defaultValue:
								'Coordinate system: geocentric ecliptic longitude (tropical zodiac), θ measured eastward from 0° Aries (the vernal equinox). Folded as f(θ) = min(θ, 360° − θ), so each revolution reads 0° → 180° → 0°. Actual planetary motion is preserved — the curve is not forced sinusoidal.'
						})}
					</Surface>

					<div>
						<Label className="mb-2 block">
							{t('transits_folded_bodies_label', { defaultValue: 'Bodies shown' })}
						</Label>
						<CheckChips
							idPrefix="folded-body"
							items={orderedBodyIds.map((id) => {
								const color = colorById.get(id);
								return {
									id,
									label: labelFor(id),
									disabled: !selectedIds.includes(id) && atCap,
									leading: (
										<>
											{selectedIds.includes(id) && color && (
												<span
													className="inline-block h-0.5 w-2.5 shrink-0 rounded-full"
													style={{ backgroundColor: color }}
												/>
											)}
											{bodyDefinition(id) && (
												<ObjectGlyph id={id} size={13} className={cn('shrink-0', ft.iconColor)} />
											)}
										</>
									)
								};
							})}
							selected={selectedIds}
							onToggle={toggleBody}
						/>
						{atCap && (
							<Text variant="caption" tone="muted" className="mt-2">
								{t('transits_folded_max_bodies_hint', {
									count: MAX_VISIBLE_SERIES,
									defaultValue: `Showing the first ${MAX_VISIBLE_SERIES} selected bodies to keep lines distinguishable. Deselect one to add another.`
								})}
							</Text>
						)}
					</div>
				</CardContent>
			</Card>

			<Card variant="ghost" className="w-full rounded-xl">
				<CardContent className="p-6 md:p-8">
					<div className="mb-4 flex items-center justify-between gap-3">
						<Text variant="compactLabel" as="span" tone="muted">
							{t('transits_folded_axis_angle', { defaultValue: 'Folded angle (°)' })}
						</Text>
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
						<Text variant="body" tone="muted" className="py-10 text-center">
							{loading
								? t('transit_loading')
								: t('transits_folded_empty', {
										defaultValue: 'Compute a transit series to see folded trajectories here.'
									})}
						</Text>
					) : viewMode === 'chart' ? (
						<TimeSeriesChart
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
